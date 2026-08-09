/** Oficiālā dīlera fotogrāfijas — vizuālie pierādījumi PDF (līdz 50 gab.). */
export const AUTO_RECORDS_MAX_PHOTOS = 50;

export type AutoRecordsPhotoMeta = {
  id: string;
};

export type AutoRecordsPhotoGroup = {
  id: string;
  /** Manuāli ievadāms virsraksts PDF (piem. datums, avots). */
  title: string;
  photos: AutoRecordsPhotoMeta[];
};

const PHOTO_ID_RE = /^ar_ph_[a-f0-9]{24}$/;
const PHOTO_GROUP_ID_RE = /^ar_phg_[a-f0-9]{24}$/;

export function isAutoRecordsPhotoId(id: string): boolean {
  return PHOTO_ID_RE.test(id);
}

export function isAutoRecordsPhotoGroupId(id: string): boolean {
  return PHOTO_GROUP_ID_RE.test(id);
}

export function makeAutoRecordsPhotoGroupId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    return `ar_phg_${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  }
  let hex = "";
  for (let i = 0; i < 24; i++) {
    hex += Math.floor(Math.random() * 16).toString(16);
  }
  return `ar_phg_${hex}`;
}

export function emptyAutoRecordsPhotoGroup(): AutoRecordsPhotoGroup {
  return { id: makeAutoRecordsPhotoGroupId(), title: "", photos: [] };
}

export function normalizeAutoRecordsPhotos(raw: unknown): AutoRecordsPhotoMeta[] {
  if (!Array.isArray(raw)) return [];
  const out: AutoRecordsPhotoMeta[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const id = typeof (item as { id?: unknown }).id === "string" ? (item as { id: string }).id.trim() : "";
    if (!isAutoRecordsPhotoId(id)) continue;
    if (out.some((p) => p.id === id)) continue;
    out.push({ id });
    if (out.length >= AUTO_RECORDS_MAX_PHOTOS) break;
  }
  return out;
}

function trimPhotoGroupTitle(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().slice(0, 120) : "";
}

function enforcePhotoGroupLimit(groups: AutoRecordsPhotoGroup[]): AutoRecordsPhotoGroup[] {
  const out: AutoRecordsPhotoGroup[] = [];
  let total = 0;
  for (const group of groups) {
    const remaining = AUTO_RECORDS_MAX_PHOTOS - total;
    if (remaining <= 0) break;
    const photos = group.photos.slice(0, remaining);
    total += photos.length;
    if (photos.length === 0 && !group.title.trim()) continue;
    out.push({ ...group, photos });
  }
  return out;
}

/** Normalizē grupas; ja nav grupu, bet ir vecais plakanais `photos` — viena grupa bez virsraksta. */
export function normalizeAutoRecordsPhotoGroups(
  rawGroups: unknown,
  legacyPhotos?: unknown,
): AutoRecordsPhotoGroup[] {
  if (Array.isArray(rawGroups) && rawGroups.length > 0) {
    const out: AutoRecordsPhotoGroup[] = [];
    for (const item of rawGroups) {
      if (!item || typeof item !== "object") continue;
      const o = item as { id?: unknown; title?: unknown; photos?: unknown };
      const id =
        typeof o.id === "string" && isAutoRecordsPhotoGroupId(o.id.trim())
          ? o.id.trim()
          : makeAutoRecordsPhotoGroupId();
      const title = trimPhotoGroupTitle(o.title);
      const photos = normalizeAutoRecordsPhotos(o.photos);
      if (photos.length === 0 && !title) continue;
      out.push({ id, title, photos });
    }
    if (out.length > 0) return enforcePhotoGroupLimit(out);
  }

  const flat = normalizeAutoRecordsPhotos(legacyPhotos);
  if (flat.length === 0) return [];
  return [{ id: makeAutoRecordsPhotoGroupId(), title: "", photos: flat }];
}

export function flattenAutoRecordsPhotoGroups(
  groups: AutoRecordsPhotoGroup[] | null | undefined,
): AutoRecordsPhotoMeta[] {
  const out: AutoRecordsPhotoMeta[] = [];
  const seen = new Set<string>();
  for (const group of groups ?? []) {
    for (const photo of group.photos ?? []) {
      if (!photo?.id || seen.has(photo.id)) continue;
      seen.add(photo.id);
      out.push({ id: photo.id });
      if (out.length >= AUTO_RECORDS_MAX_PHOTOS) return out;
    }
  }
  return out;
}

export function countAutoRecordsPhotos(groups: AutoRecordsPhotoGroup[] | null | undefined): number {
  return flattenAutoRecordsPhotoGroups(groups).length;
}

/** PATCH merge — nekad nezaudē vairāk fotogrāfiju; vienāda skaita gadījumā ienākošā secība (kārtošana). */
export function mergeAutoRecordsPhotoLists(
  incoming: AutoRecordsPhotoMeta[] | null | undefined,
  baseline: AutoRecordsPhotoMeta[] | null | undefined,
): AutoRecordsPhotoMeta[] {
  const a = normalizeAutoRecordsPhotos(incoming);
  const b = normalizeAutoRecordsPhotos(baseline);
  if (a.length > b.length) return a;
  if (b.length > a.length) return b;
  return a;
}

/** Apvieno grupas — garāks kopējais foto skaits uzvar; vienāds skaits → ienākošā struktūra (virsraksti, secība). */
export function mergeAutoRecordsPhotoGroups(
  incomingGroups: AutoRecordsPhotoGroup[] | null | undefined,
  incomingLegacyPhotos: AutoRecordsPhotoMeta[] | null | undefined,
  baselineGroups: AutoRecordsPhotoGroup[] | null | undefined,
  baselineLegacyPhotos: AutoRecordsPhotoMeta[] | null | undefined,
): AutoRecordsPhotoGroup[] {
  const a = normalizeAutoRecordsPhotoGroups(incomingGroups, incomingLegacyPhotos);
  const b = normalizeAutoRecordsPhotoGroups(baselineGroups, baselineLegacyPhotos);
  const aCount = countAutoRecordsPhotos(a);
  const bCount = countAutoRecordsPhotos(b);
  if (aCount > bCount) return a;
  if (bCount > aCount) return b;
  return a;
}

export function syncAutoRecordsPhotoGroupsAndFlat(
  groups: AutoRecordsPhotoGroup[],
): { photoGroups: AutoRecordsPhotoGroup[]; photos: AutoRecordsPhotoMeta[] } {
  const photoGroups = enforcePhotoGroupLimit(groups);
  return { photoGroups, photos: flattenAutoRecordsPhotoGroups(photoGroups) };
}
