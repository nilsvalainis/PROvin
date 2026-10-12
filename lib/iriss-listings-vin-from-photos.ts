/**
 * Cheap VIN hints from listing photos without OCR: URL paths, document-like
 * image ranking, and ISO 3779 extraction from already-recognised text.
 * Auto1 search hits[] do not carry VIN; document photos sometimes do.
 */

import { isPlaceholderVin } from "@/lib/order-field-validation";
import { extractIso3779VinsFromText, hasIso3779CheckDigit, vinOcrAlphabetVariants } from "@/lib/vin-iso3779";

export const LISTING_VIN_OCR_SOURCE = "ocr_photo" as const;
export const LISTING_VIN_OCR_MAX_PHOTOS = 6;
export const LISTING_VIN_SOURCE_LABEL: Record<string, string> = {
  ocr_photo: "no foto",
};

export type ListingVinOcrDecisionStatus = "confirmed" | "unverified" | "conflict" | "miss";

export type ListingVinOcrDecision = {
  vin: string;
  alts: string[];
  status: ListingVinOcrDecisionStatus;
};

const DOC_URL_RE =
  /document|dokum|registr|schein|brief|zulass|invoice|rechnung|service.?book|serviceheft|certif|fahrzeugbrief|\bcoc\b|title.?doc|paper|logbook/i;
const KIND_DOC_RE = /document|paper|registration|service|invoice|certificate|schein|brief|dokum/i;
const EXTERIOR_HERO_RE = /exterior|front|hero|mainimage/i;

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

function isExteriorHeroListingImage(url: string): boolean {
  return EXTERIOR_HERO_RE.test(url);
}

/**
 * Document / registration / service-book frames first, then last gallery
 * shots (dash / papers). Skip hero exteriors. Cap, do not stop at first VIN.
 */
export function rankListingPhotosForVinOcr(input: ListingVinPhotoInput, max = LISTING_VIN_OCR_MAX_PHOTOS): string[] {
  const cap = Math.max(1, max);
  const docs = [...new Set((input.documentImageUrls ?? []).map((u) => u.trim()).filter(Boolean))];
  const all = listingPhotoList(input);
  const docLike = all.filter((u) => docs.includes(u) || isDocumentLikeListingImage(u));
  const rest = all.filter((u) => !docLike.includes(u) && !isExteriorHeroListingImage(u)).reverse();
  const ordered: string[] = [];
  for (const u of [...docs, ...docLike, ...rest]) {
    if (!u || ordered.includes(u)) continue;
    ordered.push(u);
    if (ordered.length >= cap) break;
  }
  return ordered;
}

export function listingVinOcrIsCrossChecked(status: string | null | undefined): boolean {
  return status === "confirmed" || status === "unverified" || status === "conflict";
}

/** Per-photo ISO 3779 hits. 2+ photos same VIN = confirmed; one photo = unverified; mix = conflict. */
export function compareListingOcrVins(vinsPerPhoto: readonly (readonly string[])[]): ListingVinOcrDecision {
  const votes = new Map<string, number>();
  for (const photo of vinsPerPhoto) {
    const unique = [
      ...new Set(
        photo
          .map((v) => v.trim().toUpperCase())
          .filter((v) => hasIso3779CheckDigit(v) && !isPlaceholderVin(v)),
      ),
    ];
    if (unique.length === 0) continue;
    for (const v of unique) votes.set(v, (votes.get(v) ?? 0) + 1);
  }
  const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (ranked.length === 0) return { vin: "", alts: [], status: "miss" };
  if (ranked.length > 1) {
    return { vin: ranked[0]![0], alts: ranked.slice(1).map(([v]) => v), status: "conflict" };
  }
  const [vin, n] = ranked[0]!;
  return { vin, alts: [], status: n >= 2 ? "confirmed" : "unverified" };
}

export function listingVinOcrDecisionFromTexts(texts: readonly string[]): ListingVinOcrDecision {
  return compareListingOcrVins(texts.map((t) => extractIso3779VinsFromText(t)));
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
