/** Sludinājuma analīzes „Fotogrāfiju analīze” — vizuālie pierādījumi PDF. */
export const LISTING_ANALYSIS_MAX_PHOTOS = 12;

export type ListingAnalysisPhotoMeta = {
  id: string;
};

const PHOTO_ID_RE = /^la_ph_[a-f0-9]{24}$/;

export function isListingAnalysisPhotoId(id: string): boolean {
  return PHOTO_ID_RE.test(id);
}

export function normalizeListingAnalysisPhotos(raw: unknown): ListingAnalysisPhotoMeta[] {
  if (!Array.isArray(raw)) return [];
  const out: ListingAnalysisPhotoMeta[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const id = typeof (item as { id?: unknown }).id === "string" ? (item as { id: string }).id.trim() : "";
    if (!isListingAnalysisPhotoId(id)) continue;
    if (out.some((p) => p.id === id)) continue;
    out.push({ id });
    if (out.length >= LISTING_ANALYSIS_MAX_PHOTOS) break;
  }
  return out;
}

/** PATCH merge — nekad nezaudē vairāk fotogrāfiju; vienāda skaita gadījumā ienākošā secība (kārtošana). */
export function mergeListingAnalysisPhotoLists(
  incoming: ListingAnalysisPhotoMeta[] | null | undefined,
  baseline: ListingAnalysisPhotoMeta[] | null | undefined,
): ListingAnalysisPhotoMeta[] {
  const a = normalizeListingAnalysisPhotos(incoming);
  const b = normalizeListingAnalysisPhotos(baseline);
  if (a.length > b.length) return a;
  if (b.length > a.length) return b;
  return a;
}
