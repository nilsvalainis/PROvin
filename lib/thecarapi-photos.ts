/**
 * TheCarApi bildes tajā pašā JPEG krātuvē, kur citas izsoļu bildes (`cc-vin-photos`).
 * CDN lejupielāde nav TheCarApi API izsaukums. Dedup pēc URL un satura hash.
 */
import "server-only";

import { CC_VIN_PHOTO_MAX_BYTES, makeCcVinPhotoId, writeCcVinPhotoJpeg } from "@/lib/admin-cc-vin-photo-store";
import { fetchAuctionPhotoJpegs, type AuctionPhotoFetchOk } from "@/lib/auction-photo-fetch";
import { makeCcVinPhotoGroupId, type CcVinPhotoGroup } from "@/lib/cc-vin-photo-types";
import { thecarapiGalleryTitle, type ThecarapiAdminRecord, type ThecarapiStoredPhoto } from "@/lib/vin-scan/thecarapi-fields";

export function thecarapiArchivePhotoSession(vin: string): string {
  const clean = vin.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 17);
  return clean ? `tc${clean}` : "";
}

export type ThecarapiGalleryWrite = (sessionId: string, photoId: string, jpeg: Buffer) => Promise<void>;
export type ThecarapiGalleryFetch = (
  urls: readonly string[],
  maxBytes: number,
) => Promise<{ ok: AuctionPhotoFetchOk[]; failed: { url: string }[] }>;

async function putOnce(
  writeJpeg: ThecarapiGalleryWrite,
  sessionId: string,
  knownUrls: Set<string>,
  knownHashes: Set<string>,
  row: AuctionPhotoFetchOk,
  meta: Omit<ThecarapiStoredPhoto, "id">,
  idByUrl: Map<string, string>,
): Promise<ThecarapiStoredPhoto | null> {
  if (!sessionId) return null;
  const existing = idByUrl.get(row.url);
  if (existing) return { ...meta, id: existing };
  if (knownUrls.has(row.url) || knownHashes.has(row.contentHash)) return null;
  const id = makeCcVinPhotoId();
  try {
    await writeJpeg(sessionId, id, row.jpeg);
  } catch {
    return null;
  }
  knownUrls.add(row.url);
  knownHashes.add(row.contentHash);
  idByUrl.set(row.url, id);
  return { ...meta, id };
}

export async function storeThecarapiGallery(opts: {
  vin: string;
  sessionId?: string;
  records: readonly ThecarapiAdminRecord[];
  existing?: CcVinPhotoGroup[] | null;
  fetchJpegs?: ThecarapiGalleryFetch;
  writeJpeg?: ThecarapiGalleryWrite;
}): Promise<{ records: ThecarapiAdminRecord[]; groups: CcVinPhotoGroup[] }> {
  const fetchJpegs = opts.fetchJpegs ?? ((urls, max) => fetchAuctionPhotoJpegs(urls, max));
  const writeJpeg = opts.writeJpeg ?? writeCcVinPhotoJpeg;
  const urls: string[] = [];
  const seenUrl = new Set<string>();
  for (const record of opts.records) {
    for (const url of record.photoUrls) {
      if (!url || seenUrl.has(url)) continue;
      seenUrl.add(url);
      urls.push(url);
    }
  }
  const fetched = urls.length > 0 ? await fetchJpegs(urls, CC_VIN_PHOTO_MAX_BYTES) : { ok: [], failed: [] };
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
  const groups: CcVinPhotoGroup[] = [];
  const records: ThecarapiAdminRecord[] = [];

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
      const archived = await putOnce(writeJpeg, archiveSession, archiveUrls, archiveHashes, row, meta, archiveIds);
      if (archived) photos.push(archived);
      if (opts.sessionId && opts.sessionId !== archiveSession) {
        const ordered = await putOnce(writeJpeg, opts.sessionId, orderUrls, orderHashes, row, meta, orderIds);
        if (ordered) orderPhotos.push({ id: ordered.id, sourceUrl: ordered.sourceUrl, contentHash: ordered.contentHash });
      }
    }
    if (orderPhotos.length > 0) {
      groups.push({ id: makeCcVinPhotoGroupId(), title: caption, photos: orderPhotos });
    }
    records.push({ ...record, photos: photos.length > 0 ? photos : record.photos });
  }
  return { records, groups };
}
