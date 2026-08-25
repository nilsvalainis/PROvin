/** Negadījumu kopsavilkuma fotogrāfijas — PDF zem apraksta (līdz 20 gab.). */
export const INCIDENT_MAX_PHOTOS = 20;

export type IncidentPhotoMeta = {
  id: string;
};

export type IncidentPhotoGroup = {
  id: string;
  /** Manuāli ievadāms virsraksts PDF (piem. datums, avots). */
  title: string;
  photos: IncidentPhotoMeta[];
};

const PHOTO_ID_RE = /^inc_ph_[a-f0-9]{24}$/;
const PHOTO_GROUP_ID_RE = /^inc_phg_[a-f0-9]{24}$/;

export function isIncidentPhotoId(id: string): boolean {
  return PHOTO_ID_RE.test(id);
}

export function isIncidentPhotoGroupId(id: string): boolean {
  return PHOTO_GROUP_ID_RE.test(id);
}

export function makeIncidentPhotoGroupId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    return `inc_phg_${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  }
  let hex = "";
  for (let i = 0; i < 24; i++) {
    hex += Math.floor(Math.random() * 16).toString(16);
  }
  return `inc_phg_${hex}`;
}

export function emptyIncidentPhotoGroup(): IncidentPhotoGroup {
  return { id: makeIncidentPhotoGroupId(), title: "", photos: [] };
}

export function normalizeIncidentPhotos(raw: unknown): IncidentPhotoMeta[] {
  if (!Array.isArray(raw)) return [];
  const out: IncidentPhotoMeta[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const id = typeof (item as { id?: unknown }).id === "string" ? (item as { id: string }).id.trim() : "";
    if (!isIncidentPhotoId(id)) continue;
    if (out.some((p) => p.id === id)) continue;
    out.push({ id });
    if (out.length >= INCIDENT_MAX_PHOTOS) break;
  }
  return out;
}

function trimPhotoGroupTitle(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().slice(0, 120) : "";
}

function enforcePhotoGroupLimit(groups: IncidentPhotoGroup[]): IncidentPhotoGroup[] {
  const out: IncidentPhotoGroup[] = [];
  let total = 0;
  for (const group of groups) {
    const remaining = INCIDENT_MAX_PHOTOS - total;
    if (remaining <= 0) break;
    const photos = group.photos.slice(0, remaining);
    total += photos.length;
    if (photos.length === 0 && !group.title.trim()) continue;
    out.push({ ...group, photos });
  }
  return out;
}

/** Normalizē grupas; ja nav grupu, bet ir vecais plakanais `photos` — viena grupa bez virsraksta. */
export function normalizeIncidentPhotoGroups(
  rawGroups: unknown,
  legacyPhotos?: unknown,
): IncidentPhotoGroup[] {
  if (Array.isArray(rawGroups) && rawGroups.length > 0) {
    const out: IncidentPhotoGroup[] = [];
    for (const item of rawGroups) {
      if (!item || typeof item !== "object") continue;
      const o = item as { id?: unknown; title?: unknown; photos?: unknown };
      const id =
        typeof o.id === "string" && isIncidentPhotoGroupId(o.id.trim())
          ? o.id.trim()
          : makeIncidentPhotoGroupId();
      const title = trimPhotoGroupTitle(o.title);
      const photos = normalizeIncidentPhotos(o.photos);
      if (photos.length === 0 && !title) continue;
      out.push({ id, title, photos });
    }
    if (out.length > 0) return enforcePhotoGroupLimit(out);
  }

  const flat = normalizeIncidentPhotos(legacyPhotos);
  if (flat.length === 0) return [];
  return [{ id: makeIncidentPhotoGroupId(), title: "", photos: flat }];
}

export function flattenIncidentPhotoGroups(
  groups: IncidentPhotoGroup[] | null | undefined,
): IncidentPhotoMeta[] {
  const out: IncidentPhotoMeta[] = [];
  const seen = new Set<string>();
  for (const group of groups ?? []) {
    for (const photo of group.photos ?? []) {
      if (!photo?.id || seen.has(photo.id)) continue;
      seen.add(photo.id);
      out.push({ id: photo.id });
      if (out.length >= INCIDENT_MAX_PHOTOS) return out;
    }
  }
  return out;
}

export function countIncidentPhotos(groups: IncidentPhotoGroup[] | null | undefined): number {
  return flattenIncidentPhotoGroups(groups).length;
}

/** PATCH merge — nekad nezaudē vairāk fotogrāfiju; vienāda skaita gadījumā ienākošā secība (kārtošana). */
export function mergeIncidentPhotoLists(
  incoming: IncidentPhotoMeta[] | null | undefined,
  baseline: IncidentPhotoMeta[] | null | undefined,
): IncidentPhotoMeta[] {
  const a = normalizeIncidentPhotos(incoming);
  const b = normalizeIncidentPhotos(baseline);
  if (a.length > b.length) return a;
  if (b.length > a.length) return b;
  return a;
}

/** Apvieno grupas — garāks kopējais foto skaits uzvar; vienāds skaits → ienākošā struktūra (virsraksti, secība). */
export function mergeIncidentPhotoGroups(
  incomingGroups: IncidentPhotoGroup[] | null | undefined,
  incomingLegacyPhotos: IncidentPhotoMeta[] | null | undefined,
  baselineGroups: IncidentPhotoGroup[] | null | undefined,
  baselineLegacyPhotos: IncidentPhotoMeta[] | null | undefined,
): IncidentPhotoGroup[] {
  const a = normalizeIncidentPhotoGroups(incomingGroups, incomingLegacyPhotos);
  const b = normalizeIncidentPhotoGroups(baselineGroups, baselineLegacyPhotos);
  const aCount = countIncidentPhotos(a);
  const bCount = countIncidentPhotos(b);
  if (aCount > bCount) return a;
  if (bCount > aCount) return b;
  return a;
}

export function syncIncidentPhotoGroupsAndFlat(
  groups: IncidentPhotoGroup[],
): { photoGroups: IncidentPhotoGroup[]; photos: IncidentPhotoMeta[] } {
  const photoGroups = enforcePhotoGroupLimit(groups);
  return { photoGroups, photos: flattenIncidentPhotoGroups(photoGroups) };
}

/** Nolasa foto laukus no darba zonas JSON (grupas + plakanais saraksts). */
export function incidentPhotosFromUnknown(
  photoGroups: unknown,
  photos: unknown,
): { incidentPhotoGroups: IncidentPhotoGroup[]; incidentPhotos: IncidentPhotoMeta[] } {
  const synced = syncIncidentPhotoGroupsAndFlat(normalizeIncidentPhotoGroups(photoGroups, photos));
  return { incidentPhotoGroups: synced.photoGroups, incidentPhotos: synced.photos };
}
