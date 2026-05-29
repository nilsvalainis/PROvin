import { cleanDateInput, parseDotOrIsoDateToMs } from "@/lib/clean-date-str";

const ORDER_DATETIME_TIME_ZONE = "Europe/Riga";

let cachedOrderDateTimeFmt: Intl.DateTimeFormat | null = null;

function orderDateTimeFormatter(): Intl.DateTimeFormat {
  if (!cachedOrderDateTimeFmt) {
    cachedOrderDateTimeFmt = new Intl.DateTimeFormat("lv-LV", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: ORDER_DATETIME_TIME_ZONE,
    });
  }
  return cachedOrderDateTimeFmt;
}

function formatDateFromMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "—";
  try {
    return orderDateTimeFormatter().format(date);
  } catch {
    return "—";
  }
}

/** Droši formatē Stripe `created` (Unix sekundes) vai LV datuma virkni admin UI. */
export function formatOrderTimestampSec(createdSec: unknown): string {
  if (typeof createdSec === "string") {
    const ms = parseDotOrIsoDateToMs(cleanDateInput(createdSec));
    return formatDateFromMs(ms);
  }
  if (typeof createdSec !== "number" || !Number.isFinite(createdSec) || createdSec <= 0) {
    return "—";
  }
  const ms = createdSec * 1000;
  return formatDateFromMs(ms);
}
