import "server-only";

import { CC_VIN_PHOTO_MAX_BYTES, makeCcVinPhotoId, writeCcVinPhotoJpeg } from "@/lib/admin-cc-vin-photo-store";
import { jpegFromAdminPhotoUpload } from "@/lib/admin-photo-normalize";
import { CC_VIN_MAX_PHOTOS } from "@/lib/cc-vin-photo-types";
import {
  ORDER_VIN_SCAN_PHOTO_IMPORT_MAX,
  isAllowedVinScanAuctionPhotoUrl,
} from "@/lib/order-vin-scan-photos";

const FETCH_TIMEOUT_MS = 12_000;
const RAW_MAX_BYTES = 3_500_000;
const CONCURRENCY = 3;

export type ImportVinScanAuctionPhotosResult = {
  photoIds: string[];
  imported: number;
  skipped: number;
  failed: number;
};

async function downloadAuctionJpeg(url: string): Promise<Buffer | null> {
  if (!isAllowedVinScanAuctionPhotoUrl(url)) return null;
  const host = new URL(url).hostname;
  const referer = host.includes("copart")
    ? "https://www.copart.com/"
    : host.includes("iaai")
      ? "https://www.iaai.com/"
      : host.includes("stat.vin")
        ? "https://stat.vin/"
        : undefined;
  const res = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      Accept: "image/jpeg,image/webp,image/png,image/*;q=0.8,*/*;q=0.5",
      ...(referer ? { Referer: referer } : {}),
    },
  });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0 || buf.length > RAW_MAX_BYTES) return null;
  const normalized = await jpegFromAdminPhotoUpload(buf, CC_VIN_PHOTO_MAX_BYTES);
  return normalized.ok ? normalized.jpeg : null;
}

export async function importVinScanAuctionPhotosToCcVin(
  sessionId: string,
  urls: readonly string[],
  existingCount: number,
): Promise<ImportVinScanAuctionPhotosResult> {
  const room = Math.max(0, Math.min(ORDER_VIN_SCAN_PHOTO_IMPORT_MAX, CC_VIN_MAX_PHOTOS - existingCount));
  const wanted = [...new Set(urls.map((u) => u.trim()).filter(isAllowedVinScanAuctionPhotoUrl))].slice(0, room);
  const photoIds: string[] = [];
  let skipped = Math.max(0, urls.length - wanted.length);
  let failed = 0;
  let i = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, wanted.length) }, async () => {
    while (i < wanted.length) {
      const url = wanted[i];
      i += 1;
      if (!url) continue;
      try {
        const jpeg = await downloadAuctionJpeg(url);
        if (!jpeg) {
          failed += 1;
          continue;
        }
        const photoId = makeCcVinPhotoId();
        await writeCcVinPhotoJpeg(sessionId, photoId, jpeg);
        photoIds.push(photoId);
      } catch {
        failed += 1;
      }
    }
  });
  await Promise.all(workers);
  return { photoIds, imported: photoIds.length, skipped, failed };
}
