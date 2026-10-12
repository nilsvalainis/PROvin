/**
 * Background Auto1 VIN OCR. Not on the list ingest path.
 * OCRs document-like photos (cap 6), ISO 3779 check digit, compares hits.
 * Cached on the vehicle as confirmed (shown) or miss (hidden).
 */
import "server-only";

import { isAllowedListingPhotoUrl } from "@/lib/iriss-listings-photos-zip";
import {
  LISTING_VIN_OCR_MAX_PHOTOS,
  LISTING_VIN_OCR_SOURCE,
  compareListingOcrVins,
  extractVinCandidatesFromText,
  rankListingPhotosForVinOcr,
  type ListingVinOcrDecisionStatus,
  type ListingVinPhotoInput,
} from "@/lib/iriss-listings-vin-from-photos";
import { isPlaceholderVin } from "@/lib/order-field-validation";

export { LISTING_VIN_OCR_MAX_PHOTOS };

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
  alts: string[];
  vinSource: typeof LISTING_VIN_OCR_SOURCE | "";
  vinOcrStatus: ListingVinOcrDecisionStatus | "";
  photosTried: number;
  textChars: number;
};

export async function ocrVinFromListingPhotos(input: ListingVinPhotoInput): Promise<ListingVinOcrResult> {
  const empty: ListingVinOcrResult = { vin: "", alts: [], vinSource: "", vinOcrStatus: "", photosTried: 0, textChars: 0 };
  if (!isIrissListingsVinOcrEnabled()) return empty;
  const urls = rankListingPhotosForVinOcr(input, LISTING_VIN_OCR_MAX_PHOTOS);
  if (urls.length === 0) return empty;

  let photosTried = 0;
  let textChars = 0;
  const vinsPerPhoto: string[][] = [];
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
      vinsPerPhoto.push(extractVinCandidatesFromText(text).filter((v) => !isPlaceholderVin(v)));
    } catch {
      /* nākamā bilde, nepārtrauc pēc pirmā trāpījuma */
    }
  }
  const decision = compareListingOcrVins(vinsPerPhoto);
  if (!decision.vin || decision.status !== "confirmed") {
    return { ...empty, vinOcrStatus: "miss", photosTried, textChars };
  }
  return {
    vin: decision.vin,
    alts: [],
    vinSource: LISTING_VIN_OCR_SOURCE,
    vinOcrStatus: "confirmed",
    photosTried,
    textChars,
  };
}
