import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";
import { getOrderDraftBlobConfig, getOrderDraftStorageDir } from "@/lib/admin-order-draft-store";
import { hashClientLinkToken } from "@/lib/client-link-crypto";
import {
  isSafeBusinessLinkToken,
  newBusinessLinkRecord,
  parseBusinessLinkRecord,
  type BusinessLinkAdminInput,
  type BusinessLinkRecord,
} from "@/lib/business-link";

/** Tāda pati krātuve kā `client_links`, atsevišķa mape. Glabā tikai tokena sha256. */
const DIR = "business_links";

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

async function writeJson(hash: string, doc: BusinessLinkRecord): Promise<boolean> {
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

export async function readBusinessLinkByHash(hash: string): Promise<BusinessLinkRecord | null> {
  const h = hash.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(h)) return null;
  const parsed = parseBusinessLinkRecord(await readJson(h));
  if (!parsed || parsed.tokenHash !== h) return null;
  return parsed;
}

export async function readBusinessLinkByToken(token: string): Promise<BusinessLinkRecord | null> {
  if (!isSafeBusinessLinkToken(token)) return null;
  return readBusinessLinkByHash(hashClientLinkToken(token));
}

export async function createBusinessLink(
  token: string,
  input: BusinessLinkAdminInput,
  nowMs = Date.now(),
): Promise<{ ok: true; record: BusinessLinkRecord } | { ok: false; error: string }> {
  if (!isSafeBusinessLinkToken(token)) return { ok: false, error: "invalid_token" };
  const record = newBusinessLinkRecord(hashClientLinkToken(token), input, nowMs);
  if (!(await writeJson(record.tokenHash, record))) return { ok: false, error: "store_failed" };
  return { ok: true, record };
}

/** Atgriež iepriekšējo atvērto Stripe sesiju (ja bija), lai to varētu slēgt. */
export async function attachBusinessLinkCheckoutSession(
  hash: string,
  stripeCheckoutSessionId: string,
): Promise<{ ok: true; previousSessionId: string | null } | { ok: false; error: string }> {
  return withLock(hash, async () => {
    const existing = await readBusinessLinkByHash(hash);
    if (!existing) return { ok: false, error: "not_found" };
    if (existing.status === "paid") return { ok: false, error: "already_paid" };
    const next: BusinessLinkRecord = { ...existing, lastStripeCheckoutSessionId: stripeCheckoutSessionId.trim() };
    if (!(await writeJson(existing.tokenHash, next))) return { ok: false, error: "store_failed" };
    const prev = existing.lastStripeCheckoutSessionId ?? null;
    return { ok: true, previousSessionId: prev && prev !== next.lastStripeCheckoutSessionId ? prev : null };
  });
}

export async function consumeBusinessLinkByHash(
  hash: string,
  stripeSessionId: string,
  nowMs = Date.now(),
): Promise<{ ok: true; record: BusinessLinkRecord; already: boolean } | { ok: false; error: string }> {
  return withLock(hash, async () => {
    const existing = await readBusinessLinkByHash(hash);
    if (!existing) return { ok: false, error: "not_found" };
    if (existing.status === "paid") return { ok: true, record: existing, already: true };
    const next: BusinessLinkRecord = {
      ...existing,
      status: "paid",
      paidAt: new Date(nowMs).toISOString(),
      paidStripeSessionId: stripeSessionId.trim(),
    };
    if (!(await writeJson(existing.tokenHash, next))) return { ok: false, error: "store_failed" };
    return { ok: true, record: next, already: false };
  });
}
