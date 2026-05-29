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

/** Droši formatē Stripe `created` (Unix sekundes) admin UI. */
export function formatOrderTimestampSec(createdSec: unknown): string {
  if (typeof createdSec !== "number" || !Number.isFinite(createdSec) || createdSec <= 0) {
    return "—";
  }
  const ms = createdSec * 1000;
  if (!Number.isFinite(ms)) return "—";
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "—";
  try {
    return orderDateTimeFormatter().format(date);
  } catch {
    return "—";
  }
}
