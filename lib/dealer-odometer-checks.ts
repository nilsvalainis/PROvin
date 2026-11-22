/**
 * OFICIĀLĀ DĪLERA DATI: odometra secības pārbaudes servisa rindām.
 * Tikai fakti no ierakstiem (bez verdikta): nobraukuma kritums pret iepriekšējo ierakstu
 * un rādījums, kas izkrīt no monotonas secības (pārrakstīšanās), lai tas nebojā robu aprēķinu.
 */
import type { AutoRecordsServiceWorkRow } from "@/lib/auto-records-service-works";
import { parseDotOrIsoDateToMs } from "@/lib/clean-date-str";

/** Kritums līdz šim km skaitam ir pielaide (noapaļots / ar roku ievadīts rādījums). */
export const DEALER_ODOMETER_DROP_TOLERANCE_KM = 500;

type OdoRow = Pick<AutoRecordsServiceWorkRow, "date" | "odometer">;

function parseKm(odometer: string): number | null {
  const digits = (odometer ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Vecākais pirmais; vienā datumā mazākais km pirmais. Rindas bez datuma beigās. */
export function chronoDealerRows<T extends OdoRow>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    const ta = parseDotOrIsoDateToMs(a.date);
    const tb = parseDotOrIsoDateToMs(b.date);
    if (ta !== tb) {
      if (!ta) return 1;
      if (!tb) return -1;
      return ta - tb;
    }
    return (parseKm(a.odometer) ?? 0) - (parseKm(b.odometer) ?? 0);
  });
}

/** Mazāks kritums par šo (km vai daļa no iepriekšējā rādījuma) ir sīka nobīde - visticamāk ievades kļūda. */
export const DEALER_ODOMETER_MINOR_DROP_KM = 1_500;
export const DEALER_ODOMETER_MINOR_DROP_RATIO = 0.02;

/**
 * `input_error` = iespējama ievades kļūda (sīka nobīde vai viens izlecošs rādījums, pēc kura secība turpinās);
 * `significant` = būtisks kritums, kas secībā neatgūstas (rādāms sarkanā).
 */
export type DealerOdometerDropSeverity = "input_error" | "significant";

export type DealerOdometerDrop<T extends OdoRow = OdoRow> = {
  row: T;
  km: number;
  previous: T;
  previousKm: number;
  dropKm: number;
  severity: DealerOdometerDropSeverity;
};

/**
 * Ieraksti, kuru km ir mazāks par iepriekšējā (hronoloģiski) ieraksta km vairāk nekā pielaide.
 * Vairums šādu nesakritību ir ievades kļūdas, tāpēc trauksmi neceļ: „significant” tikai tad, ja kritums
 * ir būtisks UN ne šis, ne iepriekšējais rādījums nav viens izlecējs (nākamais ieraksts neatgriežas
 * iepriekšējā līmenī un ieraksts pirms iepriekšējā neapstiprina zemāko līmeni).
 * Piem. SJNFFAJ11U2507806: 52 235 -> 51 000 km (sīka nobīde); WBA5K11000D942446: 96 533 -> 90 205 km
 * (96 533 ir viens izlecējs, secība turpinās no 8x xxx km).
 */
export function findDealerOdometerDrops<T extends OdoRow>(rows: readonly T[]): DealerOdometerDrop<T>[] {
  const seq = chronoDealerRows(rows)
    .filter((r) => parseDotOrIsoDateToMs(r.date))
    .map((row) => ({ row, km: parseKm(row.odometer) }))
    .filter((x): x is { row: T; km: number } => x.km != null);
  const out: DealerOdometerDrop<T>[] = [];
  for (let i = 1; i < seq.length; i++) {
    const prev = seq[i - 1]!;
    const cur = seq[i]!;
    const dropKm = prev.km - cur.km;
    if (dropKm <= DEALER_ODOMETER_DROP_TOLERANCE_KM) continue;
    const minor =
      dropKm < DEALER_ODOMETER_MINOR_DROP_KM || dropKm < prev.km * DEALER_ODOMETER_MINOR_DROP_RATIO;
    const next = seq[i + 1];
    const beforePrev = seq[i - 2];
    // Šis rādījums ir viens izlecējs uz leju: nākamais ieraksts atgriežas iepriekšējā līmenī.
    const curIsolated = next != null && next.km >= prev.km - DEALER_ODOMETER_DROP_TOLERANCE_KM;
    // Iepriekšējais rādījums ir viens izlecējs uz augšu: secība pirms tā turpinās ar šo ierakstu.
    const prevIsolated = beforePrev != null && beforePrev.km <= cur.km + DEALER_ODOMETER_DROP_TOLERANCE_KM;
    out.push({
      row: cur.row,
      km: cur.km,
      previous: prev.row,
      previousKm: prev.km,
      dropKm,
      severity: minor || curIsolated || prevIsolated ? "input_error" : "significant",
    });
  }
  return out;
}

/**
 * Rādījumi, kas izkrīt no monotonas (nedilstošas) secības - visticamāk pārrakstīšanās.
 * Paliek garākā nedilstošā km secība; pārējie ir izlecēji.
 * Piem. WBAMW91010DV11581: 179 979 km starp ~318 000 km ierakstiem.
 */
export function findDealerOdometerOutliers<T extends OdoRow>(rows: readonly T[]): Set<T> {
  const withKm = chronoDealerRows(rows)
    .filter((r) => parseDotOrIsoDateToMs(r.date))
    .map((row) => ({ row, km: parseKm(row.odometer) }))
    .filter((x): x is { row: T; km: number } => x.km != null);
  const n = withKm.length;
  const outliers = new Set<T>();
  if (n < 3) return outliers;
  const len = new Array<number>(n).fill(1);
  const from = new Array<number>(n).fill(-1);
  let best = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) {
      if (withKm[j]!.km > withKm[i]!.km) continue;
      // Vienādā garumā priekšroka tuvākajam (lielākajam) priekštecim: izlecējs ir tas, kas izkrīt no līmeņa.
      const longer = len[j]! + 1 > len[i]!;
      const tieCloser = len[j]! + 1 === len[i]! && from[i]! >= 0 && withKm[j]!.km > withKm[from[i]!]!.km;
      if (longer || tieCloser) {
        len[i] = len[j]! + 1;
        from[i] = j;
      }
    }
    if (len[i]! >= len[best]!) best = i;
  }
  const keep = new Set<number>();
  for (let i = best; i >= 0; i = from[i]!) keep.add(i);
  for (let i = 0; i < n; i++) {
    if (keep.has(i)) continue;
    // Tikai skaidri izlecēji: starpība pret tuvāko paturēto kaimiņu pārsniedz pielaidi.
    let near = Number.POSITIVE_INFINITY;
    for (const k of [i - 1, i + 1]) {
      if (k >= 0 && k < n && keep.has(k)) near = Math.min(near, Math.abs(withKm[k]!.km - withKm[i]!.km));
    }
    if (near > DEALER_ODOMETER_DROP_TOLERANCE_KM) outliers.add(withKm[i]!.row);
  }
  return outliers;
}

/** Pilni mēneši no pēdējā datētā ieraksta līdz `nowMs` (noapaļoti); null, ja datuma nav vai nākotnē. */
export function monthsSinceLastDealerRecord(
  rows: readonly OdoRow[],
  nowMs: number = Date.now(),
): number | null {
  let last = 0;
  for (const r of rows) {
    const ms = parseDotOrIsoDateToMs(r.date);
    if (ms && ms > last) last = ms;
  }
  if (!last || nowMs < last) return null;
  return Math.round((nowMs - last) / (24 * 60 * 60 * 1000) / 30.437);
}
