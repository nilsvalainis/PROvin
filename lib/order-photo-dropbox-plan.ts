/**
 * Pasūtījuma bildes -> pasūtījuma Dropbox mapē `Foto - <Avots>[ - <grupa>]/NN.jpg` (Nils 27.11: «neatkarīgi no tā, kur
 * esam ieguvuši bildes, tās jāievieto arī Dropbox mapē pie pasūtījuma»; «dokumenti mapes saknē, atsevišķās mapēs
 * tikai bildes ar datumu/avotu foldera nosaukumā»). Tīrs modulis: kuras bildes, kurā mapē, kas jau izdarīts.
 *
 * AutoDNA / CarVertical arhīva grupas (`archive`) šeit neiekļauj - tās saglabā `vendor-archive-photos-sync`
 * mapē `Foto - AutoDNA arhīvs <datums>` (tā pati numerācija kā līdz šim), otrā kopija nav vajadzīga.
 */

import { sanitizeDropboxName } from "@/lib/iriss-autoparks-dropbox-path";
import { dealerPhotoSrc } from "@/lib/dealer-photos";

/** Bilžu mapes prefikss pasūtījuma mapes saknē: «Foto - Autobid 12.10.2026». */
export const ORDER_PHOTO_DROPBOX_PREFIX = "Foto - ";
/** Automātiskie mēģinājumi vienai bildei; pēc tam tikai poga «Saglabāt visas Dropbox». */
export const ORDER_PHOTO_DROPBOX_MAX_ATTEMPTS = 6;
const BACKOFF_MS = [5, 15, 60, 180, 720, 1440].map((m) => m * 60_000);

/** Īsi, saprotami mapju nosaukumi (bez avotu bloku iekšējiem id). */
const BLOCK_FOLDER_LABEL: Record<string, string> = {
  csdd: "CSDD",
  tirgus: "Sludinājumu vēsture",
  autodna: "AutoDNA",
  carvertical: "CarVertical",
  carfax: "CARFAX",
  auto_records: "Dīlera dati",
  oneauto: "OneAuto",
  cc_vin: "Izsoles",
  asv: "ASV",
  tjekbil: "Dānija",
  finnik: "Nīderlande",
  mnt_ee: "MNT.EE",
  lkf_ee: "LKF.EE",
  carinfo: "Zviedrija",
  traficom_fi: "Somija",
  ltab: "LTAB",
  citi_avoti: "Citi avoti",
  listing_analysis: "Sludinājums",
};
export const INCIDENT_FOLDER_LABEL = "Negadījumi";

export type OrderPhotoDropboxItem = {
  photoId: string;
  /** Apakšmape pasūtījuma mapē (piem. «Foto - Autobid 12.10.2026», «Foto - ASV - Copart», «Foto - Negadījumi»). */
  folder: string;
  /** Faila nosaukums bez paplašinājuma («01», «02», ...). */
  baseName: string;
  sourceUrl?: string;
};

type RawPhoto = { id?: unknown; sourceUrl?: unknown };
type RawGroup = { title?: unknown; photos?: unknown; archive?: unknown };

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Bilžu mape: izsolēm grupas virsraksts jau ir «Avots datums»; pārējiem «Avots - virsraksts». */
export function orderPhotoDropboxFolder(blockKey: string, groupTitle: string): string {
  const label = blockKey === "incident" ? INCIDENT_FOLDER_LABEL : BLOCK_FOLDER_LABEL[blockKey] ?? blockKey.toUpperCase();
  const title = groupTitle.trim();
  const raw = blockKey === "cc_vin" && title ? title : title && title.toLowerCase() !== label.toLowerCase() ? `${label} - ${title}` : label;
  return `${ORDER_PHOTO_DROPBOX_PREFIX}${sanitizeDropboxName(raw, 80) || label}`;
}

function photosOf(raw: unknown): RawPhoto[] {
  return Array.isArray(raw) ? (raw.filter((p) => p && typeof p === "object") as RawPhoto[]) : [];
}

/**
 * Viena bloka grupas + plakanais saraksts (vecie melnraksti: bildes tikai `photos`, bez grupām).
 * `labelTitle` - citi_avoti sekcijas nosaukums (grupām bez virsraksta).
 */
function collectBlock(
  out: OrderPhotoDropboxItem[],
  seen: Set<string>,
  blockKey: string,
  block: { photoGroups?: unknown; photos?: unknown } | null | undefined,
  labelTitle = "",
): void {
  if (!block || typeof block !== "object") return;
  const counters = new Map<string, number>();
  const push = (photo: RawPhoto, folder: string) => {
    const id = str(photo.id);
    if (!id || seen.has(id) || !dealerPhotoSrc(id)) return;
    seen.add(id);
    const n = (counters.get(folder) ?? 0) + 1;
    counters.set(folder, n);
    const url = str(photo.sourceUrl);
    out.push({ photoId: id, folder, baseName: String(n).padStart(2, "0"), ...(url.startsWith("https://") ? { sourceUrl: url } : {}) });
  };
  const groups = Array.isArray(block.photoGroups) ? (block.photoGroups as RawGroup[]) : [];
  const archiveIds = new Set<string>();
  for (const g of groups) {
    if (!g || typeof g !== "object") continue;
    if (g.archive && typeof g.archive === "object") {
      for (const p of photosOf(g.photos)) archiveIds.add(str(p.id));
      continue;
    }
    const folder = orderPhotoDropboxFolder(blockKey, str(g.title) || labelTitle);
    for (const p of photosOf(g.photos)) push(p, folder);
  }
  const flatFolder = orderPhotoDropboxFolder(blockKey, labelTitle);
  for (const p of photosOf(block.photos)) {
    if (archiveIds.has(str(p.id))) continue;
    push(p, flatFolder);
  }
}

/** Visas pasūtījuma galeriju bildes (unikālas pēc id), secībā kā adminā. */
export function collectOrderPhotoDropboxItems(
  workspace: { sourceBlocks?: unknown; incidentPhotoGroups?: unknown; incidentPhotos?: unknown } | null | undefined,
): OrderPhotoDropboxItem[] {
  const out: OrderPhotoDropboxItem[] = [];
  const seen = new Set<string>();
  const blocks = workspace?.sourceBlocks && typeof workspace.sourceBlocks === "object"
    ? (workspace.sourceBlocks as Record<string, unknown>)
    : {};
  for (const [key, raw] of Object.entries(blocks)) {
    if (!raw || typeof raw !== "object") continue;
    if (key === "citi_avoti") {
      const sections = (raw as { sections?: unknown }).sections;
      if (!Array.isArray(sections)) continue;
      sections.forEach((section, i) => {
        if (!section || typeof section !== "object") return;
        const label = str((section as { label?: unknown }).label) || `${i + 1}`;
        collectBlock(out, seen, key, section as { photoGroups?: unknown; photos?: unknown }, label);
      });
      continue;
    }
    collectBlock(out, seen, key, raw as { photoGroups?: unknown; photos?: unknown });
    if (key === "listing_analysis") {
      const cover = (raw as { coverPhoto?: unknown }).coverPhoto;
      const coverId = cover && typeof cover === "object" ? str((cover as { id?: unknown }).id) : "";
      if (coverId) collectBlock(out, seen, key, { photos: [{ id: coverId }] }, "Titulbilde");
    }
  }
  collectBlock(out, seen, "incident", {
    photoGroups: workspace?.incidentPhotoGroups,
    photos: workspace?.incidentPhotos,
  });
  return out;
}

export type OrderPhotoDropboxItemState = {
  s: "ok" | "failed";
  /** Mape, kurā saglabāts / mēģināts. */
  f: string;
  /** Dropbox ceļš (ok). */
  p?: string;
  /** Dropbox content_hash. */
  h?: string;
  /** Mēģinājumu skaits. */
  n: number;
  e?: string;
  /** Nākamais automātiskais mēģinājums (ISO). */
  next?: string;
  at: string;
};

export type OrderPhotoDropboxRecord = {
  v: 1;
  sessionId: string;
  updatedAt: string;
  items: Record<string, OrderPhotoDropboxItemState>;
  /** Pasūtījuma mapi neizdevās atrast / izveidot. */
  folderError?: string;
};

export function emptyOrderPhotoDropboxRecord(sessionId: string, now = Date.now()): OrderPhotoDropboxRecord {
  return { v: 1, sessionId, updatedAt: new Date(now).toISOString(), items: {} };
}

export function parseOrderPhotoDropboxRecord(raw: unknown, sessionId: string): OrderPhotoDropboxRecord {
  const rec = emptyOrderPhotoDropboxRecord(sessionId);
  if (!raw || typeof raw !== "object") return rec;
  const o = raw as Record<string, unknown>;
  if (typeof o.updatedAt === "string") rec.updatedAt = o.updatedAt;
  if (typeof o.folderError === "string" && o.folderError) rec.folderError = o.folderError.slice(0, 120);
  const items = o.items && typeof o.items === "object" ? (o.items as Record<string, unknown>) : {};
  for (const [id, v] of Object.entries(items)) {
    if (!v || typeof v !== "object" || !dealerPhotoSrc(id)) continue;
    const x = v as Record<string, unknown>;
    if (x.s !== "ok" && x.s !== "failed") continue;
    rec.items[id] = {
      s: x.s,
      f: str(x.f),
      ...(str(x.p) ? { p: str(x.p) } : {}),
      ...(str(x.h) ? { h: str(x.h) } : {}),
      n: typeof x.n === "number" && Number.isFinite(x.n) ? x.n : 0,
      ...(str(x.e) ? { e: str(x.e).slice(0, 120) } : {}),
      ...(str(x.next) ? { next: str(x.next) } : {}),
      at: str(x.at),
    };
  }
  return rec;
}

/** Bildes, kuras jāsaglabā tagad. `force` (poga) - arī tās, kurām beigušies automātiskie mēģinājumi. */
export function pendingOrderPhotoDropboxItems(
  items: readonly OrderPhotoDropboxItem[],
  record: OrderPhotoDropboxRecord,
  now: number,
  force = false,
): OrderPhotoDropboxItem[] {
  return items.filter((item) => {
    const st = record.items[item.photoId];
    if (!st) return true;
    if (st.s === "ok") return false;
    if (force) return true;
    if (st.n >= ORDER_PHOTO_DROPBOX_MAX_ATTEMPTS) return false;
    const next = st.next ? Date.parse(st.next) : 0;
    return !Number.isFinite(next) || next <= now;
  });
}

export function orderPhotoDropboxFailure(
  prev: OrderPhotoDropboxItemState | undefined,
  folder: string,
  error: string,
  now: number,
): OrderPhotoDropboxItemState {
  const n = (prev?.s === "failed" ? prev.n : 0) + 1;
  const wait = BACKOFF_MS[Math.min(n - 1, BACKOFF_MS.length - 1)]!;
  return {
    s: "failed",
    f: folder,
    n,
    e: error.slice(0, 120),
    ...(n < ORDER_PHOTO_DROPBOX_MAX_ATTEMPTS ? { next: new Date(now + wait).toISOString() } : {}),
    at: new Date(now).toISOString(),
  };
}

export type OrderPhotoDropboxStatus = {
  /** Bildes pasūtījumā (M). */
  total: number;
  /** Saglabātas Dropbox (N). */
  saved: number;
  /** Neizdevās (vēl tiks mēģināts vai gaida pogu). */
  failed: number;
  /** Vēl nav mēģināts. */
  waiting: number;
  /** Kāda bilde vēl tiks mēģināta automātiski. */
  retryAt: string | null;
  folderError?: string;
};

export function orderPhotoDropboxStatus(
  items: readonly OrderPhotoDropboxItem[],
  record: OrderPhotoDropboxRecord,
): OrderPhotoDropboxStatus {
  let saved = 0;
  let failed = 0;
  let waiting = 0;
  let retryAt: string | null = null;
  for (const item of items) {
    const st = record.items[item.photoId];
    if (!st) waiting += 1;
    else if (st.s === "ok") saved += 1;
    else {
      failed += 1;
      if (st.next && (!retryAt || st.next < retryAt)) retryAt = st.next;
    }
  }
  return {
    total: items.length,
    saved,
    failed,
    waiting,
    retryAt,
    ...(record.folderError ? { folderError: record.folderError } : {}),
  };
}

/** Nākamais brīdis, kad cron jāatgriežas pie pasūtījuma (null - viss izdarīts vai gaida tikai pogu). */
export function orderPhotoDropboxNextAt(
  items: readonly OrderPhotoDropboxItem[],
  record: OrderPhotoDropboxRecord,
  now: number,
): string | null {
  let best: string | null = null;
  for (const item of items) {
    const st = record.items[item.photoId];
    if (st?.s === "ok") continue;
    if (!st) return new Date(now + BACKOFF_MS[0]!).toISOString();
    if (st.n >= ORDER_PHOTO_DROPBOX_MAX_ATTEMPTS || !st.next) continue;
    if (!best || st.next < best) best = st.next;
  }
  return best;
}

/** Nosaukumā tikai kārtas numurs + paplašinājums (bez personas datiem, bez ID). */
export function orderPhotoDropboxFileName(item: Pick<OrderPhotoDropboxItem, "baseName">, ext: string): string {
  const e = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
  return `${item.baseName}.${e}`;
}

/** Lai pēc katras automātiskās saglabāšanas nelasītu ierakstu: vai visi id jau zināmi kā saglabāti. */
export function allPhotoIdsSaved(ids: Iterable<string>, saved: ReadonlySet<string>): boolean {
  for (const id of ids) if (!saved.has(id)) return false;
  return true;
}
