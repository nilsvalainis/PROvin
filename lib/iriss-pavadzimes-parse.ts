import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import type { IrissPavadzimeRecord, IrissPavadzimeValidityTone } from "@/lib/iriss-pavadzimes-types";

const LV_MONTH: Record<string, number> = {
  janvāris: 1,
  janvaris: 1,
  februāris: 2,
  februaris: 2,
  marts: 3,
  aprīlis: 4,
  aprilis: 4,
  maijs: 5,
  jūnijs: 6,
  junijs: 6,
  jūlijs: 7,
  julijs: 7,
  augusts: 8,
  septembris: 9,
  oktobris: 10,
  novembris: 11,
  decembris: 12,
};

const DEALER_PLATE_RE = /\b([A-Z]\d{3}-\d)\b/;
const WAYBILL_NO_RE = /Pavadzīme\s+Nr\.?\s*(P\d{4,8})/i;
const FILE_NO_RE = /^(P\d{4,8})(?:[._-]|$)/i;
const BRAND_MODEL_RE = /Marka,\s*modelis\s+([^\n\r]+)/i;
const VALID_UNTIL_RE =
  /Pavadzīmes\s+derīguma\s+termiņš:\s*(\d{1,2})\.(\d{1,2})\.(\d{4})\.?\s*plkst\.\s*(\d{1,2}):(\d{2})/i;
const ISSUED_RE =
  /(\d{4})\.\s*gada\s+(\d{1,2})\.\s*([A-Za-zĀČĒĢĪĶĻŅŠŪŽāčēģīķļņšūž]+)\s*,?\s*plkst\.\s*(\d{1,2}):(\d{2})/;
const VIN_LABEL_RE = /(?:\bVIN\b|Identifikācijas\s+numurs)\s*[:.]?\s*([A-HJ-NPR-Z0-9]{11,17})/i;
const VIN_STANDALONE_RE = /\b([A-HJ-NPR-Z0-9]{17})\b/;

export type IrissPavadzimeParsedFields = {
  number: string;
  brandModel: string;
  vin: string;
  plate: string;
  issuedAt: string;
  validUntil: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function monthFromLv(raw: string): number | null {
  const key = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  const withDiacritics = raw.trim().toLowerCase();
  return LV_MONTH[withDiacritics] ?? LV_MONTH[key] ?? null;
}

/** Europe/Riga civilais laiks → UTC Date. */
export function rigaLocalToUtc(year: number, month: number, day: number, hour: number, minute: number): Date | null {
  if (!Number.isFinite(year) || month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Riga",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const asUtcMs = (date: Date): number => {
    const p = Object.fromEntries(
      dtf
        .formatToParts(date)
        .filter((x) => x.type !== "literal")
        .map((x) => [x.type, x.value]),
    ) as Record<string, string>;
    const h = p.hour === "24" ? 0 : Number(p.hour);
    return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), h, Number(p.minute), Number(p.second));
  };
  return new Date(utcGuess + (utcGuess - asUtcMs(new Date(utcGuess))));
}

function isoFromRiga(year: number, month: number, day: number, hour: number, minute: number): string {
  const d = rigaLocalToUtc(year, month, day, hour, minute);
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : "";
}

function rigaYmd(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Riga",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function waybillValidityTone(validUntilIso: string, now = new Date()): IrissPavadzimeValidityTone {
  const raw = validUntilIso.trim();
  if (!raw) return "unknown";
  const until = new Date(raw);
  if (Number.isNaN(until.getTime())) return "unknown";
  if (until.getTime() < now.getTime()) return "expired";
  if (rigaYmd(until) === rigaYmd(now)) return "today";
  return "ok";
}

const RIGA_PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Riga",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Operatoram: `14.10 15:59` (cits gads: `14.10.2025 15:59`). */
export function formatWaybillDateTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (!iso.trim() || Number.isNaN(d.getTime())) return "";
  const p = Object.fromEntries(
    RIGA_PARTS.formatToParts(d)
      .filter((x) => x.type !== "literal")
      .map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  const nowY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Riga", year: "numeric" }).format(now);
  const time = `${p.hour}:${p.minute}`;
  if (p.year === nowY) return `${p.day}.${p.month} ${time}`;
  return `${p.day}.${p.month}.${p.year} ${time}`;
}

export function isCsddWaybillText(text: string): boolean {
  const t = text.replace(/\s+/g, " ");
  return /Pavadzīme\s+Nr/i.test(t) && /tirdzniecības/i.test(t);
}

export function parseWaybillVin(text: string): string {
  const labeled = text.match(VIN_LABEL_RE)?.[1] ?? "";
  const candidate = labeled || text.match(VIN_STANDALONE_RE)?.[1] || "";
  const vin = normalizeVin(candidate);
  return isValidVin(vin) ? vin : "";
}

export function parseWaybillPlateFromText(text: string): string {
  const afterSigns = text.split(/tirdzniecības numura zīmes/i)[1] ?? "";
  const fromSigns = afterSigns.match(DEALER_PLATE_RE)?.[1] ?? "";
  if (fromSigns) return fromSigns.toUpperCase();
  const any = text.match(DEALER_PLATE_RE)?.[1] ?? "";
  return any.toUpperCase();
}

export function parseCsddWaybillText(text: string): IrissPavadzimeParsedFields {
  const compact = text.replace(/\r/g, "");
  const number = (compact.match(WAYBILL_NO_RE)?.[1] ?? "").toUpperCase();
  const brandModel = (compact.match(BRAND_MODEL_RE)?.[1] ?? "").replace(/\s+/g, " ").trim();
  const plate = parseWaybillPlateFromText(compact);
  const vin = parseWaybillVin(compact);

  let issuedAt = "";
  const issued = compact.match(ISSUED_RE);
  if (issued) {
    const year = Number(issued[1]);
    const day = Number(issued[2]);
    const month = monthFromLv(issued[3] ?? "");
    const hour = Number(issued[4]);
    const minute = Number(issued[5]);
    if (month) issuedAt = isoFromRiga(year, month, day, hour, minute);
  }

  let validUntil = "";
  const until = compact.match(VALID_UNTIL_RE);
  if (until) {
    const day = Number(until[1]);
    const month = Number(until[2]);
    const year = Number(until[3]);
    const hour = Number(until[4]);
    const minute = Number(until[5]);
    validUntil = isoFromRiga(year, month, day, hour, minute);
  }

  return { number, brandModel, vin, plate, issuedAt, validUntil };
}

export function parseCsddWaybillFileName(fileName: string): Partial<IrissPavadzimeParsedFields> {
  const base = fileName.replace(/\.pdf$/i, "").trim();
  const noMatch = base.match(FILE_NO_RE);
  const number = (noMatch?.[1] ?? "").toUpperCase();
  const rest = number ? base.slice(number.length).replace(/^[_-]+/, "") : base;
  let plate = "";
  let brandPart = rest;
  const plateAtEnd = rest.match(/^(.*?)[_-]([A-Za-z]\d{3}-\d)$/);
  if (plateAtEnd) {
    brandPart = plateAtEnd[1] ?? "";
    plate = (plateAtEnd[2] ?? "").toUpperCase();
  } else {
    const p = rest.match(DEALER_PLATE_RE)?.[1];
    if (p) plate = p.toUpperCase();
  }
  const brandModel = brandPart.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  const vinFromName = parseWaybillVin(base.replace(/[_-]/g, " "));
  return {
    ...(number ? { number } : {}),
    ...(brandModel && number ? { brandModel } : {}),
    ...(plate ? { plate } : {}),
    ...(vinFromName ? { vin: vinFromName } : {}),
  };
}

export function mergeWaybillParsedFields(
  fromText: IrissPavadzimeParsedFields,
  fromName: Partial<IrissPavadzimeParsedFields>,
): IrissPavadzimeParsedFields {
  const pick = (a: string, b: string | undefined) => (a.trim() ? a : (b ?? "").trim());
  return {
    number: pick(fromText.number, fromName.number).toUpperCase(),
    brandModel: pick(fromText.brandModel, fromName.brandModel),
    vin: pick(fromText.vin, fromName.vin),
    plate: pick(fromText.plate, fromName.plate).toUpperCase(),
    issuedAt: pick(fromText.issuedAt, fromName.issuedAt),
    validUntil: pick(fromText.validUntil, fromName.validUntil),
  };
}

export function parseCsddWaybill(text: string, fileName: string): IrissPavadzimeParsedFields {
  return mergeWaybillParsedFields(parseCsddWaybillText(text), parseCsddWaybillFileName(fileName));
}

const SAFE_ID_RE = /^[A-Za-z0-9._-]{3,80}$/;

export function isSafeIrissPavadzimeId(id: string): boolean {
  return SAFE_ID_RE.test(id);
}

export function waybillIdFromNumber(number: string, fallback: string): string {
  const n = number.trim().toUpperCase();
  if (/^P\d{4,8}$/.test(n)) return n.toLowerCase();
  const fb = fallback.trim();
  if (isSafeIrissPavadzimeId(fb)) return fb;
  return `u-${crypto.randomUUID().slice(0, 12)}`;
}

export function applyParsedFields(
  rec: IrissPavadzimeRecord,
  parsed: IrissPavadzimeParsedFields,
  nowIso: string,
): IrissPavadzimeRecord {
  return {
    ...rec,
    number: parsed.number || rec.number,
    brandModel: parsed.brandModel || rec.brandModel,
    vin: parsed.vin || rec.vin,
    plate: parsed.plate || rec.plate,
    issuedAt: parsed.issuedAt || rec.issuedAt,
    validUntil: parsed.validUntil || rec.validUntil,
    parsedAt: nowIso,
    updatedAt: nowIso,
  };
}

export function sortIrissPavadzimes<T extends { validUntil: string; number: string; issuedAt: string }>(rows: T[]): T[] {
  const rank = (iso: string) => {
    const t = new Date(iso).getTime();
    return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
  };
  return [...rows].sort((a, b) => {
    const ta = rank(a.validUntil);
    const tb = rank(b.validUntil);
    if (ta !== tb) return ta - tb;
    const ia = rank(a.issuedAt);
    const ib = rank(b.issuedAt);
    if (ia !== ib) return ib - ia;
    return b.number.localeCompare(a.number, "lv");
  });
}
