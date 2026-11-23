import "server-only";

import sharp from "sharp";

import { CC_VIN_PHOTO_MAX_BYTES, makeCcVinPhotoId, readCcVinPhotoJpeg } from "@/lib/admin-cc-vin-photo-store";
import { fetchAuctionPhotoJpegs } from "@/lib/auction-photo-fetch";
import {
  AUCTION_ARCHIVE_PREVIEW_MAX,
  isUsefulThecarapiRecord,
  type AuctionArchivePhoto,
} from "@/lib/auction-archive-offer";
import {
  readAuctionArchivePhoto,
  writeAuctionArchivePhoto,
  writeAuctionArchivePreview,
} from "@/lib/auction-archive-offer-store";
import type { CcVinBlockState } from "@/lib/cc-vin-report";
import { thecarapiArchivePhotoSession } from "@/lib/thecarapi-photos";

/**
 * Izsoļu arhīva bildes pie mums (E): TheCarApi bildes ir saites uz Openlane u.c. CDN - tās beidzas.
 * Kad Nils sūta piedāvājumu, visas bildes nokopē pasūtījuma privātajā mapē
 * `auction_archive_offers/<sessionId>/photos/`. Avots: jau saglabātā kopija (cc-vin-photos), citādi CDN.
 */

export type AuctionArchivePhotoSource = {
  /** Kopijas ID pasūtījuma mapē (= sākotnējais ID, ja bilde jau bija saglabāta). */
  id: string;
  auctionKey: string;
  date: string;
  caption: string;
  /** Jau saglabāta bilde: krātuves sesija + ID. */
  stored?: { sessionId: string; photoId: string };
  /** Vēl nesaglabāta: CDN saite. */
  url?: string;
};

function dayOf(raw: string): string {
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(raw.trim());
  if (iso) return iso[1]!;
  const lv = /(\d{2})\.(\d{2})\.(\d{4})/.exec(raw);
  return lv ? `${lv[3]}-${lv[2]}-${lv[1]}` : "";
}

/**
 * Visu bilžu saraksts hronoloģiski pa izsolēm: TheCarApi ieraksti (saglabātās + CDN saites),
 * tad manuāli pievienotās grupas (checkcar.vin u.c.) bez TheCarApi dublikātiem.
 */
export function collectAuctionArchivePhotoSources(args: {
  vin: string;
  sessionId: string;
  block: Pick<CcVinBlockState, "thecarapiRecords" | "photoGroups"> | null | undefined;
}): AuctionArchivePhotoSource[] {
  const out: AuctionArchivePhotoSource[] = [];
  const seenUrl = new Set<string>();
  const seenHash = new Set<string>();
  const seenId = new Set<string>();
  const archiveSession = thecarapiArchivePhotoSession(args.vin);
  const records = [...(args.block?.thecarapiRecords ?? [])]
    .filter(isUsefulThecarapiRecord)
    .sort((a, b) => (dayOf(a.photoDate || a.date) || "9999").localeCompare(dayOf(b.photoDate || b.date) || "9999"));
  for (const r of records) {
    const auctionKey = `${(r.site || "thecarapi").toLowerCase()}:${r.id}`.slice(0, 120);
    const date = dayOf(r.photoDate || r.date);
    const caption = [r.venue, date].filter(Boolean).join(" · ").slice(0, 160);
    for (const p of r.photos) {
      if (seenId.has(p.id)) continue;
      seenId.add(p.id);
      if (p.sourceUrl) seenUrl.add(p.sourceUrl);
      if (p.contentHash) seenHash.add(p.contentHash.toLowerCase());
      out.push({
        id: p.id,
        auctionKey,
        date: dayOf(p.date) || date,
        caption: p.caption ? p.caption.replace(/^TheCarApi\s*·\s*/, "").slice(0, 160) : caption,
        ...(archiveSession ? { stored: { sessionId: archiveSession, photoId: p.id } } : {}),
        ...(p.sourceUrl ? { url: p.sourceUrl } : {}),
      });
    }
    for (const url of r.photoUrls) {
      if (!url || seenUrl.has(url)) continue;
      seenUrl.add(url);
      out.push({ id: makeCcVinPhotoId(), auctionKey, date, caption, url });
    }
  }
  for (const g of args.block?.photoGroups ?? []) {
    const date = dayOf(g.title ?? "");
    for (const p of g.photos ?? []) {
      if (seenId.has(p.id)) continue;
      if (p.sourceUrl && seenUrl.has(p.sourceUrl)) continue;
      if (p.contentHash && seenHash.has(p.contentHash.toLowerCase())) continue;
      seenId.add(p.id);
      out.push({
        id: p.id,
        auctionKey: "manual",
        date,
        caption: (g.title ?? "").replace(/^TheCarApi\s*·\s*/, "").slice(0, 160),
        stored: { sessionId: args.sessionId, photoId: p.id },
        ...(p.sourceUrl ? { url: p.sourceUrl } : {}),
      });
    }
  }
  return out;
}

export type PersistDeps = {
  readStored?: (sessionId: string, photoId: string) => Promise<Buffer | null>;
  readCopy?: (sessionId: string, id: string) => Promise<Buffer | null>;
  writeCopy?: (sessionId: string, id: string, jpeg: Buffer) => Promise<boolean>;
  fetchUrls?: (urls: readonly string[], deadline?: number) => Promise<{ ok: { url: string; jpeg: Buffer }[] }>;
};

const PARALLEL = 6;

/**
 * Nokopē visas bildes pasūtījuma mapē. Jau nokopētās (atkārtots piedāvājums) nelasa vēlreiz.
 * Atgriež saglabāto bilžu manifestu un neizdevušos skaitu (CDN vairs nedod / termiņš).
 */
export async function persistAuctionArchivePhotos(args: {
  sessionId: string;
  sources: readonly AuctionArchivePhotoSource[];
  deadline?: number;
  deps?: PersistDeps;
}): Promise<{ photos: AuctionArchivePhoto[]; missing: number }> {
  const readStored = args.deps?.readStored ?? ((s, id) => readCcVinPhotoJpeg(s, id));
  const readCopy = args.deps?.readCopy ?? readAuctionArchivePhoto;
  const writeCopy = args.deps?.writeCopy ?? writeAuctionArchivePhoto;
  const fetchUrls =
    args.deps?.fetchUrls ??
    ((urls: readonly string[], deadline?: number) => fetchAuctionPhotoJpegs(urls, CC_VIN_PHOTO_MAX_BYTES, { deadline }));

  const done = new Set<string>();
  const needFetch: AuctionArchivePhotoSource[] = [];
  let next = 0;
  const work = async () => {
    while (next < args.sources.length) {
      const src = args.sources[next]!;
      next += 1;
      if (await readCopy(args.sessionId, src.id).catch(() => null)) {
        done.add(src.id);
        continue;
      }
      const buf = src.stored ? await readStored(src.stored.sessionId, src.stored.photoId).catch(() => null) : null;
      if (buf && (await writeCopy(args.sessionId, src.id, buf).catch(() => false))) {
        done.add(src.id);
        continue;
      }
      if (src.url) needFetch.push(src);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, args.sources.length) }, work));

  if (needFetch.length > 0) {
    const fetched = await fetchUrls(
      needFetch.map((s) => s.url!),
      args.deadline,
    ).catch(() => ({ ok: [] as { url: string; jpeg: Buffer }[] }));
    const byUrl = new Map(fetched.ok.map((r) => [r.url, r.jpeg]));
    let i = 0;
    const write = async () => {
      while (i < needFetch.length) {
        const src = needFetch[i]!;
        i += 1;
        const jpeg = byUrl.get(src.url!);
        if (jpeg && (await writeCopy(args.sessionId, src.id, jpeg).catch(() => false))) done.add(src.id);
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL, needFetch.length) }, write));
  }

  const photos = args.sources
    .filter((s) => done.has(s.id))
    .map((s) => ({ id: s.id, auctionKey: s.auctionKey, date: s.date, caption: s.caption }));
  return { photos, missing: args.sources.length - photos.length };
}

/**
 * Izplūdināta bilde e-pastam (blur serverī - e-pasta programmas CSS blur nerāda).
 * Spēcīgs izplūdums: numurzīme un detaļas nav salasāmas, siluets redzams.
 */
export async function blurAuctionArchivePreview(jpeg: Buffer): Promise<Buffer> {
  return sharp(jpeg)
    .rotate()
    .resize({ width: 560, height: 420, fit: "cover", withoutEnlargement: false })
    .blur(18)
    .jpeg({ quality: 62, mozjpeg: true })
    .toBuffer();
}

/** PDF bildes izmērs (Nils 23.11, ~84 bildes): garākā mala ≤1600 px, JPEG 80% - lai Vercel funkcija nepārsniedz laiku/atmiņu. */
export const AUCTION_ARCHIVE_PDF_PHOTO_MAX_PX = 1600;
export const AUCTION_ARCHIVE_PDF_PHOTO_QUALITY = 80;

/**
 * Samazina bildi pirms ievietošanas PDF. Jau maza bilde (≤ robeža un ≤ 400 KB) paliek kā ir.
 * Kļūda (bojāts fails) - null (PDF to izlaiž, nevis krīt).
 */
export async function shrinkAuctionArchivePdfPhoto(jpeg: Buffer): Promise<Buffer | null> {
  try {
    const img = sharp(jpeg, { failOn: "none" });
    const meta = await img.metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    const max = AUCTION_ARCHIVE_PDF_PHOTO_MAX_PX;
    if (meta.format === "jpeg" && w > 0 && h > 0 && w <= max && h <= max && jpeg.length <= 400_000 && !(meta.orientation && meta.orientation > 1)) {
      return jpeg;
    }
    return await img
      .rotate()
      .resize({ width: max, height: max, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: AUCTION_ARCHIVE_PDF_PHOTO_QUALITY })
      .toBuffer();
  } catch {
    return null;
  }
}

/** Ģenerē un saglabā līdz 2 izplūdinātām bildēm no jau nokopētajām. Atgriež izdevušos ID. */
export async function writeAuctionArchivePreviews(args: {
  sessionId: string;
  previewIds: readonly string[];
  deps?: { readCopy?: PersistDeps["readCopy"]; writePreview?: (sessionId: string, n: number, jpeg: Buffer) => Promise<boolean> };
}): Promise<string[]> {
  const readCopy = args.deps?.readCopy ?? readAuctionArchivePhoto;
  const writePreview = args.deps?.writePreview ?? writeAuctionArchivePreview;
  const ok: string[] = [];
  for (const id of args.previewIds.slice(0, AUCTION_ARCHIVE_PREVIEW_MAX)) {
    const src = await readCopy(args.sessionId, id).catch(() => null);
    if (!src) continue;
    try {
      const blurred = await blurAuctionArchivePreview(src);
      if (await writePreview(args.sessionId, ok.length, blurred)) ok.push(id);
    } catch {
      /* bojāta bilde - izlaiž */
    }
  }
  return ok;
}

/** Noklusējuma priekšskatījums: priekšpuse + odometrs (makets 5A) - pirmā bilde un bilde ar «odometr» parakstā. */
export function defaultAuctionArchivePreviewIds(photos: readonly AuctionArchivePhoto[]): string[] {
  if (photos.length === 0) return [];
  const first = photos[0]!.id;
  const odo = photos.find((p) => /odomet|nobrauk|kilomet|tacho/i.test(p.caption))?.id;
  const second = odo && odo !== first ? odo : photos[Math.min(photos.length - 1, 1)]!.id;
  return second && second !== first ? [first, second] : [first];
}
