/**
 * Cheap VIN hints from listing photos without OCR: URL paths, document-like
 * image ranking, and ISO 3779 extraction from already-recognised text.
 * Auto1 search hits[] do not carry VIN; document photos sometimes do.
 */

import { isPlaceholderVin } from "@/lib/order-field-validation";
import { extractIso3779VinsFromText, hasIso3779CheckDigit, vinOcrAlphabetVariants } from "@/lib/vin-iso3779";

export const LISTING_VIN_OCR_SOURCE = "ocr_photo" as const;
export const LISTING_VIN_SOURCE_LABEL: Record<string, string> = {
  ocr_photo: "no foto",
};

const DOC_URL_RE =
  /document|dokum|registr|schein|brief|zulass|invoice|rechnung|service.?book|serviceheft|certif|fahrzeugbrief|\bcoc\b|title.?doc|paper|logbook/i;
const KIND_DOC_RE = /document|paper|registration|service|invoice|certificate|schein|brief|dokum/i;
const MAX_OCR_PHOTOS = 3;

export type ListingVinPhotoInput = {
  imageUrl?: string;
  imageUrls?: string[];
  documentImageUrls?: string[];
};

export function listingVinSourceMark(source: string | null | undefined): string {
  const s = String(source ?? "").trim();
  return LISTING_VIN_SOURCE_LABEL[s] ?? "";
}

export function isDocumentLikeListingImage(url: string, kind = ""): boolean {
  return KIND_DOC_RE.test(kind) || DOC_URL_RE.test(url);
}

export function listingPhotoList(input: ListingVinPhotoInput): string[] {
  const out: string[] = [];
  for (const u of [input.imageUrl, ...(input.imageUrls ?? [])]) {
    const t = (u ?? "").trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

/**
 * Prefer Auto1 document / registration / service-book frames, then the last
 * gallery shots (papers usually sit at the end). Skip the hero exterior.
 */
export function rankListingPhotosForVinOcr(input: ListingVinPhotoInput, max = MAX_OCR_PHOTOS): string[] {
  const docs = (input.documentImageUrls ?? []).map((u) => u.trim()).filter(Boolean);
  const all = listingPhotoList(input);
  const scored = all.map((url, i) => {
    let s = 0;
    if (docs.includes(url) || isDocumentLikeListingImage(url)) s += 100;
    if (all.length >= 2 && i >= Math.max(0, all.length - 4)) s += 20;
    if (i === 0) s -= 30;
    if (/exterior|front|hero|mainimage/i.test(url)) s -= 10;
    s += i * 0.01;
    return { url, s };
  });
  scored.sort((a, b) => b.s - a.s);
  const ordered: string[] = [];
  for (const u of docs) if (!ordered.includes(u)) ordered.push(u);
  for (const { url } of scored) if (!ordered.includes(url)) ordered.push(url);
  return ordered.slice(0, Math.max(1, max));
}

export function extractIso3779VinFromUrls(urls: string[]): string {
  for (const u of urls) {
    const hits = extractIso3779VinsFromText(u.replace(/[/?&=._-]+/g, " "));
    if (hits[0]) return hits[0]!;
  }
  return "";
}

export { extractIso3779VinsFromText, hasIso3779CheckDigit, vinOcrAlphabetVariants };

export function pickFirstIso3779Vin(values: string[]): string {
  for (const v of values) {
    const n = v.trim().toUpperCase();
    if (hasIso3779CheckDigit(n) && !isPlaceholderVin(n)) return n;
  }
  return "";
}
