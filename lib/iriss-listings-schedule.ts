/**
 * IRISS LIST automātiskā nolasīšana: 09:00, 13:00, 17:00 Europe/Riga.
 * Vercel Cron ir tikai UTC, tāpēc vercel.json palaiž visus ziemas un vasaras offseta
 * stundas (6, 7, 10, 11, 14, 15 UTC) ik ~6 min; handleris 09/13/17 :00 sāk ciklu,
 * pārējās palaišanas turpina kursoru ~60 min logā, ja cikls nav pabeigts.
 *
 * Viens cron ieraksts (ne seši): Pro 100 job/projektā; Hobby ļauj tikai 1x dienā, bet
 * dealer-data-sweep every 30 min jau prasa Pro. Precizitāte: Pro per-minute.
 */

export const IRISS_LISTINGS_TZ = "Europe/Riga";
export const IRISS_LISTINGS_AUTOMATIC_HOURS = [9, 13, 17] as const;
/** Ziema UTC+2 un vasara UTC+3: 09/13/17 Riga. vercel.json: slota :00 un turpinājums ik ~6 min. */
export const IRISS_LISTINGS_CRON_UTC_SCHEDULE = "*/6 6,7,10,11,14,15 * * *";
export const IRISS_LISTINGS_CRON_UTC_HOURS = [6, 7, 10, 11, 14, 15] as const;
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

/** YYYY-MM-DDTHH Riga time, or null if this UTC fire is not 09/13/17. */
export function irissListingsAutomaticSlot(at: Date): string | null {
  const p = rigaDateTimeParts(at);
  if (!isIrissListingsAutomaticHour(p.hour)) return null;
  return `${p.year}-${p.month}-${p.day}T${pad2(p.hour)}`;
}

export function isIrissListingsAutomaticSlot(raw: string | null | undefined): raw is string {
  return typeof raw === "string" && /^\d{4}-\d{2}-\d{2}T(?:09|13|17)$/.test(raw);
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

/** Cron turpinājums: 1-60 min pēc 09/13/17 Rīgā (ieskaitot nākamās stundas :00). */
export function irissListingsClockInContinuationWindow(at: Date): boolean {
  const p = rigaDateTimeParts(at);
  if (isIrissListingsAutomaticHour(p.hour) && p.minute > 0) return true;
  if ((p.hour === 10 || p.hour === 14 || p.hour === 18) && p.minute === 0) return true;
  return false;
}

export function isIrissListingsContinuationWindow(at: Date, lastAutomaticSlot?: string | null): boolean {
  if (!isIrissListingsAutomaticSlot(lastAutomaticSlot)) return false;
  const start = irissListingsSlotStartUtc(lastAutomaticSlot);
  if (!start) return false;
  const elapsed = at.getTime() - start.getTime();
  return elapsed > 0 && elapsed <= IRISS_LISTINGS_CONTINUATION_WINDOW_MS;
}

/** LIST header time, e.g. 13:00. If this hour already ran, shows the next slot. */
export function nextIrissListingsAutomaticReadLabel(at: Date = new Date(), lastAutomaticSlot?: string | null): string {
  const p = rigaDateTimeParts(at);
  for (const h of IRISS_LISTINGS_AUTOMATIC_HOURS) {
    const slot = `${p.year}-${p.month}-${p.day}T${pad2(h)}`;
    if (p.hour < h) return `${pad2(h)}:00`;
    if (p.hour === h && lastAutomaticSlot !== slot) return `${pad2(h)}:00`;
  }
  return "09:00";
}
