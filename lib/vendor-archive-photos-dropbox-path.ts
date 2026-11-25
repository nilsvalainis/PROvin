/**
 * Arhīva foto kopija pasūtījuma Dropbox mapē (Nils 25.11): `Arhīva foto/<Avots> <datums>/NN.jpg`.
 * Tīrs modulis - plāns, ko augšupielādēt (bez Dropbox klienta).
 */

import { sanitizeDropboxName } from "@/lib/iriss-autoparks-dropbox-path";
import { VENDOR_ARCHIVE_SOURCE_LABEL, type VendorArchiveGroupMeta, type VendorArchiveSource } from "@/lib/vendor-archive-photo-group";

export const ARCHIVE_DROPBOX_ROOT = "Arhīva foto";

type ArchiveGroupLike = { photos: { id: string }[]; archive?: Pick<VendorArchiveGroupMeta, "source" | "date"> };

/** Apakšmapes nosaukums: «AutoDNA 12.11.2024» / «CarVertical 07.2020» (bez datuma - «AutoDNA»). */
export function archiveDropboxGroupFolder(source: VendorArchiveSource, date: string): string {
  return sanitizeDropboxName([VENDOR_ARCHIVE_SOURCE_LABEL[source], date.trim()].filter(Boolean).join(" "), 80) || "Arhīvs";
}

export function archiveDropboxFileName(index: number): string {
  return `${String(index + 1).padStart(2, "0")}.jpg`;
}

export type ArchiveDropboxPlanItem = { folder: string; name: string; photoId: string; overwrite: boolean };

/**
 * Visas šī avota arhīva grupas (tirgus + izsoļu arhīvs) -> faili. Tā paša avota + datuma grupas vienā mapē, numerācija
 * turpinās. `existing` - mapē jau esošie faili (mape -> nosaukumi, mazie burti): tos izlaiž, izņemot `upgraded` bildes
 * (releja pilnā bilde aizstāj PDF sīktēlu -> pārraksta).
 */
export function planArchiveDropboxUploads(args: {
  groups: readonly ArchiveGroupLike[];
  source: VendorArchiveSource;
  existing: ReadonlyMap<string, ReadonlySet<string>>;
  upgraded?: ReadonlySet<string>;
}): ArchiveDropboxPlanItem[] {
  const counters = new Map<string, number>();
  const seenIds = new Set<string>();
  const out: ArchiveDropboxPlanItem[] = [];
  for (const g of args.groups) {
    if (!g.archive || g.archive.source !== args.source) continue;
    const folder = archiveDropboxGroupFolder(g.archive.source, g.archive.date);
    for (const p of g.photos) {
      if (seenIds.has(p.id)) continue;
      seenIds.add(p.id);
      const i = counters.get(folder) ?? 0;
      counters.set(folder, i + 1);
      const name = archiveDropboxFileName(i);
      const exists = args.existing.get(folder)?.has(name.toLowerCase()) ?? false;
      const overwrite = Boolean(args.upgraded?.has(p.id));
      if (exists && !overwrite) continue;
      out.push({ folder, name, photoId: p.id, overwrite: exists && overwrite });
    }
  }
  return out;
}

/** Dropbox mapes, kurās ir šī avota arhīva foto (unikālas, secībā). */
export function archiveDropboxFolders(groups: readonly ArchiveGroupLike[], source: VendorArchiveSource): string[] {
  const out: string[] = [];
  for (const g of groups) {
    if (!g.archive || g.archive.source !== source || !g.photos.length) continue;
    const f = archiveDropboxGroupFolder(g.archive.source, g.archive.date);
    if (!out.includes(f)) out.push(f);
  }
  return out;
}
