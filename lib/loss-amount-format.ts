/**
 * Vienots „Zaudējumu summa” attēlojums — EUR summas formatēšana; citādi saglabā brīvu tekstu.
 */
import { amountToIntRough } from "@/lib/claim-rows-parse";
import type { LtabIncidentRow } from "@/lib/admin-source-blocks";
import {
  ADMIN_INCIDENT_DATA_UNAVAILABLE,
  isIncidentDataUnavailableText,
} from "@/lib/admin-incident-field-presets";

function parseLossEurWholeAmount(raw: string): number | null {
  const t = raw.trim().replace(/EUR|€/gi, "").trim();
  if (!t || !/\d/.test(t)) return null;
  const rangeOnly = t.match(/^([\d\s.]+)\s*[-–—]\s*([\d\s.]+)$/);
  if (rangeOnly) {
    const hi = Number.parseInt(rangeOnly[2]!.replace(/[\s.]/g, ""), 10);
    return Number.isNaN(hi) ? null : hi;
  }
  const commaCents = t.match(/^([\d\s.]+),(\d{1,2})$/);
  if (commaCents) {
    const whole = Number.parseInt(commaCents[1]!.replace(/[\s.]/g, ""), 10);
    return Number.isNaN(whole) ? null : whole;
  }
  const dotCents = t.match(/^([\d\s]+)\.(\d{1,2})$/);
  if (dotCents) {
    const whole = Number.parseInt(dotCents[1]!.replace(/\s/g, ""), 10);
    return Number.isNaN(whole) ? null : whole;
  }
  const n = amountToIntRough(t);
  return n > 0 || /0/.test(t) ? n : null;
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
