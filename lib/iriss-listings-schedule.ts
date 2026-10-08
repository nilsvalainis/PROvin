/**
 * IRISS LIST automātiskā nolasīšana: 09:00, 13:00, 17:00 Europe/Riga.
 * Vercel Cron ir tikai UTC, tāpēc vercel.json palaiž visus ziemas un vasaras offseta
 * stundas (6, 7, 10, 11, 14, 15 UTC); handleris izlaiž stundas, kas Rīgā nav 9/13/17.
 *
 * Viens cron ieraksts (ne seši): Pro 100 job/projektā; Hobby ļauj tikai 1x dienā, bet
 * dealer-data-sweep every 30 min jau prasa Pro. Precizitāte: Pro per-minute.
 */

export const IRISS_LISTINGS_TZ = "Europe/Riga";
export const IRISS_LISTINGS_AUTOMATIC_HOURS = [9, 13, 17] as const;
/** Ziema UTC+2 un vasara UTC+3: 09/13/17 Riga. vercel.json crons schedule. */
export const IRISS_LISTINGS_CRON_UTC_SCHEDULE = "0 6,7,10,11,14,15 * * *";
export const IRISS_LISTINGS_CRON_UTC_HOURS = [6, 7, 10, 11, 14, 15] as const;

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
