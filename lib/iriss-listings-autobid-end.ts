/**
 * Autobid izsoles beigu laiks: ņemam pašu rādīto datumu+laiku (sienas pulkstenis),
 * uzskatām to par Autobid vietējo laiku (Europe/Berlin) un pārvēršam UTC ISO,
 * lai LIST kartītes rādītu konsekventi Europe/Riga.
 *
 * Autobid ISO bieži ir ar +00:00, kaut UI rāda Vācijas pulksteni. Tāpēc TZ ofsetu
 * ignorējam un rēķinām paši no Y-M-D H:M.
 */

export const AUTOBID_DISPLAY_TIMEZONE = "Europe/Berlin";

export type AutobidWallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

const END_KEY_RE =
  /^(auctionenddate|auctionend|auctionendat|auctionuntil|enddate|endtime|endsat|closeat|closedate|closetime)$/i;

function isRec(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function parseAutobidWallClock(raw: unknown): AutobidWallClock | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    if (raw > 1e11) return wallClockInZone(new Date(raw), AUTOBID_DISPLAY_TIMEZONE);
    if (raw > 1e9) return wallClockInZone(new Date(raw * 1000), AUTOBID_DISPLAY_TIMEZONE);
    return null;
  }
  if (raw instanceof Date && Number.isFinite(raw.getTime())) {
    return extractIsoWallClock(raw.toISOString());
  }
  if (Array.isArray(raw) && raw[0] === "Date") return parseAutobidWallClock(raw[1]);
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (iso) {
    return {
      year: Number(iso[1]),
      month: Number(iso[2]),
      day: Number(iso[3]),
      hour: Number(iso[4]),
      minute: Number(iso[5]),
    };
  }

  const dmy = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})(?:\s*[,|]?\s*(\d{1,2})[:.](\d{2}))?/);
  if (dmy) {
    return {
      year: Number(dmy[3]),
      month: Number(dmy[2]),
      day: Number(dmy[1]),
      hour: dmy[4] != null ? Number(dmy[4]) : 0,
      minute: dmy[5] != null ? Number(dmy[5]) : 0,
    };
  }

  const ymd = s.match(/^(\d{4})[./](\d{1,2})[./](\d{1,2})(?:\s+(\d{1,2})[:.](\d{2}))?/);
  if (ymd) {
    return {
      year: Number(ymd[1]),
      month: Number(ymd[2]),
      day: Number(ymd[3]),
      hour: ymd[4] != null ? Number(ymd[4]) : 0,
      minute: ymd[5] != null ? Number(ymd[5]) : 0,
    };
  }

  return extractIsoWallClock(s);
}

function extractIsoWallClock(iso: string): AutobidWallClock | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
  if (!m) return null;
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: Number(m[4]),
    minute: Number(m[5]),
  };
}

function wallClockInZone(date: Date, timeZone: string): AutobidWallClock | null {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? NaN);
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour");
  const minute = get("minute");
  if (![year, month, day, hour, minute].every((n) => Number.isFinite(n))) return null;
  return { year, month, day, hour, minute };
}

function shownPartsMs(clock: AutobidWallClock): number {
  return Date.UTC(clock.year, clock.month - 1, clock.day, clock.hour, clock.minute, 0);
}

/**
 * Sienas pulkstenis zonā → UTC ISO. Meklējam UTC momentu, kura pulkstenis šajā zonā sakrīt.
 */
export function wallClockInZoneToUtcIso(clock: AutobidWallClock, timeZone = AUTOBID_DISPLAY_TIMEZONE): string {
  const target = shownPartsMs(clock);
  let guess = target;
  for (let i = 0; i < 4; i += 1) {
    const shown = wallClockInZone(new Date(guess), timeZone);
    if (!shown) break;
    const delta = shownPartsMs(shown) - target;
    if (delta === 0) return new Date(guess).toISOString();
    guess -= delta;
  }
  return new Date(guess).toISOString();
}

function pickEndRaw(raw: Record<string, unknown>): unknown {
  const directKeys = [
    "auctionEndDate",
    "auctionEnd",
    "auctionEndAt",
    "auctionUntil",
    "endDate",
    "endTime",
    "endsAt",
    "closeAt",
    "closeDate",
    "closeTime",
  ];
  for (const k of directKeys) {
    if (raw[k] != null && raw[k] !== "") return raw[k];
  }
  for (const [k, v] of Object.entries(raw)) {
    if (END_KEY_RE.test(k.replace(/[\s._-]+/g, "")) && v != null && v !== "") return v;
  }
  const add = isRec(raw.additionalInformation) ? raw.additionalInformation : null;
  if (add) {
    for (const k of directKeys) {
      if (add[k] != null && add[k] !== "") return add[k];
    }
  }
  const auction = isRec(raw.auction) ? raw.auction : null;
  if (auction) {
    for (const k of ["endDate", "end", "auctionEndDate", "until"]) {
      if (auction[k] != null && auction[k] !== "") return auction[k];
    }
  }
  return null;
}

export function autobidAuctionEndAt(raw: Record<string, unknown>): string {
  const clock = parseAutobidWallClock(pickEndRaw(raw));
  if (!clock) return "";
  if (clock.month < 1 || clock.month > 12 || clock.day < 1 || clock.day > 31) return "";
  if (clock.hour > 23 || clock.minute > 59) return "";
  return wallClockInZoneToUtcIso(clock);
}

export function formatAutobidEndClock(clock: AutobidWallClock): string {
  return `${clock.year}-${pad2(clock.month)}-${pad2(clock.day)} ${pad2(clock.hour)}:${pad2(clock.minute)}`;
}
