/**
 * ASV vēstures datumi ar laiku: avota UTC / US josla → Europe/Riga attēlojumam.
 */

export const US_HISTORY_DISPLAY_TZ = "Europe/Riga";

const US_TZ_OFFSET_MIN: Record<string, number> = {
  utc: 0,
  gmt: 0,
  z: 0,
  est: -300,
  edt: -240,
  cst: -360,
  cdt: -300,
  mst: -420,
  mdt: -360,
  pst: -480,
  pdt: -420,
};

const RIGA_PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: US_HISTORY_DISPLAY_TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatRigaDateTime(ms: number): string {
  const parts = RIGA_PARTS.formatToParts(new Date(ms));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const dd = get("day");
  const mm = get("month");
  const yyyy = get("year");
  const hh = get("hour");
  const min = get("minute");
  if (!dd || !mm || !yyyy || !hh || !min) return "";
  return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
}

function parseOffsetMinutes(raw: string): number | null {
  const t = raw.trim();
  if (!t || t === "Z" || t === "z") return 0;
  const named = US_TZ_OFFSET_MIN[t.toLowerCase()];
  if (named != null) return named;
  const m = t.match(/^([+-])(\d{2}):?(\d{2})$/);
  if (!m) return null;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

/**
 * Ja tekstā ir pulksteņa laiks, pārrēķina uz Europe/Riga (`DD.MM.YYYY HH:mm`).
 * Datums bez laika → `null` (izsaucējs lieto parasto datuma formātu).
 */
export function formatUsHistoryDateTimeInRiga(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;

  const iso = t.match(
    /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2}|[A-Z]{2,4})?$/i,
  );
  if (iso) {
    const y = Number(iso[1]);
    const mo = Number(iso[2]);
    const d = Number(iso[3]);
    const h = Number(iso[4]);
    const mi = Number(iso[5]);
    const s = Number(iso[6] ?? "0");
    const tz = iso[7] ?? "Z";
    const offset = parseOffsetMinutes(tz);
    if (offset == null) return null;
    const utcMs = Date.UTC(y, mo - 1, d, h, mi, s) - offset * 60_000;
    const out = formatRigaDateTime(utcMs);
    return out || null;
  }

  const us = t.match(
    /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?\s*([A-Z]{2,4})$/i,
  );
  if (us) {
    const offset = parseOffsetMinutes(us[7]!);
    if (offset == null) return null;
    const utcMs =
      Date.UTC(
        Number(us[1]),
        Number(us[2]) - 1,
        Number(us[3]),
        Number(us[4]),
        Number(us[5]),
        Number(us[6] ?? "0"),
      ) - offset * 60_000;
    const out = formatRigaDateTime(utcMs);
    return out || null;
  }

  return null;
}

/** ASV vēstures lauks: ar laiku → Rīga; citādi atstāj izsaucēja datuma formātu. */
export function maybeFormatUsHistoryDateTimeInRiga(raw: string, dateOnlyFallback: string): string {
  return formatUsHistoryDateTimeInRiga(raw) || dateOnlyFallback;
}
