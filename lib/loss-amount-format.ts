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
  // „>4000.00 €” / „virs 4 000 €” - robežas bez prefiksa (vārdu atdod splitLossAmountQualifier).
  const t = splitLossAmountQualifier(head).rest.replace(/EUR|€/gi, "").trim();
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

/** Aptuvenas summas prefikss: „>4000.00 €” -> „virs”, „>=” -> „no”, „<” / „<=” -> „līdz”, „~” -> „ap”. */
export type LossAmountQualifierWord = "virs" | "no" | "līdz" | "ap";

const LOSS_QUALIFIER_RE = /^(>=|≥|<=|≤|>|<|~|≈|virs(?!\p{L})|no(?!\p{L})|līdz(?!\p{L})|ap(?!\p{L}))\s*/iu;

function lossQualifierWord(token: string): LossAmountQualifierWord {
  const t = token.toLowerCase();
  if (t === ">" || t === "virs") return "virs";
  if (t === ">=" || t === "≥" || t === "no") return "no";
  if (t === "<" || t === "<=" || t === "≤" || t === "līdz") return "līdz";
  return "ap";
}

/**
 * Atdala aptuvenas summas prefiksu (simbolu vai jau latvisko vārdu, lai formatēšana ir idempotenta).
 * Bez prefiksa atgriež word: null un nemainītu (apgrieztu) tekstu.
 */
export function splitLossAmountQualifier(raw: string): { word: LossAmountQualifierWord | null; rest: string } {
  const trimmed = raw.trim();
  const m = trimmed.match(LOSS_QUALIFIER_RE);
  if (!m) return { word: null, rest: trimmed };
  return { word: lossQualifierWord(m[1]!), rest: trimmed.slice(m[0].length).trim() };
}

/**
 * Summa ar prefiksu (piem. „>4000.00 €”, „virs 4 000 €”): vārds + robežas.
 * Bez prefiksa vai neparsējamai summai null.
 */
export function parseQualifiedLossAmount(
  raw: string,
): { word: LossAmountQualifierWord; bounds: { lo: number; hi: number } } | null {
  const { word, rest } = splitLossAmountQualifier(raw);
  if (!word || !rest || !/^\d/.test(rest)) return null;
  const bounds = parseLossAmountEurBounds(rest);
  if (bounds) return { word, bounds };
  // „4 000 €” ar atstarpi kā tūkstošu atdalītāju (jau formatēta vērtība).
  const whole = collapsedEurWhole(rest);
  return whole == null ? null : { word, bounds: { lo: whole, hi: whole } };
}

/** „virs 4 000 €” / „ap 1 000 - 2 000 €” - aptuvenai summai centus nerāda. */
function formatQualifiedLossAmount(word: LossAmountQualifierWord, lo: number, hi: number): string {
  if (lo === hi) return `${word} ${formatEurGrouped(lo)} €`;
  return `${word} ${formatEurGrouped(lo)} - ${formatEurGrouped(hi)} €`;
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

  const qualified = parseQualifiedLossAmount(trimmed);
  if (qualified) return formatQualifiedLossAmount(qualified.word, qualified.bounds.lo, qualified.bounds.hi);

  const bounds = parseLossAmountEurBounds(trimmed);
  if (bounds) {
    if (bounds.lo === bounds.hi) {
      if (bounds.lo <= 0) return "0 €";
      const centsMatch = trimmed.replace(/EUR|€/gi, "").trim().match(/[.,](\d{1,2})\s*$/);
      if (centsMatch) {
        const cents = centsMatch[1]!.padEnd(2, "0").slice(0, 2);
        return `${formatEurGrouped(bounds.lo)},${cents} €`;
      }
      return `${formatEurGrouped(bounds.lo)} €`;
    }
    return `${formatEurGrouped(bounds.lo)} - ${formatEurGrouped(bounds.hi)} €`;
  }
  return trimmed;
}

function roundEurToNearestTen(n: number): number {
  return Math.round(n / 10) * 10;
}

/**
 * Fallback tiem pašiem gadījumiem, kuros parseLossAmountEurBounds apzināti atsakās (vairākas
 * ciparu grupas bez domuzīmes = potenciāls "digit soup"), bet reāli tas ir viens grupēts skaitlis
 * ar atstarpēm kā tūkstošu atdalītāju (piem. "2 847 €"). Tas pats trikts jau lietots
 * unified-incidents.ts → parseIncidentAmountEur.
 */
function collapsedEurWhole(raw: string): number | null {
  const collapsed = raw.replace(/EUR|€/gi, "").replace(/[\s\u00a0\u202f]/g, "").trim();
  if (!/^\d+$/.test(collapsed)) return null;
  const v = Number.parseInt(collapsed, 10);
  return Number.isNaN(v) ? null : v;
}

/**
 * Klientam redzamā PDF „NEGADĪJUMU VĒSTURE” summa: noapaļota uz tuvāko 10 EUR (pēdējais cipars vienmēr „0”).
 * Diapazoniem noapaļo abas robežas; brīvu tekstu (piem. „apstrīdēts”, „nav datu”, sentinel) atstāj nemainītu.
 * Neietekmē admin rediģēšanas laukus — tie turpina rādīt precīzo avota vērtību (normalizeLossAmountEurDisplay).
 */
export function roundLossAmountEurDisplayToTens(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed || isIncidentDataUnavailableText(trimmed)) return trimmed;

  const segments = trimmed
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length > 1) {
    return segments.map(roundLossAmountEurDisplayToTens).join("; ");
  }

  const qualified = parseQualifiedLossAmount(trimmed);
  if (qualified) {
    return formatQualifiedLossAmount(
      qualified.word,
      roundEurToNearestTen(qualified.bounds.lo),
      roundEurToNearestTen(qualified.bounds.hi),
    );
  }

  const bounds = parseLossAmountEurBounds(trimmed);
  if (bounds) {
    const lo = roundEurToNearestTen(bounds.lo);
    const hi = roundEurToNearestTen(bounds.hi);
    if (lo === hi) return lo <= 0 ? "0 €" : `${formatEurGrouped(lo)} €`;
    return `${formatEurGrouped(lo)} - ${formatEurGrouped(hi)} €`;
  }

  const whole = collapsedEurWhole(trimmed);
  if (whole != null) {
    const rounded = roundEurToNearestTen(whole);
    return rounded <= 0 ? "0 €" : `${formatEurGrouped(rounded)} €`;
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
