import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";
import {
  getIrissPasutijumiBlobConfig,
  getIrissPasutijumiStorageDir,
  isIrissPasutijumiStoreEnabled,
} from "@/lib/iriss-pasutijumi-store";
import {
  applyIrissOfferLinkResponse,
  applyIrissOfferLinkRevoke,
  applyIrissOfferLinkView,
  irissOfferLinkExpiresAt,
  isIrissOfferLinkEntityId,
  isSafeIrissOfferLinkToken,
  parseIrissOfferClientLinkRecord,
  toIrissOfferClientLinkAdminView,
  type IrissOfferClientLinkAdminView,
  type IrissOfferClientLinkRecord,
  type IrissOfferLinkAction,
} from "@/lib/iriss-offer-client-link";
import {
  hashIrissOfferLinkToken,
  irissOfferLinkHashesEqual,
  irissOfferLinkTokensEqual,
  newIrissOfferLinkToken,
} from "@/lib/iriss-offer-client-link-token";

const writeLocks = new Map<string, Promise<unknown>>();

function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = writeLocks.get(key) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(fn);
  writeLocks.set(key, next);
  void next.finally(() => {
    if (writeLocks.get(key) === next) writeLocks.delete(key);
  });
  return next;
}

function tokenRel(hash: string): string {
  return `offer-links/tokens/${hash}.json`;
}

function orderRel(orderId: string): string {
  return `offer-links/orders/${orderId}.json`;
}

async function readJson(rel: string): Promise<unknown | null> {
  const blob = getIrissPasutijumiBlobConfig();
  if (blob) {
    try {
      const res = await get(`${blob.prefix}${rel}`, { access: "private", token: blob.token, useCache: false });
      if (res?.statusCode === 200 && res.stream) {
        return JSON.parse(await new Response(res.stream).text()) as unknown;
      }
    } catch {
      return null;
    }
    return null;
  }
  const dir = getIrissPasutijumiStorageDir();
  if (!dir) return null;
  try {
    return JSON.parse(await fs.readFile(path.join(dir, rel), "utf8")) as unknown;
  } catch {
    return null;
  }
}

async function writeJson(rel: string, doc: unknown): Promise<boolean> {
  if (!isIrissPasutijumiStoreEnabled()) return false;
  const raw = JSON.stringify(doc);
  const blob = getIrissPasutijumiBlobConfig();
  if (blob) {
    try {
      await put(`${blob.prefix}${rel}`, raw, {
        access: "private",
        token: blob.token,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
      return true;
    } catch {
      return false;
    }
  }
  const dir = getIrissPasutijumiStorageDir();
  if (!dir) return false;
  try {
    const dest = path.join(dir, rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    const tmp = `${dest}.${process.pid}.tmp`;
    await fs.writeFile(tmp, raw, "utf8");
    await fs.rename(tmp, dest);
    return true;
  } catch {
    return false;
  }
}

function parseOrderIndex(raw: unknown): Record<string, string> {
  const offers: Record<string, string> = {};
  if (!raw || typeof raw !== "object") return offers;
  const bag = (raw as { offers?: unknown }).offers;
  if (!bag || typeof bag !== "object") return offers;
  for (const [offerId, hash] of Object.entries(bag)) {
    if (!isIrissOfferLinkEntityId(offerId)) continue;
    if (typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash)) continue;
    offers[offerId] = hash;
  }
  return offers;
}

async function readOrderIndex(orderId: string): Promise<Record<string, string>> {
  if (!isIrissOfferLinkEntityId(orderId)) return {};
  return parseOrderIndex(await readJson(orderRel(orderId)));
}

async function writeOrderIndex(orderId: string, offers: Record<string, string>): Promise<boolean> {
  return writeJson(orderRel(orderId), { offers });
}

export async function readIrissOfferClientLinkByHash(hash: string): Promise<IrissOfferClientLinkRecord | null> {
  const h = hash.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(h)) return null;
  const parsed = parseIrissOfferClientLinkRecord(await readJson(tokenRel(h)));
  if (!parsed) return null;
  if (!irissOfferLinkHashesEqual(parsed.tokenHash, h)) return null;
  if (!irissOfferLinkHashesEqual(hashIrissOfferLinkToken(parsed.token), h)) return null;
  return parsed;
}

export async function readIrissOfferClientLinkByToken(token: string): Promise<IrissOfferClientLinkRecord | null> {
  if (!isSafeIrissOfferLinkToken(token)) return null;
  const rec = await readIrissOfferClientLinkByHash(hashIrissOfferLinkToken(token));
  if (!rec || !irissOfferLinkTokensEqual(rec.token, token)) return null;
  return rec;
}

export async function readIrissOfferClientLinksForOrder(orderId: string): Promise<IrissOfferClientLinkAdminView[]> {
  const index = await readOrderIndex(orderId);
  const views: IrissOfferClientLinkAdminView[] = [];
  for (const [offerId, hash] of Object.entries(index)) {
    const rec = await readIrissOfferClientLinkByHash(hash);
    if (!rec) continue;
    if (rec.orderId !== orderId || rec.offerId !== offerId) continue;
    views.push(toIrissOfferClientLinkAdminView(rec));
  }
  return views;
}

export async function createIrissOfferClientLink(input: {
  orderId: string;
  offerId: string;
  expiresInDays: number | null;
  nowMs?: number;
  token?: string;
}): Promise<{ ok: true; record: IrissOfferClientLinkRecord } | { ok: false; error: "invalid" | "store_failed" }> {
  if (!isIrissOfferLinkEntityId(input.orderId) || !isIrissOfferLinkEntityId(input.offerId)) {
    return { ok: false, error: "invalid" };
  }
  const token = input.token ?? newIrissOfferLinkToken();
  if (!isSafeIrissOfferLinkToken(token)) return { ok: false, error: "invalid" };
  return withLock(`order:${input.orderId}`, async () => {
    const nowMs = input.nowMs ?? Date.now();
    const createdAt = new Date(nowMs).toISOString();
    const tokenHash = hashIrissOfferLinkToken(token);
    const index = await readOrderIndex(input.orderId);
    const previousHash = index[input.offerId];
    if (previousHash && previousHash !== tokenHash) {
      const previous = await readIrissOfferClientLinkByHash(previousHash);
      if (previous && !previous.revokedAt) {
        const revoked = applyIrissOfferLinkRevoke(previous, createdAt);
        const revokedOk = await writeJson(tokenRel(previous.tokenHash), revoked);
        if (!revokedOk) return { ok: false, error: "store_failed" };
      }
    }
    const record: IrissOfferClientLinkRecord = {
      tokenHash,
      token,
      orderId: input.orderId,
      offerId: input.offerId,
      createdAt,
      expiresAt: irissOfferLinkExpiresAt(createdAt, input.expiresInDays),
      revokedAt: "",
      firstViewedAt: "",
      lastViewedAt: "",
      viewCount: 0,
      decision: "",
      decidedAt: "",
      question: "",
      questionAt: "",
    };
    const saved = await writeJson(tokenRel(tokenHash), record);
    if (!saved) return { ok: false, error: "store_failed" };
    const indexed = await writeOrderIndex(input.orderId, { ...index, [input.offerId]: tokenHash });
    if (!indexed) {
      await writeJson(tokenRel(tokenHash), applyIrissOfferLinkRevoke(record, createdAt));
      return { ok: false, error: "store_failed" };
    }
    return { ok: true, record };
  });
}

export async function revokeIrissOfferClientLink(
  orderId: string,
  offerId: string,
  nowMs = Date.now(),
): Promise<{ ok: true; record: IrissOfferClientLinkRecord } | { ok: false; error: "not_found" | "store_failed" }> {
  if (!isIrissOfferLinkEntityId(orderId) || !isIrissOfferLinkEntityId(offerId)) {
    return { ok: false, error: "not_found" };
  }
  return withLock(`order:${orderId}`, async () => {
    const index = await readOrderIndex(orderId);
    const hash = index[offerId];
    if (!hash) return { ok: false, error: "not_found" };
    const existing = await readIrissOfferClientLinkByHash(hash);
    if (!existing || existing.orderId !== orderId || existing.offerId !== offerId) {
      return { ok: false, error: "not_found" };
    }
    const next = applyIrissOfferLinkRevoke(existing, new Date(nowMs).toISOString());
    const saved = await writeJson(tokenRel(next.tokenHash), next);
    if (!saved) return { ok: false, error: "store_failed" };
    return { ok: true, record: next };
  });
}

export async function recordIrissOfferLinkView(
  hash: string,
  nowMs = Date.now(),
): Promise<IrissOfferClientLinkRecord | null> {
  const h = hash.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(h)) return null;
  return withLock(`hash:${h}`, async () => {
    const existing = await readIrissOfferClientLinkByHash(h);
    if (!existing) return null;
    const next = applyIrissOfferLinkView(existing, new Date(nowMs).toISOString());
    if (!next) return null;
    const saved = await writeJson(tokenRel(h), next);
    return saved ? next : existing;
  });
}

export async function respondIrissOfferClientLink(
  hash: string,
  action: IrissOfferLinkAction,
  text: string,
  nowMs = Date.now(),
): Promise<
  | { ok: true; record: IrissOfferClientLinkRecord }
  | { ok: false; error: "not_found" | "unavailable" | "question" | "store_failed" }
> {
  const h = hash.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(h)) return { ok: false, error: "not_found" };
  return withLock(`hash:${h}`, async () => {
    const existing = await readIrissOfferClientLinkByHash(h);
    if (!existing) return { ok: false, error: "not_found" };
    const applied = applyIrissOfferLinkResponse(existing, action, text, new Date(nowMs).toISOString());
    if (!applied.ok) return applied;
    if (applied.unchanged) return { ok: true, record: applied.record };
    const saved = await writeJson(tokenRel(h), applied.record);
    if (!saved) return { ok: false, error: "store_failed" };
    return { ok: true, record: applied.record };
  });
}
