import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";
import {
  getOrderDraftBlobConfig,
  getOrderDraftStorageDir,
  isSafeOrderDraftSessionId,
  readOrderDraft,
} from "@/lib/admin-order-draft-store";
import { readClientReportSends } from "@/lib/client-report-sends";
import type { ClientReportSend } from "@/lib/client-report-sends-core";
import {
  appendClientReportLink,
  CLIENT_REPORT_LINK_TOKEN_BYTES,
  clientReportLinkTtlDays,
  clientReportLinkState,
  clientReportPdfBlobPath,
  isClientReportLinkHash,
  isClientReportLinkToken,
  isSafeClientReportArchiveBlobPath,
  parseClientReportLinkDoc,
  resolveClientReportLinkLocale,
  revokeActiveLinks,
  safeClientReportPdfFilename,
  type ClientReportLinkDoc,
  type ClientReportLinkRecord,
} from "@/lib/client-report-link";
import type { AppLocale } from "@/i18n/locales";

/**
 * Klienta atskaites saišu krātuve (privāts Blob / lokāli disks).
 * - `client_report_links/<sessionId>.json` - pasūtījuma saišu vēsture (tikai heši);
 * - `client_report_link_tokens/<sha256>.json` - indekss hešs → sessionId.
 * Pats tokens nekur netiek saglabāts un netiek žurnālēts.
 */

const DOC_DIR = "client_report_links";
const INDEX_DIR = "client_report_link_tokens";

export function newClientReportLinkToken(): string {
  return randomBytes(CLIENT_REPORT_LINK_TOKEN_BYTES).toString("base64url");
}

export function hashClientReportLinkToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Hešu salīdzināšana konstantā laikā. */
export function clientReportLinkHashesEqual(a: string, b: string): boolean {
  const x = Buffer.from(isClientReportLinkHash(a) ? a : "0".repeat(64), "hex");
  const y = Buffer.from(isClientReportLinkHash(b) ? b : "f".repeat(64), "hex");
  return timingSafeEqual(x, y) && isClientReportLinkHash(a) && isClientReportLinkHash(b);
}

const locks = new Map<string, Promise<unknown>>();
function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(fn);
  locks.set(key, next);
  void next.finally(() => {
    if (locks.get(key) === next) locks.delete(key);
  });
  return next;
}

function pfx(prefix: string): string {
  return prefix.endsWith("/") ? prefix : `${prefix}/`;
}

async function readJson(rel: string): Promise<unknown | null> {
  const blob = getOrderDraftBlobConfig();
  if (blob) {
    try {
      const res = await get(`${pfx(blob.prefix)}${rel}`, { access: "private", token: blob.token, useCache: false });
      if (res?.statusCode === 200 && res.stream) return JSON.parse(await new Response(res.stream).text()) as unknown;
    } catch {
      /* fall through */
    }
  }
  const dir = getOrderDraftStorageDir();
  if (dir && process.env.VERCEL !== "1") {
    try {
      return JSON.parse(await fs.readFile(path.join(dir, rel), "utf8")) as unknown;
    } catch {
      return null;
    }
  }
  return null;
}

async function writeJson(rel: string, doc: unknown): Promise<boolean> {
  const raw = JSON.stringify(doc);
  const dir = getOrderDraftStorageDir();
  const blob = getOrderDraftBlobConfig();
  if (!dir && !blob) return false;
  if (process.env.VERCEL === "1" && !blob) return false;
  let fsOk = false;
  let blobOk = false;
  if (dir && process.env.VERCEL !== "1") {
    try {
      const dest = path.join(dir, rel);
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
      await put(`${pfx(blob.prefix)}${rel}`, raw, {
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

const docRel = (sessionId: string) => `${DOC_DIR}/${sessionId}.json`;
const indexRel = (hash: string) => `${INDEX_DIR}/${hash}.json`;

export async function readClientReportLinkDoc(sessionId: string): Promise<ClientReportLinkDoc | null> {
  if (!isSafeOrderDraftSessionId(sessionId)) return null;
  return parseClientReportLinkDoc(await readJson(docRel(sessionId)), sessionId);
}

export async function createClientReportLink(
  sessionId: string,
  opts: { locale: AppLocale; pdfVersion?: number | null; nowMs?: number },
): Promise<{ ok: true; token: string; record: ClientReportLinkRecord } | { ok: false; error: string }> {
  if (!isSafeOrderDraftSessionId(sessionId)) return { ok: false, error: "invalid_session" };
  return withLock(sessionId, async () => {
    const nowMs = opts.nowMs ?? Date.now();
    const token = newClientReportLinkToken();
    const tokenHash = hashClientReportLinkToken(token);
    const record: ClientReportLinkRecord = {
      tokenHash,
      createdAt: new Date(nowMs).toISOString(),
      expiresAt: new Date(nowMs + clientReportLinkTtlDays() * 24 * 60 * 60 * 1000).toISOString(),
      locale: opts.locale,
      ...(opts.pdfVersion && opts.pdfVersion > 0 ? { pdfVersionAtCreate: opts.pdfVersion } : {}),
    };
    const prev = (await readClientReportLinkDoc(sessionId)) ?? { sessionId, links: [] };
    const indexed = await writeJson(indexRel(tokenHash), { sessionId, tokenHash });
    if (!indexed) return { ok: false, error: "store_failed" };
    const saved = await writeJson(docRel(sessionId), appendClientReportLink(prev, record, nowMs));
    if (!saved) return { ok: false, error: "store_failed" };
    return { ok: true, token, record };
  });
}

export async function revokeClientReportLinks(
  sessionId: string,
  nowMs = Date.now(),
): Promise<{ ok: true; doc: ClientReportLinkDoc } | { ok: false; error: string }> {
  if (!isSafeOrderDraftSessionId(sessionId)) return { ok: false, error: "invalid_session" };
  return withLock(sessionId, async () => {
    const prev = (await readClientReportLinkDoc(sessionId)) ?? { sessionId, links: [] };
    const next = revokeActiveLinks(prev, nowMs);
    const saved = await writeJson(docRel(sessionId), next);
    if (!saved) return { ok: false, error: "store_failed" };
    return { ok: true, doc: next };
  });
}

/**
 * Tokens → derīgs ieraksts. Jebkurš cits iznākums (nav, beidzies, atsaukts, kļūda) = null,
 * lai lapa nevarētu atšķirt «nav pasūtījuma» no «saite beigusies».
 */
export async function findUsableClientReportLink(
  token: string,
  nowMs = Date.now(),
): Promise<{ sessionId: string; record: ClientReportLinkRecord } | null> {
  if (!isClientReportLinkToken(token)) return null;
  const hash = hashClientReportLinkToken(token);
  const idx = await readJson(indexRel(hash));
  if (!idx || typeof idx !== "object") return null;
  const sessionId = String((idx as Record<string, unknown>).sessionId ?? "");
  if (!isSafeOrderDraftSessionId(sessionId)) return null;
  const doc = await readClientReportLinkDoc(sessionId);
  let hit: ClientReportLinkRecord | null = null;
  for (const l of doc?.links ?? []) {
    // Visus ierakstus salīdzina līdz galam (bez agras izejas).
    if (clientReportLinkHashesEqual(l.tokenHash, hash)) hit = l;
  }
  if (!hit || clientReportLinkState(hit, nowMs) !== "active") return null;
  return { sessionId, record: hit };
}

/* ---------- PDF ---------- */

export type ClientReportPdfInfo = {
  available: boolean;
  /** Nosūtīto servera versiju skaits (0, ja sūtīts tikai ar pielikumu). */
  version: number;
  sentAt: string | null;
  filename: string;
  /** Pēdējā servera sūtījuma valoda (saites lapas noklusējums). */
  lang: AppLocale;
};

function latestArchivedSend(sends: readonly ClientReportSend[]): ClientReportSend | null {
  let best: ClientReportSend | null = null;
  for (const s of sends) {
    if (!s.archivePath) continue;
    if (!best || (Number(s.version) || 0) > (Number(best.version) || 0)) best = s;
  }
  return best;
}

function maxIso(a: string | null | undefined, b: string | null | undefined): string | null {
  const ta = Date.parse(String(a ?? ""));
  const tb = Date.parse(String(b ?? ""));
  if (!Number.isFinite(ta) && !Number.isFinite(tb)) return null;
  if (!Number.isFinite(tb)) return a!;
  if (!Number.isFinite(ta)) return b!;
  return ta >= tb ? a! : b!;
}

/** Vai pasūtījumam ir klientam nosūtīts PDF (bez faila lasīšanas). */
export async function readClientReportPdfInfo(sessionId: string): Promise<ClientReportPdfInfo> {
  const none: ClientReportPdfInfo = { available: false, version: 0, sentAt: null, filename: "PROVIN_atskaite.pdf", lang: "lv" };
  if (!isSafeOrderDraftSessionId(sessionId)) return none;
  const [draft, sends] = await Promise.all([
    readOrderDraft(sessionId).catch(() => null),
    readClientReportSends(sessionId).catch(() => [] as ClientReportSend[]),
  ]);
  const readyAt = draft?.clientReportReadyAt?.trim() || null;
  const last = latestArchivedSend(sends);
  const available = Boolean(readyAt) || Boolean(last);
  if (!available) return none;
  return {
    available,
    version: sends.length,
    sentAt: maxIso(readyAt, last?.sentAt ?? null),
    filename: safeClientReportPdfFilename(draft?.clientReportFilename || last?.filename || ""),
    lang: resolveClientReportLinkLocale(last?.lang ?? "lv"),
  };
}

async function readPrivateBlob(pathname: string): Promise<Uint8Array | null> {
  const blob = getOrderDraftBlobConfig();
  if (!blob) return null;
  try {
    const res = await get(pathname, { access: "private", token: blob.token, useCache: false });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    return new Uint8Array(await new Response(res.stream).arrayBuffer());
  } catch {
    return null;
  }
}

async function readDiskWithin(baseDir: string, target: string): Promise<Uint8Array | null> {
  const base = path.resolve(baseDir) + path.sep;
  const resolved = path.resolve(target);
  if (!resolved.startsWith(base) || !resolved.toLowerCase().endsWith(".pdf")) return null;
  try {
    return new Uint8Array(await fs.readFile(resolved));
  } catch {
    return null;
  }
}

/**
 * Jaunākais klientam nosūtītais PDF. Ceļi tiek būvēti tikai no `sessionId` (servera ieraksts),
 * versiju arhīva ceļš no žurnāla tiek pārbaudīts, ka tas ir šī pasūtījuma mapē.
 * 1) `client-reports/<sessionId>.pdf` - pārrakstās ar katru sūtījumu (vienmēr jaunākais);
 * 2) rezerve: jaunākā versija `client-reports/<sessionId>/v<N>-*.pdf`.
 */
export async function readLatestClientReportPdf(sessionId: string): Promise<Uint8Array | null> {
  if (!isSafeOrderDraftSessionId(sessionId)) return null;
  const blob = getOrderDraftBlobConfig();
  const dir = getOrderDraftStorageDir();
  if (blob) {
    const main = await readPrivateBlob(clientReportPdfBlobPath(blob.prefix, sessionId));
    if (main) return main;
  }
  if (dir && process.env.VERCEL !== "1") {
    const main = await readDiskWithin(path.join(dir, "client-reports"), path.join(dir, "client-reports", `${sessionId}.pdf`));
    if (main) return main;
  }
  const last = latestArchivedSend(await readClientReportSends(sessionId).catch(() => []));
  const p = last?.archivePath ?? "";
  if (!p) return null;
  if (blob && isSafeClientReportArchiveBlobPath(p, blob.prefix, sessionId)) return readPrivateBlob(p);
  if (!blob && dir && process.env.VERCEL !== "1") {
    return readDiskWithin(path.join(dir, "client-reports", sessionId), p);
  }
  return null;
}
