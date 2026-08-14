/** Starptautiskās vēstures avota fotogrāfijas — vizuālie pierādījumi PDF (līdz 50 gab.). */
export const CC_VIN_MAX_PHOTOS = 50;

export type CcVinPhotoMeta = {
  id: string;
};

export type CcVinPhotoGroup = {
  id: string;
  /** Manuāli ievadāms virsraksts PDF (piem. datums, izsole, bojājums). */
  title: string;
  photos: CcVinPhotoMeta[];
};

const PHOTO_ID_RE = /^ih_ph_[a-f0-9]{24}$/;
const PHOTO_GROUP_ID_RE = /^ih_phg_[a-f0-9]{24}$/;

export function isCcVinPhotoId(id: string): boolean {
  return PHOTO_ID_RE.test(id);
}

export function isCcVinPhotoGroupId(id: string): boolean {
  return PHOTO_GROUP_ID_RE.test(id);
}

export function makeCcVinPhotoGroupId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    return `ih_phg_${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  }
  let hex = "";
  for (let i = 0; i < 24; i++) {
    hex += Math.floor(Math.random() * 16).toString(16);
  }
  return `ih_phg_${hex}`;
}

export function emptyCcVinPhotoGroup(): CcVinPhotoGroup {
  return { id: makeCcVinPhotoGroupId(), title: "", photos: [] };
}

export function normalizeCcVinPhotos(raw: unknown): CcVinPhotoMeta[] {
  if (!Array.isArray(raw)) return [];
  const out: CcVinPhotoMeta[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const id = typeof (item as { id?: unknown }).id === "string" ? (item as { id: string }).id.trim() : "";
    if (!isCcVinPhotoId(id)) continue;
    if (out.some((p) => p.id === id)) continue;
    out.push({ id });
    if (out.length >= CC_VIN_MAX_PHOTOS) break;
  }
  return out;
}

function trimPhotoGroupTitle(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().slice(0, 120) : "";
}

function enforcePhotoGroupLimit(groups: CcVinPhotoGroup[]): CcVinPhotoGroup[] {
  const out: CcVinPhotoGroup[] = [];
  let total = 0;
  for (const group of groups) {
    const remaining = CC_VIN_MAX_PHOTOS - total;
    if (remaining <= 0) break;
    const photos = group.photos.slice(0, remaining);
    total += photos.length;
    if (photos.length === 0 && !group.title.trim()) continue;
    out.push({ ...group, photos });
  }
  return out;
}

/** Normalizē grupas; ja nav grupu, bet ir plakanais `photos` — viena grupa bez virsraksta. */
export function normalizeCcVinPhotoGroups(rawGroups: unknown, legacyPhotos?: unknown): CcVinPhotoGroup[] {
  if (Array.isArray(rawGroups) && rawGroups.length > 0) {
    const out: CcVinPhotoGroup[] = [];
    for (const item of rawGroups) {
      if (!item || typeof item !== "object") continue;
      const o = item as { id?: unknown; title?: unknown; photos?: unknown };
      const id =
        typeof o.id === "string" && isCcVinPhotoGroupId(o.id.trim()) ? o.id.trim() : makeCcVinPhotoGroupId();
      const title = trimPhotoGroupTitle(o.title);
      const photos = normalizeCcVinPhotos(o.photos);
      if (photos.length === 0 && !title) continue;
      out.push({ id, title, photos });
    }
    if (out.length > 0) return enforcePhotoGroupLimit(out);
  }

  const flat = normalizeCcVinPhotos(legacyPhotos);
  if (flat.length === 0) return [];
  return [{ id: makeCcVinPhotoGroupId(), title: "", photos: flat }];
}

export function flattenCcVinPhotoGroups(groups: CcVinPhotoGroup[] | null | undefined): CcVinPhotoMeta[] {
  const out: CcVinPhotoMeta[] = [];
  const seen = new Set<string>();
  for (const group of groups ?? []) {
    for (const photo of group.photos ?? []) {
      if (!photo?.id || seen.has(photo.id)) continue;
      seen.add(photo.id);
      out.push({ id: photo.id });
      if (out.length >= CC_VIN_MAX_PHOTOS) return out;
    }
  }
  return out;
}

export function countCcVinPhotos(groups: CcVinPhotoGroup[] | null | undefined): number {
  return flattenCcVinPhotoGroups(groups).length;
}

/** Apvieno grupas — garāks kopējais foto skaits uzvar; vienāds skaits → ienākošā struktūra. */
export function mergeCcVinPhotoGroups(
  incomingGroups: CcVinPhotoGroup[] | null | undefined,
  incomingLegacyPhotos: CcVinPhotoMeta[] | null | undefined,
  baselineGroups: CcVinPhotoGroup[] | null | undefined,
  baselineLegacyPhotos: CcVinPhotoMeta[] | null | undefined,
): CcVinPhotoGroup[] {
  const a = normalizeCcVinPhotoGroups(incomingGroups, incomingLegacyPhotos);
  const b = normalizeCcVinPhotoGroups(baselineGroups, baselineLegacyPhotos);
  const aCount = countCcVinPhotos(a);
  const bCount = countCcVinPhotos(b);
  if (aCount > bCount) return a;
  if (bCount > aCount) return b;
  return a;
}

export function syncCcVinPhotoGroupsAndFlat(groups: CcVinPhotoGroup[]): {
  photoGroups: CcVinPhotoGroup[];
  photos: CcVinPhotoMeta[];
} {
  const photoGroups = enforcePhotoGroupLimit(groups);
  return { photoGroups, photos: flattenCcVinPhotoGroups(photoGroups) };
}
