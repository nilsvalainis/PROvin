/**
 * Vienots „Zaudējumu summa” attēlojums — tikai cipari + „ €” (admin + PDF + importi).
 */
import { amountToIntRough } from "@/lib/claim-rows-parse";
import type { LtabIncidentRow } from "@/lib/admin-source-blocks";

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

/** Formatē summu kā „1 234 €” vai diapazonu „300 - 400 €”. */
export function normalizeLossAmountEurDisplay(raw: string): string {
  const t = raw.trim().replace(/EUR|€/gi, "").trim();
  const range = t.match(/^([\d\s.]+)\s*[-–—]\s*([\d\s.]+)$/);
  if (range) {
    const lo = Number.parseInt(range[1]!.replace(/[\s.]/g, ""), 10);
    const hi = Number.parseInt(range[2]!.replace(/[\s.]/g, ""), 10);
    if (!Number.isNaN(lo) && !Number.isNaN(hi) && lo > 0 && hi > 0) {
      return `${formatEurGrouped(lo)} - ${formatEurGrouped(hi)} €`;
    }
  }
  const n = parseLossEurWholeAmount(raw);
  if (n == null) return "";
  if (n <= 0) return "0 €";
  return `${formatEurGrouped(n)} €`;
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
