/**
 * CSDD admin lauku vizuālie brīdinājumi (rāmis + ikona), balstīti uz vērtībām.
 */

export type CsddFieldUiFlag = "none" | "yellow" | "red";

/** Izvelk veselu skaitli no teksta (atgāzu daļiņas — parasti lieli skaitļi ar atstarpēm). */
export function parseParticulateMatterNumber(raw: string): number | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

export function getParticulateMatterUiFlag(raw: string): CsddFieldUiFlag {
  const n = parseParticulateMatterNumber(raw);
  if (n === null) return "none";
  if (n > 1_000_000) return "red";
  if (n > 100_000) return "yellow";
  return "none";
}

function parseLocalDateIso(iso: string): Date | null {
  const t = iso.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const [y, m, d] = t.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Dienu skaits līdz `target` salīdzinot ar `ref` (pozitīvs = nākotnē). */
function daysFromRefToTarget(target: Date, ref: Date): number {
  const a = startOfLocalDay(target).getTime();
  const b = startOfLocalDay(ref).getTime();
  return Math.round((a - b) / (24 * 60 * 60 * 1000));
}

export function getNextInspectionDateUiFlag(isoDate: string, referenceDate: Date = new Date()): CsddFieldUiFlag {
  const target = parseLocalDateIso(isoDate);
  if (!target) return "none";
  const ref = startOfLocalDay(referenceDate);
  const diff = daysFromRefToTarget(target, ref);
  if (diff < 0) return "red";
  if (diff < 30) return "red";
  if (diff < 90) return "yellow";
  return "none";
}
