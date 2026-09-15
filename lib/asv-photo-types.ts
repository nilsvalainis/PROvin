/** ASV vēstures fotogrāfijas (izsoles / negadījumi) — PDF, līdz 50 gab. */

export const ASV_MAX_PHOTOS = 50;

export type AsvPhotoMeta = {
  id: string;
};

export type AsvPhotoGroup = {
  id: string;
  /** Manuāli ievadāms virsraksts PDF (datums, izsole, bojājums). */
  title: string;
  photos: AsvPhotoMeta[];
};

const PHOTO_ID_RE = /^asv_ph_[a-f0-9]{24}$/;
const PHOTO_GROUP_ID_RE = /^asv_phg_[a-f0-9]{24}$/;

export function isAsvPhotoId(id: string): boolean {
  return PHOTO_ID_RE.test(id);
}

export function isAsvPhotoGroupId(id: string): boolean {
  return PHOTO_GROUP_ID_RE.test(id);
}

export function makeAsvPhotoGroupId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    return `asv_phg_${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  }
  let hex = "";
  for (let i = 0; i < 24; i++) {
    hex += Math.floor(Math.random() * 16).toString(16);
  }
  return `asv_phg_${hex}`;
}

export function emptyAsvPhotoGroup(): AsvPhotoGroup {
  return { id: makeAsvPhotoGroupId(), title: "", photos: [] };
}

export function normalizeAsvPhotos(raw: unknown): AsvPhotoMeta[] {
  if (!Array.isArray(raw)) return [];
  const out: AsvPhotoMeta[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const id = typeof (item as { id?: unknown }).id === "string" ? (item as { id: string }).id.trim() : "";
    if (!isAsvPhotoId(id)) continue;
    if (out.some((p) => p.id === id)) continue;
    out.push({ id });
    if (out.length >= ASV_MAX_PHOTOS) break;
  }
  return out;
}

function trimPhotoGroupTitle(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().slice(0, 120) : "";
}

function enforcePhotoGroupLimit(groups: AsvPhotoGroup[]): AsvPhotoGroup[] {
  const out: AsvPhotoGroup[] = [];
  let total = 0;
  for (const group of groups) {
    const remaining = ASV_MAX_PHOTOS - total;
    if (remaining <= 0) break;
    const photos = group.photos.slice(0, remaining);
    total += photos.length;
    if (photos.length === 0 && !group.title.trim()) continue;
    out.push({ ...group, photos });
  }
  return out;
}

export function normalizeAsvPhotoGroups(rawGroups: unknown, legacyPhotos?: unknown): AsvPhotoGroup[] {
  if (Array.isArray(rawGroups) && rawGroups.length > 0) {
    const out: AsvPhotoGroup[] = [];
    for (const item of rawGroups) {
      if (!item || typeof item !== "object") continue;
      const o = item as { id?: unknown; title?: unknown; photos?: unknown };
      const id =
        typeof o.id === "string" && isAsvPhotoGroupId(o.id.trim()) ? o.id.trim() : makeAsvPhotoGroupId();
      const title = trimPhotoGroupTitle(o.title);
      const photos = normalizeAsvPhotos(o.photos);
      if (photos.length === 0 && !title) continue;
      out.push({ id, title, photos });
    }
    if (out.length > 0) return enforcePhotoGroupLimit(out);
  }

  const flat = normalizeAsvPhotos(legacyPhotos);
  if (flat.length === 0) return [];
  return [{ id: makeAsvPhotoGroupId(), title: "", photos: flat }];
}

export function flattenAsvPhotoGroups(groups: AsvPhotoGroup[] | null | undefined): AsvPhotoMeta[] {
  const out: AsvPhotoMeta[] = [];
  const seen = new Set<string>();
  for (const group of groups ?? []) {
    for (const photo of group.photos ?? []) {
      if (!photo?.id || seen.has(photo.id)) continue;
      seen.add(photo.id);
      out.push({ id: photo.id });
      if (out.length >= ASV_MAX_PHOTOS) return out;
    }
  }
  return out;
}

export function countAsvPhotos(groups: AsvPhotoGroup[] | null | undefined): number {
  return flattenAsvPhotoGroups(groups).length;
}

export function mergeAsvPhotoGroups(
  incomingGroups: AsvPhotoGroup[] | null | undefined,
  incomingLegacyPhotos: AsvPhotoMeta[] | null | undefined,
  baselineGroups: AsvPhotoGroup[] | null | undefined,
  baselineLegacyPhotos: AsvPhotoMeta[] | null | undefined,
): AsvPhotoGroup[] {
  const a = normalizeAsvPhotoGroups(incomingGroups, incomingLegacyPhotos);
  const b = normalizeAsvPhotoGroups(baselineGroups, baselineLegacyPhotos);
  const aCount = countAsvPhotos(a);
  const bCount = countAsvPhotos(b);
  if (aCount > bCount) return a;
  if (bCount > aCount) return b;
  return a;
}

export function syncAsvPhotoGroupsAndFlat(groups: AsvPhotoGroup[]): {
  photoGroups: AsvPhotoGroup[];
  photos: AsvPhotoMeta[];
} {
  const photoGroups = enforcePhotoGroupLimit(groups);
  return { photoGroups, photos: flattenAsvPhotoGroups(photoGroups) };
}
