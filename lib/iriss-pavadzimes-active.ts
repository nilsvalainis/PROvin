import { waybillValidityTone } from "@/lib/iriss-pavadzimes-parse";
import type { IrissPavadzimeListRow, IrissPavadzimeRecord } from "@/lib/iriss-pavadzimes-types";

/** CSDD tirdzniecības nr. (B193-7). */
const DEALER_PLATE_RE = /^[A-Z]\d{3}-\d$/;
/** Beigusies pavadzīme paliek „aktuāla”, ja beidzās pēdējo 21 dienu laikā. */
const RECENT_EXPIRED_MS = 21 * 24 * 60 * 60 * 1000;

type WaybillPick = {
  plate: string;
  validUntil: string;
  issuedAt: string;
  number: string;
};

function ts(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

/** Lielāks = jaunāka / pašreizējā pavadzīme šim numuram. */
export function compareWaybillRecency(a: WaybillPick, b: WaybillPick): number {
  const until = ts(a.validUntil) - ts(b.validUntil);
  if (until !== 0) return until;
  const issued = ts(a.issuedAt) - ts(b.issuedAt);
  if (issued !== 0) return issued;
  return a.number.localeCompare(b.number, "lv");
}

/**
 * Viena pašreizējā pavadzīme uz katru tirdzniecības nr.
 * Parasti 3 dīlera numuri; vēstures numurus (sen beigušies) neatstāj.
 */
export function selectActiveIrissPavadzimes<T extends WaybillPick>(rows: T[], now = new Date()): T[] {
  const nowMs = now.getTime();
  const byPlate = new Map<string, T>();
  const unplatedCurrent: T[] = [];

  for (const row of rows) {
    const plate = row.plate.trim().toUpperCase();
    if (plate && DEALER_PLATE_RE.test(plate)) {
      const prev = byPlate.get(plate);
      if (!prev || compareWaybillRecency(row, prev) > 0) byPlate.set(plate, row);
      continue;
    }
    const until = ts(row.validUntil);
    if (until >= nowMs) unplatedCurrent.push(row);
  }

  const latest = [...byPlate.values()].filter((row) => {
    const until = ts(row.validUntil);
    if (!until) return Boolean(row.issuedAt || row.number);
    return until >= nowMs - RECENT_EXPIRED_MS;
  });

  return [...latest, ...unplatedCurrent].sort((a, b) => {
    const pa = a.plate.trim().toUpperCase();
    const pb = b.plate.trim().toUpperCase();
    if (pa && pb && pa !== pb) return pa.localeCompare(pb, "lv");
    return compareWaybillRecency(b, a);
  });
}

export function toActiveWaybillRows(rows: IrissPavadzimeRecord[], now = new Date()): IrissPavadzimeListRow[] {
  return selectActiveIrissPavadzimes(rows, now).map((row) => ({
    ...row,
    validityTone: waybillValidityTone(row.validUntil, now),
    order: null,
  }));
}
