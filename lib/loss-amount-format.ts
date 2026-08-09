/**
 * Vienots „Zaudējumu summa” attēlojums — EUR summas formatēšana; citādi saglabā brīvu tekstu.
 */
import { amountToIntRough } from "@/lib/claim-rows-parse";
import type { LtabIncidentRow } from "@/lib/admin-source-blocks";
import {
  ADMIN_INCIDENT_DATA_UNAVAILABLE,
  isIncidentDataUnavailableText,
} from "@/lib/admin-incident-field-presets";

/** Diapazona robežas (€ veselos); punkta summai lo === hi. */
export function parseLossAmountEurBounds(raw: string): { lo: number; hi: number } | null {
  const trimmed = raw.trim();
  if (!trimmed || isIncidentDataUnavailableText(trimmed)) return null;
  const t = trimmed.replace(/EUR|€/gi, "").trim();
  if (!t || !/\d/.test(t)) return null;
  const rangeOnly = t.match(/^([\d\s.]+)\s*[-–—]\s*([\d\s.]+)$/);
  if (rangeOnly) {
    const lo = Number.parseInt(rangeOnly[1]!.replace(/[\s.]/g, ""), 10);
    const hi = Number.parseInt(rangeOnly[2]!.replace(/[\s.]/g, ""), 10);
    if (Number.isNaN(lo) || Number.isNaN(hi) || lo < 0 || hi < 0) return null;
    return { lo: Math.min(lo, hi), hi: Math.max(lo, hi) };
  }
  const commaCents = t.match(/^([\d\s.]+),(\d{1,2})$/);
  if (commaCents) {
    const whole = Number.parseInt(commaCents[1]!.replace(/[\s.]/g, ""), 10);
    return Number.isNaN(whole) ? null : { lo: whole, hi: whole };
  }
  const dotCents = t.match(/^([\d\s]+)\.(\d{1,2})$/);
  if (dotCents) {
    const whole = Number.parseInt(dotCents[1]!.replace(/\s/g, ""), 10);
    return Number.isNaN(whole) ? null : { lo: whole, hi: whole };
  }
  const n = amountToIntRough(t);
  if (!(n > 0 || /0/.test(t))) return null;
  return { lo: n, hi: n };
}

function parseLossEurWholeAmount(raw: string): number | null {
  const bounds = parseLossAmountEurBounds(raw);
  if (!bounds) return null;
  return bounds.hi;
}

/** Salīdzināšanai starp avotiem — diapazonam vidējais. */
export function parseLossAmountEurComparable(raw: string): number | null {
  const bounds = parseLossAmountEurBounds(raw);
  if (!bounds) return null;
  return Math.round((bounds.lo + bounds.hi) / 2);
}

function formatEurGrouped(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Formatē summu kā „1 234 €”, diapazonu „300 - 400 €” vai atgriež nemainītu brīvo tekstu. */
export function normalizeLossAmountEurDisplay(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (isIncidentDataUnavailableText(trimmed)) return ADMIN_INCIDENT_DATA_UNAVAILABLE;
  const t = trimmed.replace(/EUR|€/gi, "").trim();
  const range = t.match(/^([\d\s.]+)\s*[-–—]\s*([\d\s.]+)$/);
  if (range) {
    const lo = Number.parseInt(range[1]!.replace(/[\s.]/g, ""), 10);
    const hi = Number.parseInt(range[2]!.replace(/[\s.]/g, ""), 10);
    if (!Number.isNaN(lo) && !Number.isNaN(hi) && lo > 0 && hi > 0) {
      return `${formatEurGrouped(lo)} - ${formatEurGrouped(hi)} €`;
    }
  }
  const n = parseLossEurWholeAmount(trimmed);
  if (n != null) {
    if (n <= 0) return "0 €";
    return `${formatEurGrouped(n)} €`;
  }
  return trimmed;
}

export function normalizeLtabIncidentRow(row: LtabIncidentRow): LtabIncidentRow {
  return {
    ...row,
    lossAmount: normalizeLossAmountEurDisplay(row.lossAmount),
  };
}

export function normalizeLtabIncidentRows(rows: LtabIncidentRow[]): LtabIncidentRow[] {
  return rows.map(normalizeLtabIncidentRow);
}
