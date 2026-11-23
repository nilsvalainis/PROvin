import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { del, get, list, put } from "@vercel/blob";
import {
  getOrderDraftBlobConfig,
  getOrderDraftStorageDir,
  isSafeOrderDraftSessionId,
} from "@/lib/admin-order-draft-store";
import { BLOB_CAS_ATTEMPTS, putBlobBodyIfMatch } from "@/lib/blob-if-match-put";
import { readPrivateBlobText } from "@/lib/blob-read";
import { compareAndSwap } from "@/lib/conditional-write";
import {
  AUCTION_ARCHIVE_TTL_DAYS,
  isAuctionArchiveHash,
  isAuctionArchiveToken,
  parseAuctionArchiveOfferDoc,
  type AuctionArchiveChannel,
  type AuctionArchiveOfferDoc,
  type AuctionArchivePhoto,
  type AuctionArchiveSummary,
} from "@/lib/auction-archive-offer";
import type { AppLocale } from "@/i18n/locales";

/**
 * Izsoļu arhīva piedāvājumu krātuve (privāts Blob / lokāli disks):
 * - `auction_archive_offers/<sessionId>.json` - piedāvājums, statuss, izvēle, žurnāls (tikai tokena hešs);
 * - `auction_archive_offer_tokens/<sha256>.json` - indekss hešs → sessionId;
 * - `auction_archive_offers/<sessionId>/photos/<id>.jpg` - visas izsoles bildes (kopija pie mums);
 * - `auction_archive_offers/<sessionId>/preview-<n>.jpg` - izplūdinātās e-pasta bildes.
 * Pats tokens nekur netiek saglabāts un netiek žurnālēts.
 */

const DOC_DIR = "auction_archive_offers";
const INDEX_DIR = "auction_archive_offer_tokens";
const TOKEN_BYTES = 32;
const PHOTO_ID_RE = /^ih_ph_[a-f0-9]{24}$/;

export function newAuctionArchiveToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashAuctionArchiveToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function hashesEqual(a: string, b: string): boolean {
  const x = Buffer.from(isAuctionArchiveHash(a) ? a : "0".repeat(64), "hex");
  const y = Buffer.from(isAuctionArchiveHash(b) ? b : "f".repeat(64), "hex");
  return timingSafeEqual(x, y) && isAuctionArchiveHash(a) && isAuctionArchiveHash(b);
}

function pfx(prefix: string): string {
  return prefix.endsWith("/") ? prefix : `${prefix}/`;
}

const docRel = (sessionId: string) => `${DOC_DIR}/${sessionId}.json`;
const indexRel = (hash: string) => `${INDEX_DIR}/${hash}.json`;
const photoRel = (sessionId: string, id: string) => `${DOC_DIR}/${sessionId}/photos/${id}.jpg`;
const previewRel = (sessionId: string, n: number) => `${DOC_DIR}/${sessionId}/preview-${n}.jpg`;

function localDir(): string | null {
  const dir = getOrderDraftStorageDir();
  return dir && process.env.VERCEL !== "1" ? dir : null;
}

/* ---------- Zemā līmeņa lasīšana/rakstīšana ---------- */

async function readText(rel: string): Promise<string | null> {
  const blob = getOrderDraftBlobConfig();
  if (blob) {
    try {
      const res = await get(`${pfx(blob.prefix)}${rel}`, { access: "private", token: blob.token, useCache: false });
      if (res?.statusCode === 200 && res.stream) return await new Response(res.stream).text();
    } catch {
      /* fall through */
    }
  }
  const dir = localDir();
  if (!dir) return null;
  try {
    return await fs.readFile(path.join(dir, rel), "utf8");
  } catch {
    return null;
  }
}

async function writeBody(rel: string, body: string | Buffer, contentType: string): Promise<boolean> {
  const blob = getOrderDraftBlobConfig();
  const dir = localDir();
  if (!blob && !dir) return false;
  let blobOk = false;
  let fsOk = false;
  if (blob) {
    try {
      await put(`${pfx(blob.prefix)}${rel}`, body, {
        access: "private",
        token: blob.token,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType,
      });
      blobOk = true;
    } catch {
      blobOk = false;
    }
  }
  if (dir) {
    try {
      const dest = path.join(dir, rel);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(`${dest}.tmp`, body);
      await fs.rename(`${dest}.tmp`, dest);
      fsOk = true;
    } catch {
      fsOk = false;
    }
  }
  if (process.env.VERCEL === "1") return blobOk;
  return blobOk || fsOk;
}

async function readBinary(rel: string): Promise<Buffer | null> {
  const blob = getOrderDraftBlobConfig();
  if (blob) {
    try {
      const res = await get(`${pfx(blob.prefix)}${rel}`, { access: "private", token: blob.token, useCache: false });
      if (res?.statusCode === 200 && res.stream) return Buffer.from(await new Response(res.stream).arrayBuffer());
    } catch {
      /* fall through */
    }
  }
  const dir = localDir();
  if (!dir) return null;
  try {
    return await fs.readFile(path.join(dir, rel));
  } catch {
    return null;
  }
}

async function removeRel(rels: readonly string[]): Promise<void> {
  const blob = getOrderDraftBlobConfig();
  if (blob && rels.length > 0) {
    for (let i = 0; i < rels.length; i += 100) {
      await del(rels.slice(i, i + 100).map((r) => `${pfx(blob.prefix)}${r}`), { token: blob.token }).catch(() => undefined);
    }
  }
  const dir = localDir();
  if (dir) {
    for (const r of rels) await fs.rm(path.join(dir, r), { force: true }).catch(() => undefined);
  }
}

/* ---------- Bildes ---------- */

function isJpeg(buf: Buffer | null): buf is Buffer {
  return Boolean(buf) && buf!.length >= 3 && buf![0] === 0xff && buf![1] === 0xd8 && buf![2] === 0xff;
}

export async function writeAuctionArchivePhoto(sessionId: string, id: string, jpeg: Buffer): Promise<boolean> {
  if (!isSafeOrderDraftSessionId(sessionId) || !PHOTO_ID_RE.test(id) || !isJpeg(jpeg)) return false;
  return writeBody(photoRel(sessionId, id), jpeg, "image/jpeg");
}

export async function readAuctionArchivePhoto(sessionId: string, id: string): Promise<Buffer | null> {
  if (!isSafeOrderDraftSessionId(sessionId) || !PHOTO_ID_RE.test(id)) return null;
  const buf = await readBinary(photoRel(sessionId, id));
  return isJpeg(buf) ? buf : null;
}

export async function writeAuctionArchivePreview(sessionId: string, n: number, jpeg: Buffer): Promise<boolean> {
  if (!isSafeOrderDraftSessionId(sessionId) || !Number.isInteger(n) || n < 0 || n > 1 || !isJpeg(jpeg)) return false;
  return writeBody(previewRel(sessionId, n), jpeg, "image/jpeg");
}

export async function readAuctionArchivePreview(sessionId: string, n: number): Promise<Buffer | null> {
  if (!isSafeOrderDraftSessionId(sessionId) || !Number.isInteger(n) || n < 0 || n > 1) return null;
  const buf = await readBinary(previewRel(sessionId, n));
  return isJpeg(buf) ? buf : null;
}

/* ---------- Dokuments ---------- */

export async function readAuctionArchiveOffer(sessionId: string): Promise<AuctionArchiveOfferDoc | null> {
  if (!isSafeOrderDraftSessionId(sessionId)) return null;
  const text = await readText(docRel(sessionId));
  if (!text) return null;
  try {
    return parseAuctionArchiveOfferDoc(JSON.parse(text), sessionId);
  } catch {
    return null;
  }
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

export type OfferUpdate<R> =
  | { next: AuctionArchiveOfferDoc; result: R }
  | { result: R };

/**
 * Atjauno piedāvājumu ar CAS (Blob `ifMatch`; lokāli - procesa slēdzene), lai klienta izvēle un
 * admina darbība vienlaicīgi nepazaudē viena otru.
 */
export async function updateAuctionArchiveOffer<R>(
  sessionId: string,
  fn: (cur: AuctionArchiveOfferDoc | null) => OfferUpdate<R>,
): Promise<R> {
  if (!isSafeOrderDraftSessionId(sessionId)) throw new Error("invalid_session");
  const blob = getOrderDraftBlobConfig();
  if (blob) {
    const pathname = `${pfx(blob.prefix)}${docRel(sessionId)}`;
    return compareAndSwap<AuctionArchiveOfferDoc | null, R>({
      read: async () => {
        const snap = await readPrivateBlobText({ pathname, token: blob.token });
        if (snap.state === "missing") return { value: null, etag: null };
        let value: AuctionArchiveOfferDoc | null = null;
        try {
          value = parseAuctionArchiveOfferDoc(JSON.parse(snap.text), sessionId);
        } catch {
          value = null;
        }
        return { value, etag: snap.etag };
      },
      write: async (next, etag) => {
        await putBlobBodyIfMatch({ pathname, body: JSON.stringify(next), token: blob.token, etag, seen: etag != null });
        const dir = localDir();
        if (dir) {
          const dest = path.join(dir, docRel(sessionId));
          await fs.mkdir(path.dirname(dest), { recursive: true }).catch(() => undefined);
          await fs.writeFile(dest, JSON.stringify(next), "utf8").catch(() => undefined);
        }
      },
      update: (cur) => fn(cur),
      maxAttempts: BLOB_CAS_ATTEMPTS,
    });
  }
  return withLock(sessionId, async () => {
    const decision = fn(await readAuctionArchiveOffer(sessionId));
    if ("next" in decision) {
      const ok = await writeBody(docRel(sessionId), JSON.stringify(decision.next), "application/json");
      if (!ok) throw new Error("store_failed");
    }
    return decision.result;
  });
}

export type CreateOfferInput = {
  sessionId: string;
  locale: AppLocale;
  channel: AuctionArchiveChannel;
  paidCents: number | null;
  summary: AuctionArchiveSummary;
  photos: AuctionArchivePhoto[];
  photosMissing: number;
  previewIds: string[];
  nowMs?: number;
};

export type CreateOfferResult =
  | { ok: true; token: string; doc: AuctionArchiveOfferDoc }
  | { ok: false; error: "invalid_session" | "already_chosen" | "closed" | "store_failed" };

/**
 * Jauns piedāvājums (vai atkārtots, kamēr klients nav izvēlējies): jauns tokens, vecā saite vairs nedarbojas.
 * Ja klients jau izvēlējās / PDF nosūtīts / atmaksāts - atsaka (izvēli nepārraksta).
 */
export async function createAuctionArchiveOffer(input: CreateOfferInput): Promise<CreateOfferResult> {
  const { sessionId } = input;
  if (!isSafeOrderDraftSessionId(sessionId)) return { ok: false, error: "invalid_session" };
  const nowMs = input.nowMs ?? Date.now();
  const token = newAuctionArchiveToken();
  const tokenHash = hashAuctionArchiveToken(token);
  const at = new Date(nowMs).toISOString();
  const indexed = await writeBody(indexRel(tokenHash), JSON.stringify({ sessionId, tokenHash }), "application/json");
  if (!indexed) return { ok: false, error: "store_failed" };
  let prevHash: string | null = null;
  try {
    const out = await updateAuctionArchiveOffer<CreateOfferResult>(sessionId, (cur) => {
      if (cur && (cur.status === "chose_archive" || cur.status === "chose_refund")) {
        return { result: { ok: false, error: "already_chosen" } };
      }
      if (cur && (cur.status === "archive_sent" || cur.status === "refunded")) {
        return { result: { ok: false, error: "closed" } };
      }
      prevHash = cur?.tokenHash ?? null;
      const ids = new Set(input.photos.map((p) => p.id));
      const doc: AuctionArchiveOfferDoc = {
        sessionId,
        status: "pending",
        tokenHash,
        createdAt: at,
        expiresAt: new Date(nowMs + AUCTION_ARCHIVE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
        locale: input.locale,
        channel: input.channel,
        paidCents: input.paidCents,
        summary: input.summary,
        photos: input.photos,
        photosMissing: Math.max(0, Math.floor(input.photosMissing)),
        previewIds: input.previewIds.filter((id) => ids.has(id)).slice(0, 2),
        history: [...(cur?.history ?? []), { at, event: "offer_sent" as const, channel: input.channel }].slice(-40),
      };
      return { next: doc, result: { ok: true, token, doc } };
    });
    if (!out.ok) await removeRel([indexRel(tokenHash)]);
    else if (prevHash && prevHash !== tokenHash) await removeRel([indexRel(prevHash)]);
    return out;
  } catch {
    await removeRel([indexRel(tokenHash)]);
    return { ok: false, error: "store_failed" };
  }
}

/**
 * Tokens → piedāvājums. Jebkurš cits iznākums (nav, cits tokens, kļūda) = null, lai lapa nevar
 * atšķirt «nav pasūtījuma» no «saite nomainīta». Derīgums/statuss - izsaucēja ziņā (lapai vajag
 * rādīt arī «jau nosūtīts»).
 */
export async function findAuctionArchiveOfferByToken(
  token: string,
): Promise<{ sessionId: string; doc: AuctionArchiveOfferDoc } | null> {
  if (!isAuctionArchiveToken(token)) return null;
  const hash = hashAuctionArchiveToken(token);
  const text = await readText(indexRel(hash));
  if (!text) return null;
  let sessionId = "";
  try {
    sessionId = String((JSON.parse(text) as Record<string, unknown>).sessionId ?? "");
  } catch {
    return null;
  }
  if (!isSafeOrderDraftSessionId(sessionId)) return null;
  const doc = await readAuctionArchiveOffer(sessionId);
  if (!doc || !hashesEqual(doc.tokenHash, hash)) return null;
  return { sessionId, doc };
}

/** Visi piedāvājumi (cron atgādinājumam). Tikai augšējā līmeņa JSON, bez bilžu mapēm. */
export async function listAuctionArchiveOfferSessionIds(max = 500): Promise<string[]> {
  const out: string[] = [];
  const re = /^([A-Za-z0-9_]+)\.json$/;
  const blob = getOrderDraftBlobConfig();
  if (blob) {
    const prefix = `${pfx(blob.prefix)}${DOC_DIR}/`;
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, token: blob.token, mode: "folded", cursor, limit: 1000 });
      for (const b of page.blobs) {
        const m = re.exec(b.pathname.slice(prefix.length));
        if (m && isSafeOrderDraftSessionId(m[1]!)) out.push(m[1]!);
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor && out.length < max);
    return out.slice(0, max);
  }
  const dir = localDir();
  if (!dir) return [];
  try {
    for (const name of await fs.readdir(path.join(dir, DOC_DIR))) {
      const m = re.exec(name);
      if (m && isSafeOrderDraftSessionId(m[1]!)) out.push(m[1]!);
    }
  } catch {
    /* nav mapes */
  }
  return out.slice(0, max);
}

/**
 * Dzēš piedāvājumu pilnībā (dokuments, tokena indekss, bilžu kopijas, priekšskatījumi).
 * Pasūtījums un «Izsoļu portālu arhīvs» bloks netiek aiztikts.
 */
export async function deleteAuctionArchiveOffer(sessionId: string): Promise<boolean> {
  if (!isSafeOrderDraftSessionId(sessionId)) return false;
  const doc = await readAuctionArchiveOffer(sessionId);
  const rels = [docRel(sessionId), previewRel(sessionId, 0), previewRel(sessionId, 1)];
  if (doc) {
    rels.push(indexRel(doc.tokenHash));
    for (const p of doc.photos) rels.push(photoRel(sessionId, p.id));
  }
  await removeRel(rels);
  return true;
}
