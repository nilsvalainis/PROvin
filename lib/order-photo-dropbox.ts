import "server-only";

/**
 * Pasūtījuma bilžu kopija pasūtījuma Dropbox mapē `Foto - <Avots>[ - <grupa>]/NN.jpg` (Nils 27.11).
 *
 * - Pēc katras melnraksta saglabāšanas (`patchOrderDraft`) fona solis (`after()`) saglabā jaunās bildes.
 *   Bildes pievienošanu tas nekad neaptur un neaizkavē.
 * - Kura bilde: 1) oriģināls, ko augšupielādes maršruts noglabāja pirms saspiešanas / ūdenszīmes aizklāšanas;
 *   2) avota `sourceUrl` (izsoles / TheCarApi) - pilnā izmērā; 3) galerijas JPEG (lielākais, kas ir).
 * - Dublikāti: tā pati bilde (Dropbox content_hash) vienā mapē netiek likta divreiz.
 * - Kļūdas: ierakstā `failed` + nākamais mēģinājums; cron (`dealer-data-sweep`) atkārto; poga «Saglabāt visas
 *   Dropbox» - visas uzreiz.
 * Ieraksts: {draft blob prefix}/order_photo_dropbox/<sessionId>.json; indekss: order_photo_dropbox/_pending.json.
 */

import fs from "fs/promises";
import path from "path";
import { del, get, put } from "@vercel/blob";

import { sniffImageKind, SNIFFED_IMAGE_EXT } from "@/lib/admin-photo-magic";
import { getOrderDraftBlobConfig, getOrderDraftStorageDir, isSafeOrderDraftSessionId, readOrderDraft } from "@/lib/admin-order-draft-store";
import { fetchAuctionPhotoOriginal } from "@/lib/auction-photo-fetch";
import { readDealerPhotoJpeg } from "@/lib/dealer-photos-server";
import { dealerPhotoSrc } from "@/lib/dealer-photos";
import { dropboxContentHash } from "@/lib/dropbox-content-hash";
import { DropboxApiError, getDropboxClient, isDropboxEnvConfigured, type DropboxClient } from "@/lib/dropbox-client";
import { currentOrderDropboxFolderPath, ensureOrderDropboxFolder } from "@/lib/order-dropbox";
import {
  allPhotoIdsSaved,
  collectOrderPhotoDropboxItems,
  emptyOrderPhotoDropboxRecord,
  orderPhotoDropboxFailure,
  orderPhotoDropboxFileName,
  orderPhotoDropboxNextAt,
  orderPhotoDropboxStatus,
  parseOrderPhotoDropboxRecord,
  pendingOrderPhotoDropboxItems,
  type OrderPhotoDropboxItem,
  type OrderPhotoDropboxRecord,
  type OrderPhotoDropboxStatus,
} from "@/lib/order-photo-dropbox-plan";

const LOG = "[order-photo-dropbox]";
const DIR = "order_photo_dropbox";
const ORIG_DIR = "order_photo_originals";
const INDEX_FILE = `${DIR}/_pending.json`;
const ORIGINAL_MAX_BYTES = 12 * 1024 * 1024;

function errCode(e: unknown): string {
  if (e instanceof DropboxApiError) return `dropbox_${e.status}${e.summary ? `:${e.summary.slice(0, 60)}` : ""}`;
  return e instanceof Error ? e.message.slice(0, 100) : "unknown";
}

/* ---------------- krātuve (Blob; lokāli - disks) ---------------- */

async function readBytes(file: string): Promise<Buffer | null> {
  const blob = getOrderDraftBlobConfig();
  if (blob) {
    try {
      const res = await get(`${blob.prefix}${file}`, { access: "private", token: blob.token, useCache: false });
      if (res?.statusCode === 200 && res.stream) return Buffer.from(await new Response(res.stream).arrayBuffer());
      if (!res) return null;
    } catch {
      if (process.env.VERCEL === "1") return null;
    }
  }
  const dir = getOrderDraftStorageDir();
  if (!dir || process.env.VERCEL === "1") return null;
  return fs.readFile(path.join(dir, file)).catch(() => null);
}

async function writeBytes(file: string, body: Buffer | string, contentType: string): Promise<void> {
  const blob = getOrderDraftBlobConfig();
  if (blob) {
    try {
      await put(`${blob.prefix}${file}`, body, {
        access: "private",
        token: blob.token,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType,
      });
      return;
    } catch (e) {
      if (process.env.VERCEL === "1") throw e;
    }
  }
  const dir = getOrderDraftStorageDir();
  if (!dir || process.env.VERCEL === "1") return;
  const fp = path.join(dir, file);
  await fs.mkdir(path.dirname(fp), { recursive: true });
  await fs.writeFile(fp, body);
}

async function deleteBytes(file: string): Promise<void> {
  const blob = getOrderDraftBlobConfig();
  if (blob) {
    await del(`${blob.prefix}${file}`, { token: blob.token }).catch(() => undefined);
    if (process.env.VERCEL === "1") return;
  }
  const dir = getOrderDraftStorageDir();
  if (dir && process.env.VERCEL !== "1") await fs.unlink(path.join(dir, file)).catch(() => undefined);
}

export async function readOrderPhotoDropboxRecord(sessionId: string): Promise<OrderPhotoDropboxRecord> {
  const buf = await readBytes(`${DIR}/${sessionId}.json`);
  if (!buf) return emptyOrderPhotoDropboxRecord(sessionId);
  try {
    return parseOrderPhotoDropboxRecord(JSON.parse(buf.toString("utf8")), sessionId);
  } catch {
    return emptyOrderPhotoDropboxRecord(sessionId);
  }
}

async function writeRecord(rec: OrderPhotoDropboxRecord): Promise<void> {
  await writeBytes(`${DIR}/${rec.sessionId}.json`, JSON.stringify(rec), "application/json");
}

type PendingIndex = { sessionId: string; nextAt: string }[];

async function readIndex(): Promise<PendingIndex> {
  const buf = await readBytes(INDEX_FILE);
  if (!buf) return [];
  try {
    const raw = JSON.parse(buf.toString("utf8")) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (r): r is { sessionId: string; nextAt: string } =>
        Boolean(r) && typeof r.sessionId === "string" && isSafeOrderDraftSessionId(r.sessionId) && typeof r.nextAt === "string",
    );
  } catch {
    return [];
  }
}

async function setIndexEntry(sessionId: string, nextAt: string | null): Promise<void> {
  const rows = await readIndex();
  const idx = rows.findIndex((r) => r.sessionId === sessionId);
  if (!nextAt && idx < 0) return;
  if (nextAt && idx >= 0 && rows[idx]!.nextAt === nextAt) return;
  const next = rows.filter((r) => r.sessionId !== sessionId);
  if (nextAt) next.push({ sessionId, nextAt });
  await writeBytes(INDEX_FILE, JSON.stringify(next.slice(-500)), "application/json");
}

/* ---------------- oriģināli (pirms saspiešanas) ---------------- */

function originalFile(sessionId: string, photoId: string): string {
  return `${ORIG_DIR}/${sessionId}/${photoId}`;
}

/**
 * Augšupielādes maršruts: noglabā saņemto failu (pirms saspiešanas līdz ~320 KB un ūdenszīmes aizklāšanas), lai
 * Dropbox nonāktu pilnā izmēra bilde. Tikai, ja tas ir lielāks par galerijas JPEG. Pēc Dropbox saglabāšanas dzēš.
 * Nekad nemet kļūdu.
 */
export async function stashOrderPhotoOriginal(
  sessionId: string,
  photoId: string,
  original: Uint8Array,
  storedBytes: number,
): Promise<void> {
  if (!isDropboxEnvConfigured() || !isSafeOrderDraftSessionId(sessionId) || !dealerPhotoSrc(photoId)) return;
  if (original.length <= storedBytes || original.length > ORIGINAL_MAX_BYTES || !sniffImageKind(original)) return;
  try {
    await writeBytes(originalFile(sessionId, photoId), Buffer.from(original), "application/octet-stream");
  } catch (e) {
    console.warn(`${LOG} stash failed`, { sessionId: sessionId.slice(-8), error: errCode(e) });
  }
}

type PhotoBytes = { bytes: Uint8Array; ext: string; origin: "original" | "source" | "gallery" };

function withExt(buf: Uint8Array, origin: PhotoBytes["origin"]): PhotoBytes | null {
  const kind = sniffImageKind(buf);
  if (!kind) return null;
  return { bytes: buf, ext: SNIFFED_IMAGE_EXT[kind], origin };
}

async function photoBytes(sessionId: string, item: OrderPhotoDropboxItem, deadlineAt: number): Promise<PhotoBytes | null> {
  const stashed = await readBytes(originalFile(sessionId, item.photoId));
  const fromStash = stashed ? withExt(stashed, "original") : null;
  if (fromStash) return fromStash;
  if (item.sourceUrl && deadlineAt - Date.now() > 20_000) {
    const res = await fetchAuctionPhotoOriginal(item.sourceUrl, Math.min(deadlineAt - 10_000, Date.now() + 25_000)).catch(() => null);
    const fromSource = res?.ok ? withExt(res.bytes, "source") : null;
    if (fromSource) return fromSource;
  }
  const gallery = await readDealerPhotoJpeg(sessionId, item.photoId).catch(() => null);
  return gallery ? withExt(gallery, "gallery") : null;
}

/* ---------------- sinhronizācija ---------------- */

async function mapPool<T>(items: readonly T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        await fn(items[i]!);
      }
    }),
  );
}

/**
 * Pasūtījuma mape (tas pats mehānisms kā dokumentiem: `materialize` - dīlera datiem mape rodas pie pirmā faila).
 * Vecajiem pasūtījumiem bez mapes ieraksta (pirms 23.11) - null.
 */
async function orderFolder(sessionId: string, client: DropboxClient): Promise<string | null> {
  const rec = await ensureOrderDropboxFolder(sessionId, { client, materialize: true });
  if (!rec || rec.state !== "ok" || !rec.path) return null;
  return (await currentOrderDropboxFolderPath(client, rec)) || null;
}

export type OrderPhotoDropboxSyncResult = OrderPhotoDropboxStatus & {
  uploaded: number;
  duplicates: number;
  /** Termiņš beidzās - daļa palika nākamajai reizei. */
  partial: boolean;
  folder: string | null;
  skipped?: "not_configured" | "no_photos" | "nothing_to_do" | "no_folder" | "busy";
};

/** Šīs instances atmiņa: kuras bildes jau zināmas kā saglabātas (lai autosave nelasītu ierakstu katru reizi). */
const savedMemo = new Map<string, Set<string>>();
const running = new Map<string, Promise<OrderPhotoDropboxSyncResult>>();
const rerun = new Set<string>();

function rememberSaved(sessionId: string, rec: OrderPhotoDropboxRecord): void {
  const ids = new Set(Object.entries(rec.items).filter(([, v]) => v.s === "ok").map(([k]) => k));
  savedMemo.set(sessionId, ids);
  if (savedMemo.size > 200) savedMemo.delete(savedMemo.keys().next().value as string);
}

export async function syncOrderPhotosToDropbox(
  sessionId: string,
  opts: { deadlineAt?: number; force?: boolean; client?: DropboxClient | null; now?: number } = {},
): Promise<OrderPhotoDropboxSyncResult> {
  const now = opts.now ?? Date.now();
  const deadlineAt = opts.deadlineAt ?? now + 50_000;
  const empty = (status: OrderPhotoDropboxStatus, skipped: OrderPhotoDropboxSyncResult["skipped"], folder: string | null = null) => ({
    ...status,
    uploaded: 0,
    duplicates: 0,
    partial: false,
    folder,
    ...(skipped ? { skipped } : {}),
  });
  const draft = await readOrderDraft(sessionId).catch(() => null);
  const items = collectOrderPhotoDropboxItems(draft?.workspace ?? null);
  const record = await readOrderPhotoDropboxRecord(sessionId);
  rememberSaved(sessionId, record);
  const client = opts.client === undefined ? getDropboxClient() : opts.client;
  if (!client) return empty(orderPhotoDropboxStatus(items, record), "not_configured");
  if (!items.length) {
    await setIndexEntry(sessionId, null).catch(() => undefined);
    return empty(orderPhotoDropboxStatus(items, record), "no_photos");
  }
  const todo = pendingOrderPhotoDropboxItems(items, record, now, opts.force === true);
  if (!todo.length) {
    await setIndexEntry(sessionId, orderPhotoDropboxNextAt(items, record, now)).catch(() => undefined);
    return empty(orderPhotoDropboxStatus(items, record), "nothing_to_do");
  }

  // Mapes nav (vecs pasūtījums bez mapes ieraksta): katrā autosave nemēģina no jauna - ik 15 min vai ar pogu.
  if (record.folderError && !opts.force && now - Date.parse(record.updatedAt) < 15 * 60_000) {
    return empty(orderPhotoDropboxStatus(items, record), "no_folder");
  }
  const base = await orderFolder(sessionId, client).catch((e) => {
    console.warn(`${LOG} folder failed`, { sessionId: sessionId.slice(-8), error: errCode(e) });
    return null;
  });
  if (!base) {
    const fresh = await readOrderPhotoDropboxRecord(sessionId);
    fresh.folderError = "Pasūtījuma Dropbox mape nav pieejama";
    fresh.updatedAt = new Date(now).toISOString();
    await writeRecord(fresh).catch(() => undefined);
    await setIndexEntry(sessionId, new Date(now + 15 * 60_000).toISOString()).catch(() => undefined);
    return empty(orderPhotoDropboxStatus(items, fresh), "no_folder");
  }
  const root = base;

  // Esošie faili katrā mapē: dublikātu pārbaude pēc Dropbox content_hash.
  const hashes = new Map<string, Map<string, string>>();
  for (const folder of new Set(todo.map((t) => t.folder))) {
    const m = new Map<string, string>();
    try {
      const { entries } = await client.listAll(`${root}/${folder}`, { maxPages: 10 });
      for (const e of entries) if (e.tag === "file" && e.contentHash) m.set(e.contentHash, e.pathDisplay);
    } catch {
      /* mapes vēl nav */
    }
    hashes.set(folder, m);
  }

  const updates = new Map<string, OrderPhotoDropboxRecord["items"][string]>();
  let uploaded = 0;
  let duplicates = 0;
  let partial = false;
  await mapPool(todo, 4, async (item) => {
    if (Date.now() > deadlineAt - 8_000) {
      partial = true;
      return;
    }
    const prev = record.items[item.photoId];
    const at = new Date().toISOString();
    try {
      const got = await photoBytes(sessionId, item, deadlineAt);
      if (!got) {
        updates.set(item.photoId, orderPhotoDropboxFailure(prev, item.folder, "bilde nav atrodama", Date.now()));
        return;
      }
      const h = dropboxContentHash(got.bytes);
      const inFolder = hashes.get(item.folder)!;
      const existing = inFolder.get(h);
      if (existing) {
        duplicates += 1;
        updates.set(item.photoId, { s: "ok", f: item.folder, p: existing, h, n: (prev?.n ?? 0) + 1, at });
      } else {
        const target = `${root}/${item.folder}/${orderPhotoDropboxFileName(item, got.ext)}`;
        inFolder.set(h, target); // paralēls tās pašas bildes eksemplārs šajā palaišanā
        const up = await client.upload(target, got.bytes, "add", { autorename: true });
        inFolder.set(h, up.pathDisplay || target);
        uploaded += 1;
        updates.set(item.photoId, { s: "ok", f: item.folder, p: up.pathDisplay || target, h, n: (prev?.n ?? 0) + 1, at });
      }
      if (got.origin === "original") await deleteBytes(originalFile(sessionId, item.photoId));
    } catch (e) {
      console.warn(`${LOG} upload failed`, { sessionId: sessionId.slice(-8), error: errCode(e) });
      updates.set(item.photoId, orderPhotoDropboxFailure(prev, item.folder, errCode(e), Date.now()));
    }
  });

  // Svaigs nolasījums pirms rakstīšanas: paralēla palaišana (cita instance) varēja ierakstīt savas bildes.
  const fresh = await readOrderPhotoDropboxRecord(sessionId);
  for (const [id, st] of updates) {
    if (fresh.items[id]?.s === "ok" && st.s !== "ok") continue;
    fresh.items[id] = st;
  }
  delete fresh.folderError;
  fresh.updatedAt = new Date().toISOString();
  if (updates.size) await writeRecord(fresh).catch((e) => console.warn(`${LOG} record write failed`, errCode(e)));
  rememberSaved(sessionId, fresh);
  const nextAt = partial ? new Date(Date.now() + 5 * 60_000).toISOString() : orderPhotoDropboxNextAt(items, fresh, Date.now());
  await setIndexEntry(sessionId, nextAt).catch(() => undefined);
  return { ...orderPhotoDropboxStatus(items, fresh), uploaded, duplicates, partial, folder: root };
}

/** Viena palaišana vienam pasūtījumam šajā instancē; ja nāk vēl viena - izpilda vēlreiz pēc pašreizējās. */
export function syncOrderPhotosToDropboxOnce(
  sessionId: string,
  opts: Parameters<typeof syncOrderPhotosToDropbox>[1] = {},
): Promise<OrderPhotoDropboxSyncResult> {
  const cur = running.get(sessionId);
  if (cur) {
    rerun.add(sessionId);
    return cur;
  }
  const p = (async () => {
    try {
      let res = await syncOrderPhotosToDropbox(sessionId, opts);
      while (rerun.delete(sessionId)) res = await syncOrderPhotosToDropbox(sessionId, { ...opts, force: false });
      return res;
    } finally {
      running.delete(sessionId);
    }
  })();
  running.set(sessionId, p);
  return p;
}

/**
 * Pēc melnraksta saglabāšanas (fona solis). Ja šī instance jau zina, ka visas bildes saglabātas - nekādu I/O.
 * Kļūdas tikai logā.
 */
export function scheduleOrderPhotoDropboxSync(
  sessionId: string,
  workspace?: { sourceBlocks?: unknown; incidentPhotoGroups?: unknown; incidentPhotos?: unknown } | null,
): void {
  if (!isDropboxEnvConfigured() || !isSafeOrderDraftSessionId(sessionId)) return;
  if (workspace) {
    const ids = collectOrderPhotoDropboxItems(workspace).map((i) => i.photoId);
    if (!ids.length) return;
    const memo = savedMemo.get(sessionId);
    if (memo && allPhotoIdsSaved(ids, memo)) return;
  }
  const run = () =>
    syncOrderPhotosToDropboxOnce(sessionId).then(
      () => undefined,
      (e) => console.error(`${LOG} sync crashed`, { sessionId: sessionId.slice(-8), error: errCode(e) }),
    );
  void import("next/server")
    .then(({ after }) => {
      try {
        after(run);
      } catch {
        void run(); // ārpus pieprasījuma (skripts / tests)
      }
    })
    .catch(() => void run());
}

/** Cron solis: pasūtījumi, kuriem pienācis atkārtojums. */
export async function sweepOrderPhotoDropbox(opts: { deadlineAt: number; maxOrders?: number; now?: number }): Promise<{
  waiting: number;
  processed: { sessionId: string; saved: number; total: number; failed: number }[];
}> {
  if (!isDropboxEnvConfigured()) return { waiting: 0, processed: [] };
  const now = opts.now ?? Date.now();
  const rows = await readIndex();
  const due = rows.filter((r) => Date.parse(r.nextAt) <= now).slice(0, opts.maxOrders ?? 2);
  const processed: { sessionId: string; saved: number; total: number; failed: number }[] = [];
  for (const row of due) {
    if (Date.now() > opts.deadlineAt - 15_000) break;
    try {
      const r = await syncOrderPhotosToDropboxOnce(row.sessionId, { deadlineAt: opts.deadlineAt });
      processed.push({ sessionId: row.sessionId.slice(-8), saved: r.saved, total: r.total, failed: r.failed });
    } catch (e) {
      console.warn(`${LOG} sweep failed`, { sessionId: row.sessionId.slice(-8), error: errCode(e) });
      await setIndexEntry(row.sessionId, new Date(now + 60 * 60_000).toISOString()).catch(() => undefined);
    }
  }
  return { waiting: rows.length, processed };
}

/** Admin statuss «Dropbox: N/M» (tikai lasa). */
export async function readOrderPhotoDropboxStatus(sessionId: string): Promise<OrderPhotoDropboxStatus & { configured: boolean }> {
  const draft = await readOrderDraft(sessionId).catch(() => null);
  const items = collectOrderPhotoDropboxItems(draft?.workspace ?? null);
  const record = await readOrderPhotoDropboxRecord(sessionId);
  return { ...orderPhotoDropboxStatus(items, record), configured: isDropboxEnvConfigured() };
}
