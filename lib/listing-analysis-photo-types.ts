/** Sludinājuma analīzes „Fotogrāfiju analīze” — vizuālie pierādījumi PDF (līdz 50 gab.). */
export const LISTING_ANALYSIS_MAX_PHOTOS = 50;

export type ListingAnalysisPhotoMeta = {
  id: string;
};

export type ListingAnalysisPhotoGroup = {
  id: string;
  /** Manuāli ievadāms virsraksts PDF (piem. datums, avots). */
  title: string;
  photos: ListingAnalysisPhotoMeta[];
};

const PHOTO_ID_RE = /^la_ph_[a-f0-9]{24}$/;
const PHOTO_GROUP_ID_RE = /^la_phg_[a-f0-9]{24}$/;

export function isListingAnalysisPhotoId(id: string): boolean {
  return PHOTO_ID_RE.test(id);
}

export function isListingAnalysisPhotoGroupId(id: string): boolean {
  return PHOTO_GROUP_ID_RE.test(id);
}

export function makeListingAnalysisPhotoGroupId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    return `la_phg_${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  }
  let hex = "";
  for (let i = 0; i < 24; i++) {
    hex += Math.floor(Math.random() * 16).toString(16);
  }
  return `la_phg_${hex}`;
}

export function emptyListingAnalysisPhotoGroup(): ListingAnalysisPhotoGroup {
  return { id: makeListingAnalysisPhotoGroupId(), title: "", photos: [] };
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

function trimPhotoGroupTitle(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().slice(0, 120) : "";
}

function enforcePhotoGroupLimit(groups: ListingAnalysisPhotoGroup[]): ListingAnalysisPhotoGroup[] {
  const out: ListingAnalysisPhotoGroup[] = [];
  let total = 0;
  for (const group of groups) {
    const remaining = LISTING_ANALYSIS_MAX_PHOTOS - total;
    if (remaining <= 0) break;
    const photos = group.photos.slice(0, remaining);
    total += photos.length;
    if (photos.length === 0 && !group.title.trim()) continue;
    out.push({ ...group, photos });
  }
  return out;
}

/** Normalizē grupas; ja nav grupu, bet ir vecais plakanais `photos` — viena grupa bez virsraksta. */
export function normalizeListingAnalysisPhotoGroups(
  rawGroups: unknown,
  legacyPhotos?: unknown,
): ListingAnalysisPhotoGroup[] {
  if (Array.isArray(rawGroups) && rawGroups.length > 0) {
    const out: ListingAnalysisPhotoGroup[] = [];
    for (const item of rawGroups) {
      if (!item || typeof item !== "object") continue;
      const o = item as { id?: unknown; title?: unknown; photos?: unknown };
      const id =
        typeof o.id === "string" && isListingAnalysisPhotoGroupId(o.id.trim())
          ? o.id.trim()
          : makeListingAnalysisPhotoGroupId();
      const title = trimPhotoGroupTitle(o.title);
      const photos = normalizeListingAnalysisPhotos(o.photos);
      if (photos.length === 0 && !title) continue;
      out.push({ id, title, photos });
    }
    if (out.length > 0) return enforcePhotoGroupLimit(out);
  }

  const flat = normalizeListingAnalysisPhotos(legacyPhotos);
  if (flat.length === 0) return [];
  return [{ id: makeListingAnalysisPhotoGroupId(), title: "", photos: flat }];
}

export function flattenListingAnalysisPhotoGroups(
  groups: ListingAnalysisPhotoGroup[] | null | undefined,
): ListingAnalysisPhotoMeta[] {
  const out: ListingAnalysisPhotoMeta[] = [];
  const seen = new Set<string>();
  for (const group of groups ?? []) {
    for (const photo of group.photos ?? []) {
      if (!photo?.id || seen.has(photo.id)) continue;
      seen.add(photo.id);
      out.push({ id: photo.id });
      if (out.length >= LISTING_ANALYSIS_MAX_PHOTOS) return out;
    }
  }
  return out;
}

export function countListingAnalysisPhotos(groups: ListingAnalysisPhotoGroup[] | null | undefined): number {
  return flattenListingAnalysisPhotoGroups(groups).length;
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

/** Apvieno grupas — garāks kopējais foto skaits uzvar; vienāds skaits → ienākošā struktūra (virsraksti, secība). */
export function mergeListingAnalysisPhotoGroups(
  incomingGroups: ListingAnalysisPhotoGroup[] | null | undefined,
  incomingLegacyPhotos: ListingAnalysisPhotoMeta[] | null | undefined,
  baselineGroups: ListingAnalysisPhotoGroup[] | null | undefined,
  baselineLegacyPhotos: ListingAnalysisPhotoMeta[] | null | undefined,
): ListingAnalysisPhotoGroup[] {
  const a = normalizeListingAnalysisPhotoGroups(incomingGroups, incomingLegacyPhotos);
  const b = normalizeListingAnalysisPhotoGroups(baselineGroups, baselineLegacyPhotos);
  const aCount = countListingAnalysisPhotos(a);
  const bCount = countListingAnalysisPhotos(b);
  if (aCount > bCount) return a;
  if (bCount > aCount) return b;
  return a;
}

export function syncListingAnalysisPhotoGroupsAndFlat(
  groups: ListingAnalysisPhotoGroup[],
): { photoGroups: ListingAnalysisPhotoGroup[]; photos: ListingAnalysisPhotoMeta[] } {
  const photoGroups = enforcePhotoGroupLimit(groups);
  return { photoGroups, photos: flattenListingAnalysisPhotoGroups(photoGroups) };
}
