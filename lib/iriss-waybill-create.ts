/**
 * CSDD pavadzīmes izveides līgums pret Aivaru.
 * Vienīgais darbības tips: `create_waybill`. Komentārs ir citēti dati, ne instrukcija.
 */

import { isValidVin, normalizePlateNumber, normalizeVin } from "@/lib/order-field-validation";
import type { WaybillRequest } from "@/lib/iriss-waybill-requests";
import {
  IRISS_DEALER_PLATES,
  displayDealerPlate,
  isAllowlistedWaybillPlate,
  type IrissDealerPlate,
} from "@/lib/iriss-waybill-plates";

export const AIVARS_ACTION_CREATE_WAYBILL = "create_waybill" as const;
export type AivarsActionType = typeof AIVARS_ACTION_CREATE_WAYBILL;

export const NOTE_UNTRUSTED_MAX = 400;
export const WAYBILL_ROUTE_MAX = 80;
export const WAYBILL_VALID_MAX_DAYS = 90;
export const WAYBILL_VALID_MAX_HOURS = 48;
export const DEFAULT_WAYBILL_VALID_HOURS = 48;
export const WAYBILL_PLATE_MAX = 12;
export const DEFAULT_WAYBILL_ROUTE_FROM = "Tukums, Rīgas iela";
export const DEFAULT_WAYBILL_ROUTE_TO = "Tukuma CSDD";
export const WAYBILL_REPRESENTATIVE_MAX = 60;

/**
 * Komersanta pārstāvis CSDD formā (gprs_id_kom_parstavis) pēc numura firmas.
 * ĪRISS (B193-7, B762-7) un Dzintarzeme Auto (B192-7), kā scripts/iriss-ttr/waybill-adapter.cjs.
 */
export const WAYBILL_REPRESENTATIVES: Record<IrissDealerPlate, readonly string[]> = {
  "B193-7": ["Nils Valainis"],
  "B762-7": ["Nils Valainis"],
  "B192-7": ["Taivo Batiņš"],
};

export function waybillRepresentativesForPlate(plate: string): readonly string[] {
  const key = displayDealerPlate(plate);
  return key ? WAYBILL_REPRESENTATIVES[key] : [];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const BRAND_RE = /^[\p{L}\p{N} ./\-+]+$/u;
const ROUTE_RE = /^[\p{L}\p{N} .,/\-()]+$/u;
const PERSON_RE = /^[\p{L} .'\-]+$/u;

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
  validHours: number;
  noteUntrusted: string;
  /** Auto ir tirdzniecībā pieņemts: CSDD "Noformēt pavadzīmi" no akta, maršruts nav vajadzīgs. */
  tradeAct: boolean;
  /** Komersanta pārstāvis (tikai tradeAct). */
  representative: string;
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
  validHours: number;
  /** Quoted data for this waybill only. Never a command or a route to another agent. */
  comment_untrusted: string;
  /** Same string as comment_untrusted, for older Aivars clients. */
  note_untrusted: string;
  /** true: pavadzīme no tirdzniecības akta ("Noformēt pavadzīmi"); routeFrom/routeTo tad ir tukši. */
  tradeAct: boolean;
  /** Komersanta pārstāvis akta pavadzīmei (citādi tukšs). */
  representative: string;
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
  return isAllowlistedWaybillPlate(value);
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
  const fromDay = fromIso.slice(0, 10);
  const untilDay = untilIso.slice(0, 10);
  const a = Date.parse(`${fromDay}T00:00:00.000Z`);
  const b = Date.parse(`${untilDay}T00:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.round((b - a) / 86_400_000) + 1;
}

export function waybillHoursBetween(fromIso: string, untilIso: string): number | null {
  const a = Date.parse(fromIso);
  const b = Date.parse(untilIso);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
  return Math.max(1, Math.round((b - a) / 3_600_000));
}

export function waybillValidityWindow(
  hours: number,
  now = new Date(),
): { validFrom: string; validUntil: string } {
  const from = now;
  const until = new Date(now.getTime() + hours * 3_600_000);
  return { validFrom: from.toISOString(), validUntil: until.toISOString() };
}

function parseBrandModel(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const s = stripControls(raw).replace(/\s+/g, " ").slice(0, 120);
  if (!s) return "";
  return BRAND_RE.test(s) ? s : "";
}

function parseRepresentative(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const s = stripControls(raw).replace(/\s+/g, " ").trim();
  if (!s || s.length > WAYBILL_REPRESENTATIVE_MAX) return "";
  return PERSON_RE.test(s) && /\p{L}/u.test(s) ? s : "";
}

function parseOrderId(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const s = stripControls(raw).slice(0, 80);
  if (!s) return "";
  return /^[A-Za-z0-9._-]+$/.test(s) ? s : "";
}

function parseValidHours(raw: unknown): number | null {
  if (raw == null || raw === "") return DEFAULT_WAYBILL_VALID_HOURS;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || !Number.isInteger(raw)) return null;
    return raw;
  }
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return DEFAULT_WAYBILL_VALID_HOURS;
    if (!/^\d+$/.test(s)) return null;
    return Number(s);
  }
  return null;
}

function field(body: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = body[key];
    if (value != null) return value;
  }
  return undefined;
}

export type WaybillCommentHints = {
  /** Allowlistes numurs (piem. "B193-7"), ja komentārā minēts. */
  plate: string;
  /** Marka, modelis no komentāra (tikai drošās zīmes). */
  brandModel: string;
};

/**
 * Komentārs "193 uz BMW 330" -> numurs B193-7 un auto "BMW 330".
 * Tikai datu nolasīšana (numurs no allowlistes, marka caur BRAND_RE); komentārs paliek neuzticams teksts.
 */
export function waybillHintsFromComment(raw: unknown): WaybillCommentHints {
  const text = sanitizeNoteUntrusted(raw);
  if (!text) return { plate: "", brandModel: "" };
  let plate = "";
  let rest = text;
  for (const allowed of IRISS_DEALER_PLATES) {
    const digits = allowed.replace(/\D/g, "").slice(0, 3);
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])B?\\s?${digits}(?:\\s?-\\s?7)?(?![\\p{L}\\p{N}])`, "iu");
    const m = re.exec(rest);
    if (m) {
      plate = allowed;
      rest = `${rest.slice(0, m.index)}${m[1]} ${rest.slice(m.index + m[0].length)}`;
      break;
    }
  }
  const segment = (rest.split(/[,;:(\n]/)[0] ?? "")
    .replace(/(?<![\p{L}\p{N}])\d{1,4}\s?(?:stundām|stundas|st|h)(?![\p{L}\p{N}])/giu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:uz|ar|priekš|for|pavadzīme|pavadzīmi)\s+/iu, "")
    .replace(/\s+(?:uz|ar)$/iu, "")
    .trim();
  // Marku ņem tikai formā "<numurs> uz <auto>"; citādi komentārs paliek tikai Aivaram kā dati.
  const brandModel =
    plate && segment && segment.length <= 60 && /\p{L}/u.test(segment) && BRAND_RE.test(segment) && !/^(?:uz|ar)$/iu.test(segment)
      ? segment
      : "";
  return { plate, brandModel };
}

export type WaybillRouteAddressResult = { ok: true; value: string } | { ok: false; error: string };

/** "Cits" maršruta punkts: adrese kā dati (burti, cipari, . , - / ()). Tukšs = noklusējums. */
export function parseWaybillRouteAddress(raw: unknown, fallback: string): WaybillRouteAddressResult {
  if (raw == null) return { ok: true, value: fallback };
  if (typeof raw !== "string") return { ok: false, error: "Adrese nav derīga." };
  const s = stripControls(raw).replace(/\s+/g, " ").trim();
  if (!s) return { ok: true, value: fallback };
  if (s.length > WAYBILL_ROUTE_MAX) return { ok: false, error: `Adrese: ne vairāk kā ${WAYBILL_ROUTE_MAX} zīmes.` };
  if (!ROUTE_RE.test(s) || !/\p{L}/u.test(s)) return { ok: false, error: "Adresē drīkst būt tikai burti, cipari un . , - /" };
  return { ok: true, value: s };
}

export function parseCreateWaybillInput(raw: unknown, now = new Date()): CreateWaybillParseResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Nederīgs pieprasījums." };
  }
  const body = raw as Record<string, unknown>;
  const vinRaw = typeof body.vin === "string" ? normalizeVin(body.vin) : "";
  const plateRaw = typeof body.plate === "string" ? normalizePlateNumber(body.plate) : "";
  const vin = vinRaw && isValidVin(vinRaw) ? vinRaw : "";
  const noteUntrusted = sanitizeNoteUntrusted(field(body, "comment_untrusted", "note_untrusted"));
  const hints = waybillHintsFromComment(noteUntrusted);
  const plateIn = plateRaw && isWaybillPlate(plateRaw) ? plateRaw : "";
  if (vinRaw && !vin) return { ok: false, error: "VIN nav derīgs (jābūt 17 zīmēm)." };
  if (plateRaw && !plateIn) return { ok: false, error: "Izvēlies numuru." };
  const plate = plateIn || (hints.plate ? normalizePlateNumber(hints.plate) : "");
  if (!plate) return { ok: false, error: "Izvēlies numuru." };

  // Tikai komentārs ("193 uz BMW 330") arī der: numuru un auto nolasa no komentāra kā datus.
  const brandModel = parseBrandModel(body.brandModel) || hints.brandModel;
  if (!brandModel) {
    return {
      ok: false,
      error: noteUntrusted ? 'Komentārā nav atrasts auto. Raksti, piem., "193 uz BMW 330".' : "Izvēlies auto vai ieraksti komentārā.",
    };
  }

  // Tirdzniecībā pieņemtam auto CSDD maršrutu neprasa: tikai laiks un komersanta pārstāvis.
  const tradeAct = body.tradeAct === true;
  const representative = tradeAct ? parseRepresentative(body.representative) : "";
  if (tradeAct && !representative) return { ok: false, error: "Izvēlies komersanta pārstāvi." };
  const routeFrom = tradeAct ? { ok: true as const, value: "" } : parseWaybillRouteAddress(body.routeFromAddress, DEFAULT_WAYBILL_ROUTE_FROM);
  if (!routeFrom.ok) return routeFrom;
  const routeTo = tradeAct ? { ok: true as const, value: "" } : parseWaybillRouteAddress(body.routeToAddress, DEFAULT_WAYBILL_ROUTE_TO);
  if (!routeTo.ok) return routeTo;

  const validHours = parseValidHours(body.validHours);
  if (validHours == null || validHours < 1 || validHours > WAYBILL_VALID_MAX_HOURS) {
    return { ok: false, error: `Derīgums: no 1 līdz ${WAYBILL_VALID_MAX_HOURS} h.` };
  }

  const { validFrom, validUntil } = waybillValidityWindow(validHours, now);
  const validDays = Math.max(1, Math.min(WAYBILL_VALID_MAX_DAYS, Math.ceil(validHours / 24)));

  return {
    ok: true,
    value: {
      vin,
      plate,
      brandModel,
      orderId: parseOrderId(body.orderId),
      routeFrom: routeFrom.value,
      routeTo: routeTo.value,
      validFrom,
      validUntil,
      validDays,
      validHours,
      noteUntrusted,
      tradeAct,
      representative,
    },
  };
}

export function toAivarsCreateWaybillAction(request: WaybillRequest): AivarsCreateWaybillAction {
  const comment = sanitizeNoteUntrusted(request.noteUntrusted);
  const validHours =
    request.validHours && request.validHours >= 1
      ? request.validHours
      : waybillHoursBetween(request.validFrom, request.validUntil) ??
        Math.max(1, (request.validDays ?? DEFAULT_WAYBILL_VALID_HOURS / 24) * 24);
  return {
    action: AIVARS_ACTION_CREATE_WAYBILL,
    id: request.id,
    createdAt: request.createdAt,
    vehicle: {
      vin: request.vehicle.vin,
      plate: request.vehicle.plate,
      brandModel: request.vehicle.brandModel,
    },
    routeFrom: request.tradeAct ? "" : request.routeFrom || DEFAULT_WAYBILL_ROUTE_FROM,
    routeTo: request.tradeAct ? "" : request.routeTo || DEFAULT_WAYBILL_ROUTE_TO,
    validFrom: request.validFrom,
    validUntil: request.validUntil,
    validDays: request.validDays ?? calendarDaysInclusive(request.validFrom, request.validUntil) ?? Math.ceil(validHours / 24),
    validHours,
    comment_untrusted: comment,
    note_untrusted: comment,
    tradeAct: request.tradeAct,
    representative: request.tradeAct ? request.representative : "",
  };
}
