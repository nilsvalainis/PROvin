/**
 * Automātiska STANDARTA CSDD pavadzīmes izrakstīšana (Hetzner `iriss-waybill-worker`).
 * Standarta = drošs bez cilvēka: numurs no saraksta un brīvs, 48 h, noklusējuma maršruts,
 * komentārs tukšs vai atbilst šablonam. Viss pārējais ir NESTANDARTA -> Aivars (un Nila "jā").
 * Serveris nekad nepārtrauc un neanulē aktīvu pavadzīmi: aizņemts numurs vienmēr ir nestandarta.
 */

import {
  DEFAULT_WAYBILL_ROUTE_FROM,
  DEFAULT_WAYBILL_ROUTE_TO,
  DEFAULT_WAYBILL_VALID_HOURS,
  sanitizeNoteUntrusted,
} from "@/lib/iriss-waybill-create";
import { compactDealerPlate, displayDealerPlate, type IrissDealerPlate } from "@/lib/iriss-waybill-plates";
import type { WaybillRequest } from "@/lib/iriss-waybill-requests";

export const AUTO_WAYBILL_WORKER = "auto";
export const IRISS_WAYBILL_AUTO_ENV = "IRISS_WAYBILL_AUTO";
/** Cik ilgi standarta darbu Aivars neredz (worker poll ir ~10 s); pēc tam tas ir Aivaram kā rezerve. */
export const AUTO_WAYBILL_GRACE_MS = 3 * 60 * 1000;

export type AutoWaybillCompany = "iriss" | "dzintarzeme";

/** CSDD konteksts: ĪRISS (ctx1) vai Dzintarzeme Auto (ctx2). */
export const AUTO_WAYBILL_PLATES: Record<IrissDealerPlate, { company: AutoWaybillCompany; ctx: "ctx1" | "ctx2" }> = {
  "B193-7": { company: "iriss", ctx: "ctx1" },
  "B762-7": { company: "iriss", ctx: "ctx1" },
  "B192-7": { company: "dzintarzeme", ctx: "ctx2" },
};

export type AutoWaybillTarget = {
  plate: IrissDealerPlate;
  company: AutoWaybillCompany;
  ctx: "ctx1" | "ctx2";
};

export type AutoWaybillClassification =
  | ({ standard: true } & AutoWaybillTarget)
  | { standard: false; reason: string };

function norm(s: string): string {
  return s.toLocaleLowerCase("lv").replace(/\s+/g, " ").trim();
}

/** Komentārs der automātikai: tukšs, "Tukums" vai "<numurs> uz <šī pieprasījuma auto>". */
export function isStandardWaybillComment(comment: string, plate: string, brandModel: string): boolean {
  const c = norm(sanitizeNoteUntrusted(comment));
  if (!c || c === "tukums") return true;
  const digits = compactDealerPlate(plate).replace(/\D/g, "").slice(0, 3);
  const m = /^b?\s?(\d{3})(?:\s?-\s?7)?\s+uz\s+(.+)$/u.exec(c);
  if (!m || m[1] !== digits) return false;
  return Boolean(brandModel.trim()) && m[2] === norm(brandModel);
}

export function classifyWaybillForAuto(
  req: Pick<
    WaybillRequest,
    | "status"
    | "vehicle"
    | "routeFrom"
    | "routeTo"
    | "validHours"
    | "noteUntrusted"
    | "attempts"
    | "plateBusyAtCreate"
    | "autoDisabled"
  >,
  opts: { plateBusyNow: boolean },
): AutoWaybillClassification {
  if (req.status !== "queued") return { standard: false, reason: "nav rindā" };
  if (req.autoDisabled) return { standard: false, reason: "nodots Aivaram" };
  // Aizņemts numurs nozīmē beigt aktīvu pavadzīmi - to drīkst tikai Aivars ar Nila "jā".
  if (req.plateBusyAtCreate || opts.plateBusyNow) return { standard: false, reason: "numurs aizņemts" };
  const plate = displayDealerPlate(req.vehicle.plate);
  if (!plate) return { standard: false, reason: "numurs nav sarakstā" };
  if (!req.vehicle.brandModel.trim()) return { standard: false, reason: "nav auto" };
  if (req.validHours !== DEFAULT_WAYBILL_VALID_HOURS) return { standard: false, reason: "nav 48 h" };
  if (req.routeFrom !== DEFAULT_WAYBILL_ROUTE_FROM || req.routeTo !== DEFAULT_WAYBILL_ROUTE_TO) {
    return { standard: false, reason: "cits maršruts" };
  }
  if (req.attempts > 1) return { standard: false, reason: "atkārtots pieprasījums" };
  if (!isStandardWaybillComment(req.noteUntrusted, plate, req.vehicle.brandModel)) {
    return { standard: false, reason: "komentārs" };
  }
  return { standard: true, plate, ...AUTO_WAYBILL_PLATES[plate] };
}

export function autoWaybillEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env[IRISS_WAYBILL_AUTO_ENV]?.trim() === "1";
}

/** Vai Aivaram šo darbu vēl nerādīt (to ņems automātika). */
export function hiddenFromAivars(
  classification: AutoWaybillClassification,
  createdAt: string,
  nowMs: number,
  enabled: boolean,
): boolean {
  if (!enabled || !classification.standard) return false;
  const t = Date.parse(createdAt);
  return Number.isFinite(t) && nowMs - t < AUTO_WAYBILL_GRACE_MS;
}
