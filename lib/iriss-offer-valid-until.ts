/**
 * IRISS piedāvājuma derīgums: datums (validUntil, YYYY-MM-DD), Europe/Riga dienas beigas.
 * Vecais lauks offerValidDays paliek JSON; ja validUntil nav, derīgumu var atvasināt.
 */

export const IRISS_OFFER_VALID_TZ = "Europe/Riga";

export type IrissOfferValidityInput = {
  validUntil?: string | null;
  offerValidDays?: string | null;
  createdAt?: string | null;
};

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function normalizeOfferValidUntil(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const s = raw.trim();
  if (!s) return "";
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]!.padStart(2, "0")}-${dmy[1]!.padStart(2, "0")}`;
  return "";
}

export function rigaYmd(ms: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IRISS_OFFER_VALID_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const y = get("year");
  const m = get("month");
  const d = get("day");
  return y && m && d ? `${y}-${m}-${d}` : "";
}

/** Dienas beigas Europe/Riga (nākamā pusnakts Rīgā) kā UTC ms. */
export function offerValidUntilEndMs(ymd: string): number | null {
  const m = DATE_RE.exec(ymd.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const next = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0));
  const targetNext = addDaysYmd(ymd, 1);
  let guess = next.getTime();
  for (let i = 0; i < 6; i += 1) {
    const got = rigaYmd(guess);
    if (got === targetNext) return guess;
    const gotMs = Date.parse(`${got}T00:00:00.000Z`);
    const wantMs = Date.parse(`${targetNext}T00:00:00.000Z`);
    if (!Number.isFinite(gotMs) || !Number.isFinite(wantMs)) break;
    guess += wantMs - gotMs;
  }
  return guess;
}

function addDaysYmd(ymd: string, days: number): string {
  const m = DATE_RE.exec(ymd);
  if (!m) return "";
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

export function deriveOfferValidUntil(input: IrissOfferValidityInput): string {
  const direct = normalizeOfferValidUntil(input.validUntil);
  if (direct) return direct;
  const days = Number.parseInt(String(input.offerValidDays ?? "").trim(), 10);
  if (!Number.isFinite(days) || days <= 0) return "";
  const created = Date.parse(String(input.createdAt ?? ""));
  const base = Number.isFinite(created) ? created : Date.now();
  const start = rigaYmd(base);
  return start ? addDaysYmd(start, days) : "";
}

export function isIrissOfferExpired(input: IrissOfferValidityInput, nowMs = Date.now()): boolean {
  const ymd = deriveOfferValidUntil(input);
  if (!ymd) return false;
  const today = rigaYmd(nowMs);
  if (!today) return false;
  return today > ymd;
}

export function formatOfferValidUntilLv(ymd: string): string {
  const n = normalizeOfferValidUntil(ymd);
  const m = DATE_RE.exec(n);
  if (!m) return "";
  return `${m[3]}.${m[2]}.${m[1]}`;
}

export function defaultOfferValidUntilYmd(nowMs = Date.now(), days = 3): string {
  const start = rigaYmd(nowMs);
  return start ? addDaysYmd(start, days) : "";
}

/**
 * Precīzs termiņš (validUntilAt): ievade Rīgas laikā (datums + laiks), glabā UTC ISO.
 * Neeksistējošs laiks (pavasara pāreja) - kļūda. Divdomīgs (rudens pāreja) - agrākais brīdis.
 */

export type RigaLocalToUtcResult =
  | { ok: true; iso: string; ms: number }
  | { ok: false; error: "invalid" | "nonexistent" };

const HM_RE = /^(\d{2}):(\d{2})$/;

const RIGA_PARTS_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: IRISS_OFFER_VALID_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Rīgas sienas pulkstenis kā { ymd: "YYYY-MM-DD", hm: "HH:MM" }. */
export function rigaLocalParts(ms: number): { ymd: string; hm: string } | null {
  if (!Number.isFinite(ms)) return null;
  const parts = RIGA_PARTS_FMT.formatToParts(new Date(ms));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const y = get("year");
  const mo = get("month");
  const d = get("day");
  const h = get("hour");
  const mi = get("minute");
  if (!y || !mo || !d || !h || !mi) return null;
  return { ymd: `${y}-${mo}-${d}`, hm: `${h}:${mi}` };
}

function rigaOffsetMs(ms: number): number {
  const p = rigaLocalParts(ms);
  if (!p) return 0;
  const [y, mo, d] = p.ymd.split("-").map(Number);
  const [h, mi] = p.hm.split(":").map(Number);
  const wall = Date.UTC(y!, mo! - 1, d!, h!, mi!);
  const floored = Math.floor(ms / 60_000) * 60_000;
  return wall - floored;
}

export function rigaLocalToUtcIso(ymd: string, hm: string): RigaLocalToUtcResult {
  const dm = DATE_RE.exec(ymd.trim());
  const tm = HM_RE.exec(hm.trim());
  if (!dm || !tm) return { ok: false, error: "invalid" };
  const year = Number(dm[1]);
  const month = Number(dm[2]);
  const day = Number(dm[3]);
  const hour = Number(tm[1]);
  const minute = Number(tm[2]);
  if (hour > 23 || minute > 59 || month < 1 || month > 12 || day < 1) return { ok: false, error: "invalid" };
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(naive);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return { ok: false, error: "invalid" };
  }
  const offsets = new Set([rigaOffsetMs(naive - 86_400_000), rigaOffsetMs(naive), rigaOffsetMs(naive + 86_400_000)]);
  const want = `${dm[1]}-${dm[2]}-${dm[3]} ${tm[1]}:${tm[2]}`;
  const matches: number[] = [];
  for (const off of offsets) {
    const candidate = naive - off;
    const p = rigaLocalParts(candidate);
    if (p && `${p.ymd} ${p.hm}` === want) matches.push(candidate);
  }
  if (matches.length === 0) return { ok: false, error: "nonexistent" };
  const ms = Math.min(...matches);
  return { ok: true, ms, iso: new Date(ms).toISOString() };
}

export function normalizeOfferValidUntilAt(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const s = raw.trim();
  if (!s || !/^\d{4}-\d{2}-\d{2}T/.test(s)) return "";
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : "";
}

/** Termiņa brīdis ms vai null (vecie piedāvājumi bez validUntilAt). */
export function offerDeadlineMs(offer: { validUntilAt?: string | null } | null | undefined): number | null {
  const iso = normalizeOfferValidUntilAt(offer?.validUntilAt);
  if (!iso) return null;
  return Date.parse(iso);
}

/** Lēmumu pieņem tikai, ja now < termiņš. */
export function isOfferDeadlinePassed(deadlineMs: number | null, nowMs = Date.now()): boolean {
  if (deadlineMs == null) return false;
  return nowMs >= deadlineMs;
}

/** "26.10.2026 18:00" Rīgas laikā. */
export function formatOfferDeadlineLv(iso: string): string {
  const n = normalizeOfferValidUntilAt(iso);
  if (!n) return "";
  const p = rigaLocalParts(Date.parse(n));
  if (!p) return "";
  return `${formatOfferValidUntilLv(p.ymd)} ${p.hm}`;
}

/** validUntil (YYYY-MM-DD Rīgā) no precīzā termiņa - PDF un saraksts strādā kā līdz šim. */
export function offerValidUntilYmdFromAt(iso: string): string {
  const n = normalizeOfferValidUntilAt(iso);
  if (!n) return "";
  return rigaLocalParts(Date.parse(n))?.ymd ?? "";
}

export const IRISS_OFFER_DEADLINE_MIN_LEAD_MS = 5 * 60 * 1000;
export const IRISS_OFFER_DEADLINE_MAX_DAYS = 180;

export type OfferDeadlineInputResult =
  | { ok: true; iso: string; ms: number }
  | { ok: false; error: "invalid" | "nonexistent" | "past" | "too_far"; message: string };

export const IRISS_OFFER_DEADLINE_ERRORS_LV = {
  invalid: "Ievadiet datumu un laiku.",
  nonexistent: "Šāds laiks neeksistē (pulksteņa pāreja).",
  past: "Termiņam jābūt vismaz 5 minūtes nākotnē.",
  too_far: "Termiņš nevar būt tālāk par 180 dienām.",
} as const;

/** Admin ievades pārbaude: nākotnē (>= 5 min), ne tālāk par 180 dienām. */
export function parseOfferDeadlineInput(ymd: string, hm: string, nowMs = Date.now()): OfferDeadlineInputResult {
  const r = rigaLocalToUtcIso(ymd, hm);
  if (!r.ok) return { ok: false, error: r.error, message: IRISS_OFFER_DEADLINE_ERRORS_LV[r.error] };
  if (r.ms < nowMs + IRISS_OFFER_DEADLINE_MIN_LEAD_MS) {
    return { ok: false, error: "past", message: IRISS_OFFER_DEADLINE_ERRORS_LV.past };
  }
  if (r.ms > nowMs + IRISS_OFFER_DEADLINE_MAX_DAYS * 86_400_000) {
    return { ok: false, error: "too_far", message: IRISS_OFFER_DEADLINE_ERRORS_LV.too_far };
  }
  return r;
}
