/**
 * TheCarApi bildes tajā pašā JPEG krātuvē, kur citas izsoļu bildes (`cc-vin-photos`).
 * CDN lejupielāde nav TheCarApi API izsaukums. Dedup pēc URL un satura hash.
 */
import "server-only";

import { CC_VIN_PHOTO_MAX_BYTES, makeCcVinPhotoId, writeCcVinPhotoJpeg } from "@/lib/admin-cc-vin-photo-store";
import { fetchAuctionPhotoJpegs, type AuctionPhotoFetchOk } from "@/lib/auction-photo-fetch";
import { makeCcVinPhotoGroupId, type CcVinPhotoGroup } from "@/lib/cc-vin-photo-types";
import { thecarapiGalleryTitle, thecarapiTrustedImageUrls, type ThecarapiAdminRecord, type ThecarapiStoredPhoto } from "@/lib/vin-scan/thecarapi-fields";

export function thecarapiArchivePhotoSession(vin: string): string {
  const clean = vin.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 17);
  return clean ? `tc${clean}` : "";
}

export type ThecarapiGalleryWrite = (sessionId: string, photoId: string, jpeg: Buffer) => Promise<void>;
export type ThecarapiGalleryFetch = (
  urls: readonly string[],
  maxBytes: number,
  deadline?: number,
  /** Saites no TheCarApi `auction-images` (hosts ārpus allowlist). */
  trustedUrls?: ReadonlySet<string>,
) => Promise<{ ok: AuctionPhotoFetchOk[]; failed: { url: string; reason?: string }[] }>;

/** Pasūtījuma/arhīva rakstīšanas paralēlisms (Blob PUT). */
const GALLERY_WRITE_PARALLEL = 6;

type PlannedWrite = { sessionId: string; id: string; jpeg: Buffer };

/** Dedup lēmums sinhroni (secība kā agrāk); pats ieraksts vēlāk paralēli. */
function planOnce(
  planned: PlannedWrite[],
  sessionId: string,
  knownUrls: Set<string>,
  knownHashes: Set<string>,
  row: AuctionPhotoFetchOk,
  meta: Omit<ThecarapiStoredPhoto, "id">,
  idByUrl: Map<string, string>,
): ThecarapiStoredPhoto | null {
  if (!sessionId) return null;
  const existing = idByUrl.get(row.url);
  if (existing) return { ...meta, id: existing };
  if (knownUrls.has(row.url) || knownHashes.has(row.contentHash)) return null;
  const id = makeCcVinPhotoId();
  planned.push({ sessionId, id, jpeg: row.jpeg });
  knownUrls.add(row.url);
  knownHashes.add(row.contentHash);
  idByUrl.set(row.url, id);
  return { ...meta, id };
}

async function runWrites(writeJpeg: ThecarapiGalleryWrite, planned: readonly PlannedWrite[]): Promise<Set<string>> {
  const failed = new Set<string>();
  let next = 0;
  const workers = Array.from({ length: Math.min(GALLERY_WRITE_PARALLEL, planned.length) }, async () => {
    while (next < planned.length) {
      const item = planned[next]!;
      next += 1;
      try {
        await writeJpeg(item.sessionId, item.id, item.jpeg);
      } catch {
        failed.add(item.id);
      }
    }
  });
  await Promise.all(workers);
  return failed;
}

export async function storeThecarapiGallery(opts: {
  vin: string;
  sessionId?: string;
  records: readonly ThecarapiAdminRecord[];
  existing?: CcVinPhotoGroup[] | null;
  fetchJpegs?: ThecarapiGalleryFetch;
  writeJpeg?: ThecarapiGalleryWrite;
  /** Epoch ms: pēc tā bildes vairs nelejupielādē (CDN), atgriež `partial`. */
  deadline?: number;
}): Promise<{ records: ThecarapiAdminRecord[]; groups: CcVinPhotoGroup[]; partial: boolean }> {
  const fetchJpegs =
    opts.fetchJpegs ??
    ((urls, max, deadline, trustedUrls) => fetchAuctionPhotoJpegs(urls, max, { deadline, trustedUrls }));
  const writeJpeg = opts.writeJpeg ?? writeCcVinPhotoJpeg;
  const urls: string[] = [];
  const seenUrl = new Set<string>();
  const trusted = new Set<string>();
  for (const record of opts.records) {
    for (const url of thecarapiTrustedImageUrls(record.rawImages)) trusted.add(url);
  }
  for (const record of opts.records) {
    for (const url of record.photoUrls) {
      if (!url || seenUrl.has(url)) continue;
      seenUrl.add(url);
      urls.push(url);
    }
  }
  const fetched = urls.length > 0 ? await fetchJpegs(urls, CC_VIN_PHOTO_MAX_BYTES, opts.deadline, trusted) : { ok: [], failed: [] };
  const partial = fetched.failed.some((row) => row.reason === "deadline");
  const byUrl = new Map(fetched.ok.map((row) => [row.url, row]));
  const archiveSession = thecarapiArchivePhotoSession(opts.vin);
  const archiveUrls = new Set<string>();
  const archiveHashes = new Set<string>();
  const archiveIds = new Map<string, string>();
  const orderUrls = new Set<string>();
  const orderHashes = new Set<string>();
  for (const group of opts.existing ?? []) {
    for (const photo of group.photos ?? []) {
      if (photo.sourceUrl) orderUrls.add(photo.sourceUrl);
      if (photo.contentHash) orderHashes.add(photo.contentHash.toLowerCase());
    }
  }
  const orderIds = new Map<string, string>();
  const planned: PlannedWrite[] = [];
  const plannedGroups: { title: string; photos: { id: string; sourceUrl: string; contentHash: string }[] }[] = [];
  const plannedRecords: { record: ThecarapiAdminRecord; photos: ThecarapiStoredPhoto[] }[] = [];

  for (const record of opts.records) {
    const caption = thecarapiGalleryTitle(record.venue, record.photoDate);
    const photos: ThecarapiStoredPhoto[] = [];
    const orderPhotos: { id: string; sourceUrl: string; contentHash: string }[] = [];
    for (const url of record.photoUrls) {
      const row = byUrl.get(url);
      if (!row) continue;
      const meta = {
        sourceUrl: row.url,
        contentHash: row.contentHash,
        date: record.photoDate,
        venue: record.venue,
        caption,
      };
      const archived = planOnce(planned, archiveSession, archiveUrls, archiveHashes, row, meta, archiveIds);
      if (archived) photos.push(archived);
      if (opts.sessionId && opts.sessionId !== archiveSession) {
        const ordered = planOnce(planned, opts.sessionId, orderUrls, orderHashes, row, meta, orderIds);
        if (ordered) orderPhotos.push({ id: ordered.id, sourceUrl: ordered.sourceUrl, contentHash: ordered.contentHash });
      }
    }
    if (orderPhotos.length > 0) plannedGroups.push({ title: caption, photos: orderPhotos });
    plannedRecords.push({ record, photos });
  }
  const failedIds = await runWrites(writeJpeg, planned);
  const groups: CcVinPhotoGroup[] = [];
  for (const group of plannedGroups) {
    const photos = group.photos.filter((photo) => !failedIds.has(photo.id));
    if (photos.length > 0) groups.push({ id: makeCcVinPhotoGroupId(), title: group.title, photos });
  }
  const records = plannedRecords.map(({ record, photos }) => {
    const ok = photos.filter((photo) => !failedIds.has(photo.id));
    return { ...record, photos: ok.length > 0 ? ok : record.photos };
  });
  return { records, groups, partial };
}
