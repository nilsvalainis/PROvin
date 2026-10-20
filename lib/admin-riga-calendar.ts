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

const RIGA_CLOCK = new Intl.DateTimeFormat("en-GB", {
  timeZone: ADMIN_RIGA_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Europe/Riga sienas stunda (0-23). Cron palaišanai pret UTC+2 / UTC+3. */
export function rigaClockHour(ms: number): number {
  const parts = RIGA_CLOCK.formatToParts(new Date(ms));
  let hour = Number.parseInt(parts.find((p) => p.type === "hour")?.value ?? "", 10);
  if (hour === 24) hour = 0;
  return Number.isFinite(hour) ? hour : 0;
}

/** Piem. `13. oktobris` (bez defises). */
export function formatLvCalendarDay(ms: number): string {
  const key = rigaCalendarDayKey(ms);
  const day = Number(key.slice(8, 10));
  const month = Number(key.slice(5, 7));
  const name = LV_MONTH_NAMES[month - 1];
  return name ? `${day}. ${name}` : key;
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

/** Cilnēm: `Oktobris`. */
export function formatLvMonthTitle(month: number): string {
  const name = LV_MONTH_NAMES[month - 1] ?? "";
  if (!name) return "";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function rigaMonthDayNumber(ms: number): number {
  return Number(rigaCalendarDayKey(ms).slice(8, 10));
}

export function rigaDaysInMonth(year: number, month: number): number {
  const next = shiftYearMonth(year, month, 1);
  const nextNoonUtc = Date.UTC(next.year, next.month - 1, 1, 12, 0, 0);
  return rigaMonthDayNumber(nextNoonUtc - 24 * 60 * 60 * 1000);
}
