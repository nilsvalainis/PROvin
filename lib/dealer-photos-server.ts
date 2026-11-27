import "server-only";

import sharp from "sharp";

import { readAsvPhotoJpeg } from "@/lib/admin-asv-photo-store";
import { readAutoRecordsPhotoJpeg } from "@/lib/admin-auto-records-photo-store";
import { readCcVinPhotoJpeg } from "@/lib/admin-cc-vin-photo-store";
import { readIncidentPhotoJpeg } from "@/lib/admin-incident-photo-store";
import { readListingAnalysisPhotoJpeg } from "@/lib/admin-listing-analysis-photo-store";
import { readSourceBlockPhotoJpeg } from "@/lib/admin-source-block-photo-store";
import { shrinkAuctionArchivePdfPhoto } from "@/lib/auction-archive-offer-photos";
import { dealerPhotoSrc, DEALER_PHOTOS_MAX } from "@/lib/dealer-photos";

/** Bilde no tās galerijas krātuves (pēc ID prefiksa). Oriģināls netiek mainīts. */
export async function readDealerPhotoJpeg(
  sessionId: string,
  id: string,
  opts: { coverCcVinWatermark?: boolean } = {},
): Promise<Buffer | null> {
  switch (dealerPhotoSrc(id)) {
    case "auto_records":
      return readAutoRecordsPhotoJpeg(sessionId, id);
    case "listing_analysis":
      return readListingAnalysisPhotoJpeg(sessionId, id);
    case "cc_vin":
      return readCcVinPhotoJpeg(sessionId, id, { coverWatermark: opts.coverCcVinWatermark === true });
    case "asv":
      return readAsvPhotoJpeg(sessionId, id);
    case "incident":
      return readIncidentPhotoJpeg(sessionId, id);
    case "source_block":
      return readSourceBlockPhotoJpeg(sessionId, id);
    default:
      return null;
  }
}

/** Blur PDF kopijai: numurzīme un personas dati nav salasāmi (izmērs kā audita PDF bildei). */
export const DEALER_PHOTO_BLUR_SIGMA = 14;

export async function blurDealerPhotoJpeg(jpeg: Buffer): Promise<Buffer> {
  return sharp(jpeg, { failOn: "none" })
    .rotate()
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
    .blur(DEALER_PHOTO_BLUR_SIGMA)
    .jpeg({ quality: 70, mozjpeg: true })
    .toBuffer();
}

/** PDF bildes: saspiež kā audita PDF (≤1600 px, JPEG 80%), blur - ja atzīmēts. Bojātu bildi izlaiž. */
export async function readDealerPhotosForPdf(args: {
  sessionId: string;
  items: readonly { id: string; blur: boolean }[];
  coverCcVinWatermark?: boolean;
  deps?: {
    read?: (sessionId: string, id: string) => Promise<Buffer | null>;
  };
}): Promise<{ dataUrls: Record<string, string>; missing: string[] }> {
  const read =
    args.deps?.read ??
    ((sid: string, id: string) => readDealerPhotoJpeg(sid, id, { coverCcVinWatermark: args.coverCcVinWatermark }));
  const dataUrls: Record<string, string> = {};
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const it of args.items.slice(0, DEALER_PHOTOS_MAX)) {
    if (seen.has(it.id) || !dealerPhotoSrc(it.id)) continue;
    seen.add(it.id);
    const src = await read(args.sessionId, it.id).catch(() => null);
    if (!src) {
      missing.push(it.id);
      continue;
    }
    let out: Buffer | null = null;
    try {
      out = it.blur ? await blurDealerPhotoJpeg(src) : await shrinkAuctionArchivePdfPhoto(src);
    } catch {
      out = null;
    }
    if (!out) {
      missing.push(it.id);
      continue;
    }
    dataUrls[it.id] = `data:image/jpeg;base64,${out.toString("base64")}`;
  }
  return { dataUrls, missing };
}
