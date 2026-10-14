/**
 * K1: dzēsto bilžu „kapakmeņi”. Melnraksts glabā `deletedPhotoIds`; apvienošana (local/backup/server)
 * vienmēr izfiltrē šos id no visām foto grupām, tāpēc „bagātākā puse uzvar” vairs nevar atgriezt dzēstu bildi.
 * PDF un raw importi netiek mainīti: tie lasa tikai grupās palikušās bildes.
 */
export const MAX_DELETED_PHOTO_IDS = 2000;

export function parseDeletedPhotoIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const id = v.trim();
    if (!id || id.length > 200 || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MAX_DELETED_PHOTO_IDS) break;
  }
  return out;
}

/** Jaunākie (pirmais saraksts) priekšā; dublikāti izmesti. */
export function mergeDeletedPhotoIds(...lists: unknown[]): string[] {
  return parseDeletedPhotoIds(lists.flatMap((l) => (Array.isArray(l) ? l : [])));
}

export function deletedPhotoIdsSnapshotField(raw: unknown): { deletedPhotoIds?: string[] } {
  const ids = parseDeletedPhotoIds(raw);
  return ids.length ? { deletedPhotoIds: ids } : {};
}

function isPhotoArray(v: unknown): v is Array<{ id?: unknown }> {
  return Array.isArray(v) && v.every((x) => x && typeof x === "object" && typeof (x as { id?: unknown }).id === "string");
}

/** Visi foto id (grupās un plakanajos `photos` sarakstos) dotajā vērtībā. */
export function collectWorkspacePhotoIds(value: unknown, out: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const v of value) collectWorkspacePhotoIds(v, out);
    return out;
  }
  if (!value || typeof value !== "object") return out;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (k === "photos" && isPhotoArray(v)) {
      for (const p of v) out.add(String(p.id));
    } else if (v && typeof v === "object") {
      collectWorkspacePhotoIds(v, out);
    }
  }
  return out;
}

/** Izņem dzēstos id no visiem `photos` sarakstiem (dziļi) un `coverPhoto`. Nemaina neko citu. */
export function stripDeletedPhotos<T>(value: T, deleted: ReadonlySet<string>): T {
  if (deleted.size === 0) return value;
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) {
      let changed = false;
      const next = v.map((x) => {
        const y = walk(x);
        if (y !== x) changed = true;
        return y;
      });
      return changed ? next : v;
    }
    if (!v || typeof v !== "object") return v;
    const o = v as Record<string, unknown>;
    let out: Record<string, unknown> | null = null;
    for (const [k, val] of Object.entries(o)) {
      let nextVal: unknown = val;
      if (k === "photos" && isPhotoArray(val)) {
        const kept = val.filter((p) => !deleted.has(String(p.id)));
        if (kept.length !== val.length) nextVal = kept;
      } else if (k === "coverPhoto" && val && typeof val === "object" && deleted.has(String((val as { id?: unknown }).id))) {
        nextVal = null;
      } else if (val && typeof val === "object") {
        nextVal = walk(val);
      }
      if (nextVal !== val) {
        out ??= { ...o };
        out[k] = nextVal;
      }
    }
    return out ?? v;
  };
  return walk(value) as T;
}

/** Id, kas bija `prev`, bet vairs nav `next` (lietotāja dzēšana). Pārvietošana starp grupām nav dzēšana. */
export function removedPhotoIds(prev: unknown, next: unknown): string[] {
  const a = collectWorkspacePhotoIds(prev);
  const b = collectWorkspacePhotoIds(next);
  return [...a].filter((id) => !b.has(id));
}
