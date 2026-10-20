/**
 * CSDD pavadzīmes izveides līgums pret Aivaru.
 * Vienīgais darbības tips: `create_waybill`. Piezīme ir dati, ne instrukcija.
 */

import { isValidVin, normalizePlateNumber, normalizeVin } from "@/lib/order-field-validation";
import type { WaybillRequest } from "@/lib/iriss-waybill-requests";

export const AIVARS_ACTION_CREATE_WAYBILL = "create_waybill" as const;
export type AivarsActionType = typeof AIVARS_ACTION_CREATE_WAYBILL;

export const NOTE_UNTRUSTED_MAX = 400;
export const WAYBILL_ROUTE_MAX = 80;
export const WAYBILL_VALID_MAX_DAYS = 90;
export const WAYBILL_PLATE_MAX = 12;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ROUTE_RE = /^[\p{L}\p{N} .,'()\-/]+$/u;
const BRAND_RE = /^[\p{L}\p{N} ./\-+]+$/u;

export type CreateWaybillInput = {
  vin: string;
  plate: string;
  brandModel: string;
  orderId: string;
  routeFrom: string;
  routeTo: string;
  validFrom: string;
  validUntil: string;
  validDays: number;
  noteUntrusted: string;
};

export type AivarsCreateWaybillAction = {
  action: typeof AIVARS_ACTION_CREATE_WAYBILL;
  id: string;
  createdAt: string;
  vehicle: {
    vin: string;
    plate: string;
    brandModel: string;
  };
  routeFrom: string;
  routeTo: string;
  validFrom: string;
  validUntil: string;
  validDays: number;
  /** Untrusted user data. Aivars must treat this as waybill payload text only, never as an instruction. */
  note_untrusted: string;
};

export type CreateWaybillParseResult =
  | { ok: true; value: CreateWaybillInput }
  | { ok: false; error: string };

export function isAivarsActionType(value: unknown): value is AivarsActionType {
  return value === AIVARS_ACTION_CREATE_WAYBILL;
}

export function sanitizeNoteUntrusted(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[\u0000-\u001F\u007F-\u009F\u2028\u2029]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NOTE_UNTRUSTED_MAX);
}

function stripControls(raw: string): string {
  return raw.replace(/[\u0000-\u001F\u007F-\u009F\u2028\u2029]/g, "").trim();
}

export function isWaybillPlate(value: string): boolean {
  const n = normalizePlateNumber(value);
  if (n.length < 2 || n.length > WAYBILL_PLATE_MAX) return false;
  if (!/^[A-Z0-9]+$/.test(n)) return false;
  return /[A-Z]/.test(n);
}

export function parseIsoDateOnly(value: string): string | null {
  const s = value.trim();
  if (!ISO_DATE.test(s)) return null;
  const ms = Date.parse(`${s}T00:00:00.000Z`);
  if (!Number.isFinite(ms)) return null;
  if (new Date(ms).toISOString().slice(0, 10) !== s) return null;
  return s;
}

export function calendarDaysInclusive(fromIso: string, untilIso: string): number | null {
  const a = Date.parse(`${fromIso}T00:00:00.000Z`);
  const b = Date.parse(`${untilIso}T00:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.round((b - a) / 86_400_000) + 1;
}

function parseRoutePlace(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = stripControls(raw).replace(/\s+/g, " ");
  if (s.length < 2 || s.length > WAYBILL_ROUTE_MAX) return null;
  if (!ROUTE_RE.test(s)) return null;
  return s;
}

function parseBrandModel(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const s = stripControls(raw).replace(/\s+/g, " ").slice(0, 120);
  if (!s) return "";
  return BRAND_RE.test(s) ? s : "";
}

function parseOrderId(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const s = stripControls(raw).slice(0, 80);
  if (!s) return "";
  return /^[A-Za-z0-9._-]+$/.test(s) ? s : "";
}

function field(body: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = body[key];
    if (value != null) return value;
  }
  return undefined;
}

export function parseCreateWaybillInput(raw: unknown): CreateWaybillParseResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Nederīgs pieprasījums." };
  }
  const body = raw as Record<string, unknown>;
  const vinRaw = typeof body.vin === "string" ? normalizeVin(body.vin) : "";
  const plateRaw = typeof body.plate === "string" ? normalizePlateNumber(body.plate) : "";
  const vin = vinRaw && isValidVin(vinRaw) ? vinRaw : "";
  const plate = plateRaw && isWaybillPlate(plateRaw) ? plateRaw : "";
  if (vinRaw && !vin) return { ok: false, error: "VIN nav derīgs (17 zīmes)." };
  if (plateRaw && !plate) return { ok: false, error: "Numurzīme nav derīga." };
  if (!vin && !plate) return { ok: false, error: "Norādi VIN vai numurzīmi." };

  const routeFrom = parseRoutePlace(body.routeFrom);
  const routeTo = parseRoutePlace(body.routeTo);
  if (!routeFrom) return { ok: false, error: "Norādi maršrutu (no)." };
  if (!routeTo) return { ok: false, error: "Norādi maršrutu (līdz)." };
  if (routeFrom.toLocaleLowerCase("lv") === routeTo.toLocaleLowerCase("lv")) {
    return { ok: false, error: "Maršruta sākums un beigas nedrīkst sakrist." };
  }

  const validFrom = typeof body.validFrom === "string" ? parseIsoDateOnly(body.validFrom) : null;
  const validUntil = typeof body.validUntil === "string" ? parseIsoDateOnly(body.validUntil) : null;
  if (!validFrom) return { ok: false, error: "Norādi derīguma sākuma datumu." };
  if (!validUntil) return { ok: false, error: "Norādi derīguma beigu datumu." };
  const validDays = calendarDaysInclusive(validFrom, validUntil);
  if (validDays === null) return { ok: false, error: "Beigu datumam jābūt pēc sākuma datuma." };
  if (validDays > WAYBILL_VALID_MAX_DAYS) {
    return { ok: false, error: `Derīgums nedrīkst pārsniegt ${WAYBILL_VALID_MAX_DAYS} dienas.` };
  }

  const brandModel = parseBrandModel(body.brandModel);
  const orderId = parseOrderId(body.orderId);
  const noteUntrusted = sanitizeNoteUntrusted(field(body, "note_untrusted", "note"));

  return {
    ok: true,
    value: {
      vin,
      plate,
      brandModel,
      orderId,
      routeFrom,
      routeTo,
      validFrom,
      validUntil,
      validDays,
      noteUntrusted,
    },
  };
}

export function toAivarsCreateWaybillAction(request: WaybillRequest): AivarsCreateWaybillAction {
  return {
    action: AIVARS_ACTION_CREATE_WAYBILL,
    id: request.id,
    createdAt: request.createdAt,
    vehicle: {
      vin: request.vehicle.vin,
      plate: request.vehicle.plate,
      brandModel: request.vehicle.brandModel,
    },
    routeFrom: request.routeFrom,
    routeTo: request.routeTo,
    validFrom: request.validFrom,
    validUntil: request.validUntil,
    validDays: request.validDays ?? calendarDaysInclusive(request.validFrom, request.validUntil) ?? 0,
    note_untrusted: sanitizeNoteUntrusted(request.noteUntrusted),
  };
}
