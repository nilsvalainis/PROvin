import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";
import { getOrderDraftBlobConfig, getOrderDraftStorageDir } from "@/lib/admin-order-draft-store";
import {
  applyAdminInputToRecord,
  hashClientLinkToken,
  isSafeClientLinkToken,
  parseClientLinkRecord,
  type ClientLinkAdminInput,
  type ClientLinkRecord,
} from "@/lib/client-link";

const DIR = "client_links";

const writeLocks = new Map<string, Promise<unknown>>();

function withLock<T>(hash: string, fn: () => Promise<T>): Promise<T> {
  const prev = writeLocks.get(hash) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(fn);
  writeLocks.set(hash, next);
  void next.finally(() => {
    if (writeLocks.get(hash) === next) writeLocks.delete(hash);
  });
  return next;
}

function fsPath(dir: string, hash: string): string {
  return path.join(dir, DIR, `${hash}.json`);
}

function blobPath(prefix: string, hash: string): string {
  return `${prefix}${DIR}/${hash}.json`;
}

async function readJson(hash: string): Promise<unknown | null> {
  const blob = getOrderDraftBlobConfig();
  if (blob) {
    try {
      const res = await get(blobPath(blob.prefix, hash), { access: "private", token: blob.token, useCache: false });
      if (res?.statusCode === 200 && res.stream) {
        return JSON.parse(await new Response(res.stream).text()) as unknown;
      }
    } catch {
      /* fall through */
    }
  }
  const dir = getOrderDraftStorageDir();
  if (dir && process.env.VERCEL !== "1") {
    try {
      return JSON.parse(await fs.readFile(fsPath(dir, hash), "utf8")) as unknown;
    } catch {
      return null;
    }
  }
  return null;
}

async function writeJson(hash: string, doc: ClientLinkRecord): Promise<boolean> {
  const raw = JSON.stringify(doc);
  const dir = getOrderDraftStorageDir();
  const blob = getOrderDraftBlobConfig();
  if (!dir && !blob) return false;
  if (process.env.VERCEL === "1" && !blob) return false;

  let fsOk = false;
  let blobOk = false;
  if (dir && process.env.VERCEL !== "1") {
    try {
      const dest = fsPath(dir, hash);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      const tmp = `${dest}.tmp`;
      await fs.writeFile(tmp, raw, "utf8");
      await fs.rename(tmp, dest);
      fsOk = true;
    } catch {
      fsOk = false;
    }
  }
  if (blob) {
    try {
      await put(blobPath(blob.prefix, hash), raw, {
        access: "private",
        token: blob.token,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
      blobOk = true;
    } catch {
      blobOk = false;
    }
  }
  if (process.env.VERCEL === "1") return blobOk;
  return fsOk || blobOk;
}

export async function readClientLinkByHash(hash: string): Promise<ClientLinkRecord | null> {
  const h = hash.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(h)) return null;
  const raw = await readJson(h);
  const parsed = parseClientLinkRecord(raw);
  if (!parsed || parsed.tokenHash !== h) return null;
  return parsed;
}

export async function readClientLinkByToken(token: string): Promise<ClientLinkRecord | null> {
  if (!isSafeClientLinkToken(token)) return null;
  return readClientLinkByHash(hashClientLinkToken(token));
}

export async function createClientLink(
  token: string,
  input: ClientLinkAdminInput,
  nowMs = Date.now(),
): Promise<{ ok: true; record: ClientLinkRecord } | { ok: false; error: string }> {
  if (!isSafeClientLinkToken(token)) return { ok: false, error: "invalid_token" };
  const tokenHash = hashClientLinkToken(token);
  const createdAt = new Date(nowMs).toISOString();
  const record: ClientLinkRecord = {
    tokenHash,
    createdAt,
    expiresAt: new Date(nowMs + input.validityHours * 60 * 60 * 1000).toISOString(),
    status: "open",
    productName: input.productName,
    amountCents: input.amountCents,
    recipientChannel: input.recipientChannel,
    recipient: input.recipient,
    prefillVin: input.prefillVin,
    prefillListingUrl: input.prefillListingUrl,
    require: input.require,
  };
  const saved = await writeJson(tokenHash, record);
  if (!saved) return { ok: false, error: "store_failed" };
  return { ok: true, record };
}

export async function updateClientLink(
  hash: string,
  input: ClientLinkAdminInput,
): Promise<{ ok: true; record: ClientLinkRecord } | { ok: false; error: string }> {
  return withLock(hash, async () => {
    const existing = await readClientLinkByHash(hash);
    if (!existing) return { ok: false, error: "not_found" };
    if (existing.status === "paid") return { ok: false, error: "already_paid" };
    const next = applyAdminInputToRecord(existing, input);
    const saved = await writeJson(existing.tokenHash, next);
    if (!saved) return { ok: false, error: "store_failed" };
    return { ok: true, record: next };
  });
}

export async function attachClientLinkCheckoutSession(
  hash: string,
  stripeCheckoutSessionId: string,
): Promise<{ ok: true; record: ClientLinkRecord } | { ok: false; error: string }> {
  return withLock(hash, async () => {
    const existing = await readClientLinkByHash(hash);
    if (!existing) return { ok: false, error: "not_found" };
    if (existing.status === "paid") return { ok: false, error: "already_paid" };
    const next: ClientLinkRecord = {
      ...existing,
      lastStripeCheckoutSessionId: stripeCheckoutSessionId.trim(),
    };
    const saved = await writeJson(existing.tokenHash, next);
    if (!saved) return { ok: false, error: "store_failed" };
    return { ok: true, record: next };
  });
}

export async function consumeClientLinkByHash(
  hash: string,
  stripeSessionId: string,
  nowMs = Date.now(),
): Promise<{ ok: true; record: ClientLinkRecord; already: boolean } | { ok: false; error: string }> {
  return withLock(hash, async () => {
    const existing = await readClientLinkByHash(hash);
    if (!existing) return { ok: false, error: "not_found" };
    if (existing.status === "paid") {
      return { ok: true, record: existing, already: true };
    }
    const next: ClientLinkRecord = {
      ...existing,
      status: "paid",
      paidAt: new Date(nowMs).toISOString(),
      paidStripeSessionId: stripeSessionId.trim(),
    };
    const saved = await writeJson(existing.tokenHash, next);
    if (!saved) return { ok: false, error: "store_failed" };
    return { ok: true, record: next, already: false };
  });
}
