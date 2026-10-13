/** Admin operāciju kalendārs: Europe/Riga diena un mēnesis. */

export const ADMIN_RIGA_TZ = "Europe/Riga";

export const LV_MONTH_NAMES = [
  "janvāris",
  "februāris",
  "marts",
  "aprīlis",
  "maijs",
  "jūnijs",
  "jūlijs",
  "augusts",
  "septembris",
  "oktobris",
  "novembris",
  "decembris",
] as const;

const RIGA_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: ADMIN_RIGA_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function rigaCalendarDayKey(ms: number): string {
  return RIGA_DAY.format(new Date(ms));
}

export function rigaYearMonthKey(ms: number): string {
  return rigaCalendarDayKey(ms).slice(0, 7);
}

export function formatYearMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function parseYearMonthKey(raw: string | null | undefined): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec((raw ?? "").trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
  return { year, month };
}

export function currentRigaYearMonth(nowMs = Date.now()): { year: number; month: number } {
  const parsed = parseYearMonthKey(rigaYearMonthKey(nowMs));
  if (!parsed) return { year: 1970, month: 1 };
  return parsed;
}

export function shiftYearMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const idx = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(idx / 12);
  const nextMonth = ((idx % 12) + 12) % 12;
  return { year: nextYear, month: nextMonth + 1 };
}

export function isoInRigaYearMonth(iso: string, year: number, month: number): boolean {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return false;
  return rigaYearMonthKey(ms) === formatYearMonthKey(year, month);
}

export function formatLvYearMonth(year: number, month: number): string {
  const name = LV_MONTH_NAMES[month - 1];
  return name ? `${year}. gada ${name}` : formatYearMonthKey(year, month);
}
