/**
 * Automātiskā titulbilde no AutoDNA / CarVertical arhīva foto (Nils 25.11):
 * ja «Sludinājuma analīze -> PDF augšas bilde» ir tukša, ieliek ārpuses priekšas foto no arhīva.
 *
 * Heuristika (AI attēlu klasifikācijas kodā nav): jaunākā datuma arhīva grupa, tajā pirmā horizontālā bilde
 * no pirmajām trim (sludinājumos 1. foto parasti ir priekša 3/4). Nila izvēlēto vai noņemto (`null`) titulbildi
 * nekad neaiztiek.
 *
 * Tīrs modulis (bez sharp / Blob).
 */

import type { VendorArchiveGroupMeta, VendorArchiveSource } from "@/lib/vendor-archive-photo-group";

type ArchiveGroupLike = { photos: { id: string }[]; archive?: Pick<VendorArchiveGroupMeta, "source" | "date"> };

/** Cik pirmās grupas bildes skatīties, meklējot horizontālu (ārpuses) foto. */
export const ARCHIVE_COVER_LOOKAHEAD = 3;

/** «12.11.2024» / «07.2020» / «2020» -> salīdzināms skaitlis (yyyymmdd); nezināms = 0. */
export function archiveDateSortKey(date: string): number {
  const t = date.trim();
  let m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t);
  if (m) return Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1]);
  m = /^(\d{1,2})\.(\d{4})$/.exec(t);
  if (m) return Number(m[2]) * 10000 + Number(m[1]) * 100;
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]);
  m = /^(\d{4})$/.exec(t);
  if (m) return Number(m[1]) * 10000;
  return 0;
}

/** Vai titulbildi drīkst aizpildīt automātiski: tikai ja lauks nekad nav aizpildīts (`undefined`). */
export function archiveCoverAllowed(coverPhoto: { id: string } | null | undefined): boolean {
  return coverPhoto === undefined;
}

/**
 * Kandidāti titulbildei secībā: jaunākā arhīva grupa pirmā; grupā pirmās `ARCHIVE_COVER_LOOKAHEAD` bildes.
 * `sources` - ierobežo avotus (piem. tikai tikko importētais).
 */
export function archiveCoverCandidates(
  groups: readonly ArchiveGroupLike[],
  sources?: readonly VendorArchiveSource[],
): { photoId: string; source: VendorArchiveSource; date: string }[] {
  const archived = groups
    .map((g, idx) => ({ g, idx }))
    .filter(({ g }) => g.archive && g.photos.length && (!sources || sources.includes(g.archive.source)))
    .sort((a, b) => archiveDateSortKey(b.g.archive!.date) - archiveDateSortKey(a.g.archive!.date) || a.idx - b.idx);
  const out: { photoId: string; source: VendorArchiveSource; date: string }[] = [];
  for (const { g } of archived) {
    for (const p of g.photos.slice(0, ARCHIVE_COVER_LOOKAHEAD)) {
      out.push({ photoId: p.id, source: g.archive!.source, date: g.archive!.date });
    }
  }
  return out;
}

/**
 * Izvēlas titulbildi no kandidātiem: pirmā horizontālā (platums ≥ augstums * 1,15) jaunākajā grupā;
 * ja tādas nav - grupas pirmā bilde. `dims` - zināmie izmēri (trūkstošās bildes izlaiž).
 */
export function pickArchiveCoverPhotoId(
  candidates: readonly { photoId: string; date: string }[],
  dims: ReadonlyMap<string, { width: number; height: number }>,
): string | null {
  const byDate = new Map<string, string[]>();
  for (const c of candidates) {
    if (!dims.has(c.photoId)) continue;
    const list = byDate.get(c.date) ?? [];
    list.push(c.photoId);
    byDate.set(c.date, list);
  }
  for (const ids of byDate.values()) {
    const landscape = ids.find((id) => {
      const d = dims.get(id)!;
      return d.width > 0 && d.width >= d.height * 1.15;
    });
    return landscape ?? ids[0] ?? null;
  }
  return null;
}
