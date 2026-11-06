import { parseHidePhotoWatermarks } from "@/lib/admin-photo-watermark";
import { appendMissingFlatPhotos } from "@/lib/photo-group-legacy-recover";

/** Avotu sadaļu fotogrāfijas - vizuālie pierādījumi PDF (līdz 50 gab. vienā blokā). */
export const SOURCE_BLOCK_MAX_PHOTOS = 50;

/**
 * «Sludinājuma vēsture» (tirgus) arhīva foto - atsevišķs griests.
 * CarVertical + AutoDNA grupas bieži pārsniedz 50 unikālas ainas; citi avotu
 * bloki (CSDD, LTAB, vendor) paliek pie SOURCE_BLOCK_MAX_PHOTOS.
 */
export const LISTING_HISTORY_MAX_PHOTOS = 100;

/** Darba zonas kopējais avotu-foto griests: 12×50 plus 50 papildus sludinājuma vēsturei. */
export const SOURCE_BLOCK_PHOTO_WORKSPACE_MAX =
  SOURCE_BLOCK_MAX_PHOTOS * 12 + (LISTING_HISTORY_MAX_PHOTOS - SOURCE_BLOCK_MAX_PHOTOS);

export function sourceBlockPhotoMaxForKey(blockKey: string | null | undefined): number {
  return blockKey === "tirgus" ? LISTING_HISTORY_MAX_PHOTOS : SOURCE_BLOCK_MAX_PHOTOS;
}

export type SourceBlockPhotoMeta = {
  id: string;
};

export type SourceBlockPhotoGroup = {
  id: string;
  /** Manuāli ievadāms virsraksts PDF (piem. datums, izdruka, bojājums). */
  title: string;
  photos: SourceBlockPhotoMeta[];
};

const PHOTO_ID_RE = /^sbp_ph_[a-f0-9]{24}$/;
const PHOTO_GROUP_ID_RE = /^sbp_phg_[a-f0-9]{24}$/;

export function isSourceBlockPhotoId(id: string): boolean {
  return PHOTO_ID_RE.test(id);
}

export function isSourceBlockPhotoGroupId(id: string): boolean {
  return PHOTO_GROUP_ID_RE.test(id);
}

export function makeSourceBlockPhotoGroupId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    return `sbp_phg_${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  }
  let hex = "";
  for (let i = 0; i < 24; i++) {
    hex += Math.floor(Math.random() * 16).toString(16);
  }
  return `sbp_phg_${hex}`;
}

export function emptySourceBlockPhotoGroup(): SourceBlockPhotoGroup {
  return { id: makeSourceBlockPhotoGroupId(), title: "", photos: [] };
}

export function normalizeSourceBlockPhotos(
  raw: unknown,
  max = SOURCE_BLOCK_MAX_PHOTOS,
): SourceBlockPhotoMeta[] {
  if (!Array.isArray(raw)) return [];
  const out: SourceBlockPhotoMeta[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const id = typeof (item as { id?: unknown }).id === "string" ? (item as { id: string }).id.trim() : "";
    if (!isSourceBlockPhotoId(id)) continue;
    if (out.some((p) => p.id === id)) continue;
    out.push({ id });
    if (out.length >= max) break;
  }
  return out;
}

function trimPhotoGroupTitle(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().slice(0, 120) : "";
}

function enforcePhotoGroupLimit(
  groups: SourceBlockPhotoGroup[],
  max = SOURCE_BLOCK_MAX_PHOTOS,
): SourceBlockPhotoGroup[] {
  const out: SourceBlockPhotoGroup[] = [];
  let total = 0;
  for (const group of groups) {
    const remaining = max - total;
    if (remaining <= 0) break;
    const photos = group.photos.slice(0, remaining);
    total += photos.length;
    if (photos.length === 0 && !group.title.trim()) continue;
    out.push({ ...group, photos });
  }
  return out;
}

/** Normalizē grupas; ja nav grupu, bet ir plakanais `photos` - viena grupa bez virsraksta. */
export function normalizeSourceBlockPhotoGroups(
  rawGroups: unknown,
  legacyPhotos?: unknown,
  max = SOURCE_BLOCK_MAX_PHOTOS,
): SourceBlockPhotoGroup[] {
  if (Array.isArray(rawGroups) && rawGroups.length > 0) {
    const out: SourceBlockPhotoGroup[] = [];
    for (const item of rawGroups) {
      if (!item || typeof item !== "object") continue;
      const o = item as { id?: unknown; title?: unknown; photos?: unknown };
      const id =
        typeof o.id === "string" && isSourceBlockPhotoGroupId(o.id.trim())
          ? o.id.trim()
          : makeSourceBlockPhotoGroupId();
      const title = trimPhotoGroupTitle(o.title);
      const photos = normalizeSourceBlockPhotos(o.photos, max);
      if (photos.length === 0 && !title) continue;
      out.push({ id, title, photos });
    }
    if (out.length > 0) {
      return enforcePhotoGroupLimit(
        appendMissingFlatPhotos(out, normalizeSourceBlockPhotos(legacyPhotos, max)),
        max,
      );
    }
  }

  const flat = normalizeSourceBlockPhotos(legacyPhotos, max);
  if (flat.length === 0) return [];
  return [{ id: makeSourceBlockPhotoGroupId(), title: "", photos: flat }];
}

/** «Sludinājuma vēsture» PDF / persist - tas pats formāts, 100 gab. griests. */
export function normalizeListingHistoryPhotoGroups(
  rawGroups: unknown,
  legacyPhotos?: unknown,
): SourceBlockPhotoGroup[] {
  return normalizeSourceBlockPhotoGroups(rawGroups, legacyPhotos, LISTING_HISTORY_MAX_PHOTOS);
}

export function flattenSourceBlockPhotoGroups(
  groups: SourceBlockPhotoGroup[] | null | undefined,
  max = SOURCE_BLOCK_MAX_PHOTOS,
): SourceBlockPhotoMeta[] {
  const out: SourceBlockPhotoMeta[] = [];
  const seen = new Set<string>();
  for (const group of groups ?? []) {
    for (const photo of group.photos ?? []) {
      if (!photo?.id || seen.has(photo.id)) continue;
      seen.add(photo.id);
      out.push({ id: photo.id });
      if (out.length >= max) return out;
    }
  }
  return out;
}

export function countSourceBlockPhotos(
  groups: SourceBlockPhotoGroup[] | null | undefined,
  max = SOURCE_BLOCK_MAX_PHOTOS,
): number {
  return flattenSourceBlockPhotoGroups(groups, max).length;
}

export function sourceBlockPhotosHaveContent(block: {
  photoGroups?: SourceBlockPhotoGroup[] | null;
  photos?: SourceBlockPhotoMeta[] | null;
} | null | undefined): boolean {
  if (!block) return false;
  return (
    countSourceBlockPhotos(
      normalizeSourceBlockPhotoGroups(block.photoGroups, block.photos, LISTING_HISTORY_MAX_PHOTOS),
      LISTING_HISTORY_MAX_PHOTOS,
    ) > 0
  );
}

/** Apvieno grupas - garāks kopējais foto skaits uzvar; vienāds skaits → ienākošā struktūra. */
export function mergeSourceBlockPhotoGroups(
  incomingGroups: SourceBlockPhotoGroup[] | null | undefined,
  incomingLegacyPhotos: SourceBlockPhotoMeta[] | null | undefined,
  baselineGroups: SourceBlockPhotoGroup[] | null | undefined,
  baselineLegacyPhotos: SourceBlockPhotoMeta[] | null | undefined,
  max = SOURCE_BLOCK_MAX_PHOTOS,
): SourceBlockPhotoGroup[] {
  const a = normalizeSourceBlockPhotoGroups(incomingGroups, incomingLegacyPhotos, max);
  const b = normalizeSourceBlockPhotoGroups(baselineGroups, baselineLegacyPhotos, max);
  const aCount = countSourceBlockPhotos(a, max);
  const bCount = countSourceBlockPhotos(b, max);
  if (aCount > bCount) return a;
  if (bCount > aCount) return b;
  return a;
}

export function syncSourceBlockPhotoGroupsAndFlat(
  groups: SourceBlockPhotoGroup[],
  max = SOURCE_BLOCK_MAX_PHOTOS,
): {
  photoGroups: SourceBlockPhotoGroup[];
  photos: SourceBlockPhotoMeta[];
} {
  const photoGroups = enforcePhotoGroupLimit(groups, max);
  return { photoGroups, photos: flattenSourceBlockPhotoGroups(photoGroups, max) };
}

export function syncedSourceBlockPhotos(
  block: {
    photos?: unknown;
    photoGroups?: unknown;
    hidePhotoWatermarks?: unknown;
  },
  max = SOURCE_BLOCK_MAX_PHOTOS,
): {
  photos: SourceBlockPhotoMeta[];
  photoGroups: SourceBlockPhotoGroup[];
  hidePhotoWatermarks: boolean;
} {
  const synced = syncSourceBlockPhotoGroupsAndFlat(
    normalizeSourceBlockPhotoGroups(block.photoGroups, block.photos, max),
    max,
  );
  return { ...synced, hidePhotoWatermarks: parseHidePhotoWatermarks(block) };
}

export function syncedListingHistoryPhotos(block: {
  photos?: unknown;
  photoGroups?: unknown;
  hidePhotoWatermarks?: unknown;
}): ReturnType<typeof syncedSourceBlockPhotos> {
  return syncedSourceBlockPhotos(block, LISTING_HISTORY_MAX_PHOTOS);
}
