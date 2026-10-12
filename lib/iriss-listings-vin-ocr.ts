/**
 * Background Auto1 VIN OCR. Not on the list ingest path.
 * Fetches a few ranked listing photos, downscales with sharp, reads with
 * tesseract.js, keeps only ISO 3779 check-digit matches. Cached on the vehicle.
 */
import "server-only";

import { isAllowedListingPhotoUrl } from "@/lib/iriss-listings-photos-zip";
import {
  LISTING_VIN_OCR_SOURCE,
  extractIso3779VinsFromText,
  rankListingPhotosForVinOcr,
  type ListingVinPhotoInput,
} from "@/lib/iriss-listings-vin-from-photos";
import { isPlaceholderVin } from "@/lib/order-field-validation";

export const LISTING_VIN_OCR_MAX_PHOTOS = 3;
const FETCH_TIMEOUT_MS = 8_000;
const MAX_IMAGE_BYTES = 3_500_000;
const OCR_MAX_EDGE = 1400;

export function isIrissListingsVinOcrEnabled(): boolean {
  return !/^(0|false|no|off)$/i.test((process.env.IRISS_LISTINGS_VIN_OCR ?? "1").trim());
}

async function prepareImage(buf: Buffer): Promise<Buffer> {
  const sharpMod = await import("sharp");
  const sharp = sharpMod.default;
  return sharp(buf, { failOn: "none" })
    .resize({ width: OCR_MAX_EDGE, height: OCR_MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .greyscale()
    .jpeg({ quality: 80 })
    .toBuffer();
}

async function fetchPhoto(url: string): Promise<Buffer | null> {
  if (!isAllowedListingPhotoUrl(url)) return null;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: /img-pa\.auto1|auto1/i.test(url) ? { Referer: "https://provin.lv/" } : /openlane/i.test(url) ? { Referer: "" } : undefined,
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 400 || buf.length > MAX_IMAGE_BYTES) return null;
    return buf;
  } catch {
    return null;
  }
}

type TessWorker = {
  recognize: (img: Buffer) => Promise<{ data: { text?: string } }>;
  terminate: () => Promise<unknown>;
};

let workerPromise: Promise<TessWorker> | null = null;

async function ocrWorker(): Promise<TessWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      return (await createWorker("eng", undefined, { logger: () => undefined })) as unknown as TessWorker;
    })();
  }
  try {
    return await workerPromise;
  } catch (e) {
    workerPromise = null;
    throw e;
  }
}

export type ListingVinOcrResult = {
  vin: string;
  vinSource: typeof LISTING_VIN_OCR_SOURCE | "";
  photosTried: number;
  textChars: number;
};

export async function ocrVinFromListingPhotos(input: ListingVinPhotoInput): Promise<ListingVinOcrResult> {
  const empty: ListingVinOcrResult = { vin: "", vinSource: "", photosTried: 0, textChars: 0 };
  if (!isIrissListingsVinOcrEnabled()) return empty;
  const urls = rankListingPhotosForVinOcr(input, LISTING_VIN_OCR_MAX_PHOTOS);
  if (urls.length === 0) return empty;

  let photosTried = 0;
  let textChars = 0;
  const worker = await ocrWorker();
  for (const url of urls) {
    const raw = await fetchPhoto(url);
    if (!raw) continue;
    let prepared: Buffer;
    try {
      prepared = await prepareImage(raw);
    } catch {
      prepared = raw;
    }
    photosTried += 1;
    try {
      const { data } = await worker.recognize(prepared);
      const text = data.text ?? "";
      textChars += text.length;
      const vin = (extractIso3779VinsFromText(text).find((v) => !isPlaceholderVin(v)) ?? "").trim();
      if (vin) {
        return { vin, vinSource: LISTING_VIN_OCR_SOURCE, photosTried, textChars };
      }
    } catch {
      /* nākamā bilde */
    }
  }
  return { ...empty, photosTried, textChars };
}
