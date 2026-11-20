import "server-only";

/**
 * Piedāvājumu saraksta rindas rādīšanai (tikai lasīšana, krātuvē neko neraksta).
 * Vecās indeksa rindās nav `sourceUrl` un cena ir tikai `price` (no Sludinājumiem veidotajiem tā tukša,
 * jo summa ir cenu blokā) - šīm rindām nolasa pilno ierakstu. Kad ieraksts tiek saglabāts, indekss
 * atjaunojas pats (`irissPdToListRow`), un papildu lasījumi vairs nav vajadzīgi.
 */

import { irissPdToListRow } from "@/lib/iriss-piedavajumi";
import { irissPdDisplayVin, irissPdEffectiveSource } from "@/lib/iriss-piedavajumi-list-display";
import type { IrissPdListRow, IrissPiedavajums } from "@/lib/iriss-piedavajumi-types";

/** Cik vecās rindas vienā ielādē drīkst papildināt no pilnā ieraksta. */
export const IRISS_PD_LIST_ENRICH_MAX = 60;

const LINK_SOURCES = new Set(["auto1", "autobid", "openlane", "ecarstrade", "mobilede", "autoscout24", "manual"]);

/** Tikai vecā formāta rinda (bez `sourceUrl`), kurai trūkst cenas vai var būt cita avota etiķete. */
export function irissPdRowNeedsRecord(row: IrissPdListRow): boolean {
  if (row.sourceUrl !== undefined) return false;
  return !row.price.trim() || LINK_SOURCES.has(row.source);
}

/** Rinda sarakstam: VIN tikai ticams, avots pēc izsoles saites. */
export function irissPdRowForDisplay(row: IrissPdListRow): IrissPdListRow {
  return { ...row, vin: irissPdDisplayVin(row.vin), source: irissPdEffectiveSource(row.source, row.sourceUrl) };
}

export async function irissPdRowsForDisplay(
  rows: IrissPdListRow[],
  readRecord: (id: string) => Promise<IrissPiedavajums | null>,
  max = IRISS_PD_LIST_ENRICH_MAX,
): Promise<IrissPdListRow[]> {
  const need = rows.filter(irissPdRowNeedsRecord).slice(0, max);
  const fresh = new Map<string, IrissPdListRow>();
  const queue = [...need];
  const worker = async () => {
    for (let r = queue.shift(); r; r = queue.shift()) {
      const rec = await readRecord(r.id).catch(() => null);
      if (rec) fresh.set(r.id, irissPdToListRow(rec));
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, queue.length) }, worker));
  return rows.map((r) => irissPdRowForDisplay(fresh.get(r.id) ?? r));
}
