/**
 * Vienots „Zaudējumu summa” attēlojums — EUR summas formatēšana; citādi saglabā brīvu tekstu.
 */
import { amountToIntRough } from "@/lib/claim-rows-parse";
import type { LtabIncidentRow } from "@/lib/admin-source-blocks";
import {
  ADMIN_INCIDENT_DATA_UNAVAILABLE,
  isIncidentDataUnavailableText,
} from "@/lib/admin-incident-field-presets";

const LOSS_RANGE_RE = /([\d\s.\u00a0\u202f]+)\s*[-–—−]\s*([\d\s.\u00a0\u202f]+)/;

function parseEurIntToken(raw: string): number | null {
  const digits = raw.replace(/[\s.\u00a0\u202f]/g, "");
  if (!/^\d+$/.test(digits)) return null;
  const n = Number.parseInt(digits, 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * Diapazona robežas (€ veselos); punkta summai lo === hi.
 * Atbalsta arī „1 001 - 1 500 €; Zādzība” — ne salīmē diapazona ciparus par vienu skaitli.
 */
export function parseLossAmountEurBounds(raw: string): { lo: number; hi: number } | null {
  const trimmed = raw.trim();
  if (!trimmed || isIncidentDataUnavailableText(trimmed)) return null;
  // Ņem pirmo segmentu pirms „;” (apvienotās rindas ar teksta piezīmi).
  const head = trimmed.split(";")[0]?.trim() ?? trimmed;
  const t = head.replace(/EUR|€/gi, "").trim();
  if (!t || !/\d/.test(t)) return null;

  const range = t.match(LOSS_RANGE_RE);
  if (range) {
    const lo = parseEurIntToken(range[1]!);
    const hi = parseEurIntToken(range[2]!);
    if (lo == null || hi == null || lo < 0 || hi < 0) return null;
    return { lo: Math.min(lo, hi), hi: Math.max(lo, hi) };
  }

  const commaCents = t.match(/^([\d\s.\u00a0\u202f]+),(\d{1,2})$/);
  if (commaCents) {
    const whole = parseEurIntToken(commaCents[1]!);
    return whole == null ? null : { lo: whole, hi: whole };
  }
  const dotCents = t.match(/^([\d\s\u00a0\u202f]+)\.(\d{1,2})$/);
  if (dotCents) {
    const whole = parseEurIntToken(dotCents[1]!);
    return whole == null ? null : { lo: whole, hi: whole };
  }

  // Vairākas ciparu grupas bez diapazona — nedrīkst salīmēt (1001+1500 → 10011500).
  const digitGroups = t.match(/\d+/g) ?? [];
  if (digitGroups.length > 1) return null;

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

/** Vesela EUR summa PDF/admin kopsavilkumiem: „2 189 €”. */
export function formatLossEurWholeDisplay(n: number): string {
  const rounded = Math.round(n);
  if (rounded === 0) return "0 €";
  const sign = rounded < 0 ? "-" : "";
  return `${sign}${formatEurGrouped(Math.abs(rounded))} €`;
}

/** Formatē summu kā „1 234 €”, diapazonu „300 - 400 €” vai atgriež nemainītu brīvo tekstu. */
export function normalizeLossAmountEurDisplay(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (isIncidentDataUnavailableText(trimmed)) return ADMIN_INCIDENT_DATA_UNAVAILABLE;

  const segments = trimmed
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length > 1) {
    const parts = segments.map((seg) => normalizeLossAmountEurDisplay(seg)).filter(Boolean);
    return parts.join("; ");
  }

  const bounds = parseLossAmountEurBounds(trimmed);
  if (bounds) {
    if (bounds.lo === bounds.hi) {
      if (bounds.lo <= 0) return "0 €";
      const centsMatch = trimmed.replace(/EUR|€/gi, "").trim().match(/[.,](\d{1,2})\s*$/);
      if (centsMatch) {
        const cents = centsMatch[1]!.padEnd(2, "0").slice(0, 2);
        return `${formatEurGrouped(bounds.lo)}.${cents} €`;
      }
      return `${formatEurGrouped(bounds.lo)} €`;
    }
    return `${formatEurGrouped(bounds.lo)} - ${formatEurGrouped(bounds.hi)} €`;
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
