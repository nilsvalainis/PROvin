/**
 * IRISS LIST automātiskā nolasīšana: ik ~2 h dienā Europe/Riga (08-20).
 * Vercel Cron ir tikai UTC, tāpēc vercel.json palaiž 05-19 UTC ik ~6 min (ziema un vasara);
 * handleris 08/10/12/14/16/18/20 :00 Rīgā sāk ciklu, pārējās palaišanas turpina kursoru
 * ~60 min logā, ja cikls nav pabeigts.
 *
 * Viens cron ieraksts: Pro 100 job/projektā. Precizitāte: Pro per-minute.
 */

export const IRISS_LISTINGS_TZ = "Europe/Riga";
export const IRISS_LISTINGS_AUTOMATIC_HOURS = [8, 10, 12, 14, 16, 18, 20] as const;
/** Ziema UTC+2 un vasara UTC+3: 08-20 Riga ik 2 h + 60 min turpinājums. */
export const IRISS_LISTINGS_CRON_UTC_SCHEDULE = "*/6 5-19 * * *";
export const IRISS_LISTINGS_CRON_UTC_HOURS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19] as const;
/** Turpinājuma logs pēc slota sākuma: tikai tad, ja kursors nav pabeigts. */
export const IRISS_LISTINGS_CONTINUATION_WINDOW_MS = 60 * 60 * 1000;

export type IrissListingsAutomaticHour = (typeof IRISS_LISTINGS_AUTOMATIC_HOURS)[number];

export type IrissListingsRigaParts = {
  year: string;
  month: string;
  day: string;
  hour: number;
  minute: number;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function rigaDateTimeParts(at: Date): IrissListingsRigaParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IRISS_LISTINGS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const g = (type: Intl.DateTimeFormatPartTypes): string => parts.find((p) => p.type === type)?.value ?? "";
  let hour = Number.parseInt(g("hour"), 10);
  if (hour === 24) hour = 0;
  return {
    year: g("year"),
    month: g("month"),
    day: g("day"),
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.parseInt(g("minute"), 10) || 0,
  };
}

export function isIrissListingsAutomaticHour(hour: number): hour is IrissListingsAutomaticHour {
  return (IRISS_LISTINGS_AUTOMATIC_HOURS as readonly number[]).includes(hour);
}

const AUTOMATIC_SLOT_HOUR_RE = /^(?:08|10|12|14|16|18|20)$/;

/** YYYY-MM-DDTHH Riga time, or null if this UTC fire is not a daytime slot. */
export function irissListingsAutomaticSlot(at: Date): string | null {
  const p = rigaDateTimeParts(at);
  if (!isIrissListingsAutomaticHour(p.hour)) return null;
  return `${p.year}-${p.month}-${p.day}T${pad2(p.hour)}`;
}

export function isIrissListingsAutomaticSlot(raw: string | null | undefined): raw is string {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}$/.test(raw)) return false;
  return AUTOMATIC_SLOT_HOUR_RE.test(raw.slice(11, 13));
}

/** Slot `YYYY-MM-DDTHH` (Rīga sienas laiks) → UTC instants. */
export function irissListingsSlotStartUtc(slot: string): Date | null {
  if (!isIrissListingsAutomaticSlot(slot)) return null;
  const year = Number(slot.slice(0, 4));
  const month = Number(slot.slice(5, 7));
  const day = Number(slot.slice(8, 10));
  const hour = Number(slot.slice(11, 13));
  for (const offsetH of [2, 3]) {
    const utc = new Date(Date.UTC(year, month - 1, day, hour - offsetH, 0, 0));
    const p = rigaDateTimeParts(utc);
    if (p.year === slot.slice(0, 4) && p.month === slot.slice(5, 7) && p.day === slot.slice(8, 10) && p.hour === hour && p.minute === 0) {
      return utc;
    }
  }
  return null;
}

/** Cron turpinājums: 1-60 min pēc slota Rīgā (ieskaitot nākamās stundas :00). */
export function irissListingsClockInContinuationWindow(at: Date): boolean {
  const p = rigaDateTimeParts(at);
  if (isIrissListingsAutomaticHour(p.hour) && p.minute > 0) return true;
  const prevHour = (p.hour + 23) % 24;
  if (isIrissListingsAutomaticHour(prevHour) && p.minute === 0) return true;
  return false;
}

export function isIrissListingsContinuationWindow(at: Date, lastAutomaticSlot?: string | null): boolean {
  if (!isIrissListingsAutomaticSlot(lastAutomaticSlot)) return false;
  const start = irissListingsSlotStartUtc(lastAutomaticSlot);
  if (!start) return false;
  const elapsed = at.getTime() - start.getTime();
  return elapsed > 0 && elapsed <= IRISS_LISTINGS_CONTINUATION_WINDOW_MS;
}

/** LIST header time. If this hour already ran, shows the next slot. */
export function nextIrissListingsAutomaticReadLabel(at: Date = new Date(), lastAutomaticSlot?: string | null): string {
  const p = rigaDateTimeParts(at);
  for (const h of IRISS_LISTINGS_AUTOMATIC_HOURS) {
    const slot = `${p.year}-${p.month}-${p.day}T${pad2(h)}`;
    if (p.hour < h) return `${pad2(h)}:00`;
    if (p.hour === h && lastAutomaticSlot !== slot) return `${pad2(h)}:00`;
  }
  return "08:00";
}
