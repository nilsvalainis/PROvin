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
  const shown = rigaYmd(next.getTime());
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
