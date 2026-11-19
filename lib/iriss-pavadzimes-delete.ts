/**
 * Pavadzīmju saraksts: viena ieraksta dzēšana (tikai administrators). Tikai mūsu indekss + tā PDF kopija Blob/diskā.
 * CSDD un Dropbox netiek aiztikti. Lai Dropbox sinhronizācija ierakstu neatjaunotu, indeksā paliek atzīme (tombstone).
 */

import type { IrissPavadzimeRecord, IrissPavadzimesIndex, IrissPavadzimeTombstone } from "@/lib/iriss-pavadzimes-types";

/** Cik atzīmes glabā (vecākās izkrīt; tad tikai Dropbox faila dzēšana neļauj tam atgriezties). */
export const IRISS_PAVADZIME_TOMBSTONES_MAX = 500;

export function parseTombstones(raw: unknown): IrissPavadzimeTombstone[] {
  if (!Array.isArray(raw)) return [];
  const out: IrissPavadzimeTombstone[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const id = str(o.id, 120);
    if (!id) continue;
    out.push({ id, number: str(o.number, 24).toUpperCase(), dropboxId: str(o.dropboxId, 200), deletedAt: str(o.deletedAt, 40), by: str(o.by, 80) });
  }
  return out.slice(-IRISS_PAVADZIME_TOMBSTONES_MAX);
}

/** Vai Dropbox fails / ieraksts ir dzēsts (pēc id, Dropbox id vai CSDD numura). */
export function isWaybillTombstoned(
  tombstones: readonly IrissPavadzimeTombstone[] | undefined,
  item: { id?: string; number?: string; dropboxId?: string },
): boolean {
  if (!tombstones?.length) return false;
  const id = (item.id ?? "").trim();
  const number = (item.number ?? "").trim().toUpperCase();
  const dropboxId = (item.dropboxId ?? "").trim();
  return tombstones.some(
    (t) => (id && t.id === id) || (number && t.number && t.number === number) || (dropboxId && t.dropboxId && t.dropboxId === dropboxId),
  );
}

export type RemoveWaybillResult =
  | { ok: true; index: IrissPavadzimesIndex; removed: IrissPavadzimeRecord }
  | { ok: false; reason: "not_found" };

/** Noņem TIEŠI vienu ierakstu pēc id; pārējie paliek nemainīti. Atzīme neļauj sinhronizācijai to atjaunot. */
export function removeWaybillFromIndex(index: IrissPavadzimesIndex, id: string, by: string, nowIso: string): RemoveWaybillResult {
  const removed = index.items.find((row) => row.id === id);
  if (!removed) return { ok: false, reason: "not_found" };
  const tombstone: IrissPavadzimeTombstone = {
    id: removed.id,
    number: removed.number.trim().toUpperCase(),
    dropboxId: removed.dropboxId,
    deletedAt: nowIso,
    by: by.slice(0, 80),
  };
  return {
    ok: true,
    removed,
    index: {
      ...index,
      updatedAt: nowIso,
      items: index.items.filter((row) => row.id !== id),
      deleted: [...(index.deleted ?? []).filter((t) => t.id !== removed.id), tombstone].slice(-IRISS_PAVADZIME_TOMBSTONES_MAX),
    },
  };
}

/** Atkārtota augšupielāde (vai jauns rezultāts) ar šo numuru ir apzināta: atzīmi noņem, ieraksts atkal redzams. */
export function clearTombstonesForNumber(
  tombstones: readonly IrissPavadzimeTombstone[] | undefined,
  number: string,
): IrissPavadzimeTombstone[] {
  const no = number.trim().toUpperCase();
  return (tombstones ?? []).filter((t) => !no || t.number !== no);
}

/** Derīgu (aktīvu) pavadzīmi no saraksta dzēst nedrīkst: numurs izskatītos brīvs. Vispirms «Pārtraukt». */
export function waybillDeleteBlocked(
  rec: Pick<IrissPavadzimeRecord, "validUntil" | "archived">,
  lifecycle: string | undefined,
  nowMs = Date.now(),
): boolean {
  if (rec.archived || lifecycle === "interrupted" || lifecycle === "expired") return false;
  const until = Date.parse(rec.validUntil);
  return Number.isFinite(until) && until > nowMs;
}

/** Apstiprinājuma jautājums: «Vai tiešām dzēst P02812 (MB E250)?». */
export function waybillDeleteConfirmText(row: Pick<IrissPavadzimeRecord, "number" | "brandModel" | "fileName">): string {
  const no = row.number.trim();
  const car = row.brandModel.trim();
  const name = no ? (car ? `${no} (${car})` : no) : car || row.fileName.trim() || "šo pavadzīmi";
  return `Vai tiešām dzēst ${name}?`;
}
