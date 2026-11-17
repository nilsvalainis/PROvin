import "server-only";

import fs from "fs/promises";
import path from "path";
import { del, get, list, put } from "@vercel/blob";
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
  irissOfferLinkExpiresAtForDeadline,
  isIrissOfferLinkEntityId,
  isIrissOfferLinkUsable,
  isSafeIrissOfferLinkToken,
  parseIrissOfferClientLinkRecord,
  toIrissOfferClientLinkAdminView,
  type IrissOfferClientDecision,
  type IrissOfferClientLinkAdminView,
  type IrissOfferClientLinkRecord,
  type IrissOfferLinkAction,
} from "@/lib/iriss-offer-client-link";
import type { IrissOfferLinkSummaryEntry } from "@/lib/iriss-offer-deadline-ui";
import { normalizeOfferValidUntilAt } from "@/lib/iriss-offer-valid-until";
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

function decisionRel(hash: string): string {
  return `offer-links/decisions/${hash}.json`;
}

const SUMMARY_REL = "offer-links/summary.json";

export type IrissOfferClaimedDecision = { decision: "approve" | "decline"; decidedAt: string };

function parseClaimedDecision(raw: unknown): IrissOfferClaimedDecision | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const decision = o.decision === "approve" || o.decision === "decline" ? o.decision : null;
  const decidedAt = typeof o.decidedAt === "string" && Number.isFinite(Date.parse(o.decidedAt)) ? o.decidedAt : "";
  if (!decision || !decidedAt) return null;
  return { decision, decidedAt };
}

/** Lēmuma fails pēc saites hash (vecajām saitēm nav - tad noteicošs ir saites ieraksts). */
export async function readIrissOfferClaimedDecision(hash: string): Promise<IrissOfferClaimedDecision | null> {
  const h = hash.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(h)) return null;
  return parseClaimedDecision(await readJson(decisionRel(h)));
}

/** Ieraksta failu tikai, ja tāda vēl nav (Blob allowOverwrite: false, lokāli "wx"). */
async function createJsonOnce(rel: string, doc: unknown): Promise<"created" | "exists" | "failed"> {
  if (!isIrissPasutijumiStoreEnabled()) return "failed";
  const raw = JSON.stringify(doc);
  const blob = getIrissPasutijumiBlobConfig();
  if (blob) {
    try {
      await put(`${blob.prefix}${rel}`, raw, {
        access: "private",
        token: blob.token,
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: "application/json",
      });
      return "created";
    } catch {
      return (await readJson(rel)) != null ? "exists" : "failed";
    }
  }
  const dir = getIrissPasutijumiStorageDir();
  if (!dir) return "failed";
  const dest = path.join(dir, rel);
  try {
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, raw, { encoding: "utf8", flag: "wx" });
    return "created";
  } catch {
    return (await readJson(rel)) != null ? "exists" : "failed";
  }
}

/**
 * Izveido lēmuma failu tikai, ja tāda vēl nav.
 * Pirmais ieraksts uzvar visās instancēs; pārējie saņem jau esošo lēmumu.
 */
export async function claimIrissOfferDecision(
  hash: string,
  decision: "approve" | "decline",
  decidedAt: string,
): Promise<{ ok: true; won: boolean; claimed: IrissOfferClaimedDecision } | { ok: false }> {
  const h = hash.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(h)) return { ok: false };
  const doc: IrissOfferClaimedDecision = { decision, decidedAt };
  const res = await createJsonOnce(decisionRel(h), doc);
  if (res === "created") return { ok: true, won: true, claimed: doc };
  const existing = await readIrissOfferClaimedDecision(h);
  return existing ? { ok: true, won: false, claimed: existing } : { ok: false };
}

/* ---- Termiņu saraksts (cron: push Nilam, ja termiņš beidzies bez atbildes) ---- */

const DEADLINES_DIR = "offer-links/deadlines/";

function deadlineRel(hash: string): string {
  return `${DEADLINES_DIR}${hash}.json`;
}

export type IrissOfferDeadlineEntry = { hash: string; orderId: string; offerId: string; deadlineAt: string };

function parseDeadlineEntry(raw: unknown): IrissOfferDeadlineEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const hash = typeof o.hash === "string" ? o.hash : "";
  const orderId = typeof o.orderId === "string" ? o.orderId : "";
  const offerId = typeof o.offerId === "string" ? o.offerId : "";
  const deadlineAt = normalizeOfferValidUntilAt(o.deadlineAt);
  if (!/^[a-f0-9]{64}$/.test(hash) || !isIrissOfferLinkEntityId(orderId) || !isIrissOfferLinkEntityId(offerId) || !deadlineAt) {
    return null;
  }
  return { hash, orderId, offerId, deadlineAt };
}

export async function registerIrissOfferDeadline(entry: IrissOfferDeadlineEntry): Promise<boolean> {
  const parsed = parseDeadlineEntry(entry);
  if (!parsed) return false;
  return writeJson(deadlineRel(parsed.hash), parsed);
}

export async function removeIrissOfferDeadline(hash: string): Promise<void> {
  const h = hash.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(h)) return;
  const blob = getIrissPasutijumiBlobConfig();
  if (blob) {
    await del(`${blob.prefix}${deadlineRel(h)}`, { token: blob.token }).catch(() => undefined);
    return;
  }
  const dir = getIrissPasutijumiStorageDir();
  if (!dir) return;
  await fs.rm(path.join(dir, deadlineRel(h)), { force: true }).catch(() => undefined);
}

export async function listIrissOfferDeadlines(): Promise<IrissOfferDeadlineEntry[]> {
  const hashes: string[] = [];
  const blob = getIrissPasutijumiBlobConfig();
  if (blob) {
    let cursor: string | undefined;
    for (let page = 0; page < 20; page += 1) {
      const res = await list({ prefix: `${blob.prefix}${DEADLINES_DIR}`, token: blob.token, limit: 1000, cursor }).catch(() => null);
      if (!res) break;
      for (const b of res.blobs) {
        const m = /([a-f0-9]{64})\.json$/.exec(b.pathname);
        if (m) hashes.push(m[1]!);
      }
      if (!res.hasMore || !res.cursor) break;
      cursor = res.cursor;
    }
  } else {
    const dir = getIrissPasutijumiStorageDir();
    if (!dir) return [];
    const names = await fs.readdir(path.join(dir, DEADLINES_DIR)).catch(() => [] as string[]);
    for (const name of names) {
      const m = /^([a-f0-9]{64})\.json$/.exec(name);
      if (m) hashes.push(m[1]!);
    }
  }
  const out: IrissOfferDeadlineEntry[] = [];
  for (const h of hashes) {
    const entry = parseDeadlineEntry(await readJson(deadlineRel(h)));
    if (entry && entry.hash === h) out.push(entry);
  }
  return out;
}

/** Vienreiz par katru termiņu (pagarināts termiņš = jauns paziņojums). */
export async function claimIrissOfferExpiryNotice(hash: string, deadlineAt: string): Promise<boolean> {
  const h = hash.trim().toLowerCase();
  const at = normalizeOfferValidUntilAt(deadlineAt);
  if (!/^[a-f0-9]{64}$/.test(h) || !at) return false;
  const res = await createJsonOnce(`offer-links/expiry-notified/${h}-${Date.parse(at)}.json`, { at: new Date().toISOString() });
  return res === "created";
}

function withClaimedDecision(
  rec: IrissOfferClientLinkRecord,
  claimed: IrissOfferClaimedDecision | null,
): IrissOfferClientLinkRecord {
  if (!claimed || rec.decision) return rec;
  return { ...rec, decision: claimed.decision as IrissOfferClientDecision, decidedAt: claimed.decidedAt };
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

function parseSummaryEntry(raw: unknown): IrissOfferLinkSummaryEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const offerId = typeof o.offerId === "string" && isIrissOfferLinkEntityId(o.offerId) ? o.offerId : "";
  const status = o.status === "sent" || o.status === "approved" || o.status === "declined" || o.status === "revoked" ? o.status : null;
  const at = typeof o.at === "string" ? o.at : "";
  if (!offerId || !status) return null;
  return { offerId, status, at, validUntilAt: normalizeOfferValidUntilAt(o.validUntilAt) };
}

/**
 * Pasūtījumu saraksta zīmei: orderId -> jaunākā piedāvājuma saites stāvoklis (bez N lasījumiem).
 * Vecām saitēm ieraksta nav - zīme netiek rādīta (dati netiek migrēti).
 */
export async function readIrissOfferLinkSummary(): Promise<Record<string, IrissOfferLinkSummaryEntry>> {
  const raw = await readJson(SUMMARY_REL);
  const out: Record<string, IrissOfferLinkSummaryEntry> = {};
  const bag = raw && typeof raw === "object" ? (raw as { orders?: unknown }).orders : null;
  if (!bag || typeof bag !== "object") return out;
  for (const [orderId, entry] of Object.entries(bag as Record<string, unknown>)) {
    if (!isIrissOfferLinkEntityId(orderId)) continue;
    const parsed = parseSummaryEntry(entry);
    if (parsed) out[orderId] = parsed;
  }
  return out;
}

/** Kļūda kopsavilkumā nekad neaptur saites darbību (tikai zīme sarakstā). */
async function updateIrissOfferLinkSummary(orderId: string, entry: IrissOfferLinkSummaryEntry): Promise<void> {
  try {
    await withLock("summary", async () => {
      const all = await readIrissOfferLinkSummary();
      const prev = all[orderId];
      // Atsaukta vecāka piedāvājuma saite nenotīra jaunāka piedāvājuma zīmi.
      if (entry.status === "revoked" && prev && prev.offerId !== entry.offerId) return;
      await writeJson(SUMMARY_REL, { orders: { ...all, [orderId]: entry } });
    });
  } catch (e) {
    console.error("[iriss-offer-link] summary", e instanceof Error ? e.message : e);
  }
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

export async function readIrissOfferClientLinksForOrder(
  orderId: string,
  opts?: { deadlines?: Record<string, string>; nowMs?: number },
): Promise<IrissOfferClientLinkAdminView[]> {
  const index = await readOrderIndex(orderId);
  const views: IrissOfferClientLinkAdminView[] = [];
  for (const [offerId, hash] of Object.entries(index)) {
    const rec = await readIrissOfferClientLinkByHash(hash);
    if (!rec) continue;
    if (rec.orderId !== orderId || rec.offerId !== offerId) continue;
    const synced = rec.decision ? rec : withClaimedDecision(rec, await readIrissOfferClaimedDecision(hash));
    views.push(
      toIrissOfferClientLinkAdminView(synced, { deadlineAt: opts?.deadlines?.[offerId] ?? "", nowMs: opts?.nowMs }),
    );
  }
  return views;
}

export async function createIrissOfferClientLink(input: {
  orderId: string;
  offerId: string;
  expiresInDays: number | null;
  /** Piedāvājuma termiņš (validUntilAt). Ja ir - saite derīga līdz termiņam + 30 dienām. */
  deadlineAt?: string;
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
      expiresAt: input.deadlineAt
        ? irissOfferLinkExpiresAtForDeadline(input.deadlineAt) || irissOfferLinkExpiresAt(createdAt, input.expiresInDays)
        : irissOfferLinkExpiresAt(createdAt, input.expiresInDays),
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
    if (previousHash && previousHash !== tokenHash) await removeIrissOfferDeadline(previousHash);
    if (input.deadlineAt) {
      await registerIrissOfferDeadline({
        hash: tokenHash,
        orderId: input.orderId,
        offerId: input.offerId,
        deadlineAt: input.deadlineAt,
      });
    }
    await updateIrissOfferLinkSummary(input.orderId, {
      offerId: input.offerId,
      status: "sent",
      at: createdAt,
      validUntilAt: normalizeOfferValidUntilAt(input.deadlineAt ?? ""),
    });
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
    await removeIrissOfferDeadline(next.tokenHash);
    await updateIrissOfferLinkSummary(orderId, { offerId, status: "revoked", at: next.revokedAt, validUntilAt: "" });
    return { ok: true, record: next };
  });
}

/**
 * "Pagarināt" (tikai, ja nav lēmuma): tā pati saite, jauns termiņš, saite derīga vēl 30 dienas pēc tā.
 * Piedāvājuma validUntilAt pasūtījumā maina izsaucējs.
 */
export async function extendIrissOfferClientLink(
  orderId: string,
  offerId: string,
  deadlineAt: string,
): Promise<{ ok: true; record: IrissOfferClientLinkRecord } | { ok: false; error: "not_found" | "decided" | "invalid" | "store_failed" }> {
  const iso = normalizeOfferValidUntilAt(deadlineAt);
  if (!iso || !isIrissOfferLinkEntityId(orderId) || !isIrissOfferLinkEntityId(offerId)) return { ok: false, error: "invalid" };
  return withLock(`order:${orderId}`, async () => {
    const index = await readOrderIndex(orderId);
    const hash = index[offerId];
    if (!hash) return { ok: false, error: "not_found" };
    const existing = await readIrissOfferClientLinkByHash(hash);
    if (!existing || existing.orderId !== orderId || existing.offerId !== offerId || existing.revokedAt) {
      return { ok: false, error: "not_found" };
    }
    if (existing.decision || (await readIrissOfferClaimedDecision(hash))) return { ok: false, error: "decided" };
    const next: IrissOfferClientLinkRecord = { ...existing, expiresAt: irissOfferLinkExpiresAtForDeadline(iso) };
    const saved = await writeJson(tokenRel(hash), next);
    if (!saved) return { ok: false, error: "store_failed" };
    await registerIrissOfferDeadline({ hash, orderId, offerId, deadlineAt: iso });
    await updateIrissOfferLinkSummary(orderId, { offerId, status: "sent", at: new Date().toISOString(), validUntilAt: iso });
    return { ok: true, record: next };
  });
}

/** Lēmuma zīme sarakstā (tikai uzvarējušajam lēmumam). */
export async function recordIrissOfferDecisionSummary(
  record: Pick<IrissOfferClientLinkRecord, "orderId" | "offerId" | "decision" | "decidedAt">,
  deadlineAt: string,
): Promise<void> {
  if (record.decision !== "approve" && record.decision !== "decline") return;
  await updateIrissOfferLinkSummary(record.orderId, {
    offerId: record.offerId,
    status: record.decision === "approve" ? "approved" : "declined",
    at: record.decidedAt,
    validUntilAt: normalizeOfferValidUntilAt(deadlineAt),
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
  opts?: { deadlineAt?: string | null },
): Promise<
  | { ok: true; record: IrissOfferClientLinkRecord; won: boolean }
  | { ok: false; error: "not_found" | "unavailable" | "question" | "expired" | "store_failed" }
> {
  const h = hash.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(h)) return { ok: false, error: "not_found" };
  return withLock(`hash:${h}`, async () => {
    const existing = await readIrissOfferClientLinkByHash(h);
    if (!existing) return { ok: false, error: "not_found" };
    const nowIso = new Date(nowMs).toISOString();
    if (action === "question") {
      const applied = applyIrissOfferLinkResponse(existing, action, text, nowIso, opts);
      if (!applied.ok) return applied;
      const saved = await writeJson(tokenRel(h), applied.record);
      if (!saved) return { ok: false, error: "store_failed" };
      return { ok: true, record: applied.record, won: false };
    }
    if (existing.decision) {
      const same = applyIrissOfferLinkResponse(existing, action, text, nowIso, opts);
      if (!same.ok) return same;
      return { ok: true, record: existing, won: false };
    }
    const already = await readIrissOfferClaimedDecision(h);
    if (already) {
      if (!isIrissOfferLinkUsable(existing, nowMs)) return { ok: false, error: "unavailable" };
      const synced = withClaimedDecision(existing, already);
      await writeJson(tokenRel(h), synced);
      return { ok: true, record: synced, won: false };
    }
    const applied = applyIrissOfferLinkResponse(existing, action, text, nowIso, opts);
    if (!applied.ok) return applied;
    const claim = await claimIrissOfferDecision(h, action, applied.record.decidedAt);
    if (!claim.ok) return { ok: false, error: "store_failed" };
    const record = withClaimedDecision({ ...existing, decision: "", decidedAt: "" }, claim.claimed);
    // Lēmuma fails jau ir noteicošs; saites ierakstu atjauno admin skatiem kā līdz šim.
    await writeJson(tokenRel(h), record);
    return { ok: true, record, won: claim.won };
  });
}
