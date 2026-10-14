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
/** Viena foto OCR (serverless); kopā ar foto lejuplādi nepārsniedz maršruta budžetu. */
const OCR_RECOGNIZE_TIMEOUT_MS = 22_000;
const OCR_DEFAULT_BUDGET_MS = 95_000;

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
      const worker = await createWorker("eng", undefined, { logger: () => undefined });
      return worker as unknown as TessWorker;
    })();
  }
  try {
    return await workerPromise;
  } catch (e) {
    workerPromise = null;
    throw e;
  }
}

async function recognizeWithTimeout(worker: TessWorker, prepared: Buffer, timeoutMs: number): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const { data } = await Promise.race([
      worker.recognize(prepared),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("ocr_recognize_timeout")), timeoutMs);
      }),
    ]);
    return data.text ?? "";
  } finally {
    if (timer) clearTimeout(timer);
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

export async function ocrVinFromListingPhotos(
  input: ListingVinPhotoInput,
  opts: { deadlineMs?: number } = {},
): Promise<ListingVinOcrResult> {
  const empty: ListingVinOcrResult = { vin: "", alts: [], vinSource: "", vinOcrStatus: "", photosTried: 0, textChars: 0 };
  if (!isIrissListingsVinOcrEnabled()) return empty;
  const urls = rankListingPhotosForVinOcr(input, LISTING_VIN_OCR_MAX_PHOTOS);
  if (urls.length === 0) return empty;

  const deadlineMs = opts.deadlineMs ?? Date.now() + OCR_DEFAULT_BUDGET_MS;
  let photosTried = 0;
  let textChars = 0;
  const vinsPerPhoto: string[][] = [];
  const worker = await ocrWorker();
  for (const url of urls) {
    const remainingMs = deadlineMs - Date.now();
    if (remainingMs < 5_000) break;
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
      const recognizeMs = Math.min(OCR_RECOGNIZE_TIMEOUT_MS, Math.max(3_000, remainingMs - 2_000));
      const text = await recognizeWithTimeout(worker, prepared, recognizeMs);
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
