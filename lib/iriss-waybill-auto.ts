/**
 * Automātiska CSDD pavadzīmes izrakstīšana (Hetzner `iriss-waybill-worker`), divas plūsmas kā telefona formā (PR #504):
 * - "tradeAct": tirdzniecībā pieņemts auto (VIN zināms) -> akts -> "Noformēt pavadzīmi"; tikai laiks + pārstāvis;
 * - "new": jauna pavadzīme ar noklusējuma maršrutu (Tukums, Rīgas iela -> Tukuma CSDD).
 * Laiks: jebkuras veselas stundas 1..2160 (piem. 1 h). Drošība: numurs no saraksta un brīvs, nav cita darba ar šo numuru,
 * termiņš nav beidzies, pirmais mēģinājums, komentārs tukšs vai pēc šablona. Viss pārējais -> Aivars.
 * Serveris nekad nepārtrauc un neanulē aktīvu pavadzīmi: aizņemts numurs vienmēr ir nestandarta.
 * Tā pati pārbaude ir worker pusē (scripts/iriss-ttr/waybill-worker-core.mjs localStandardCheck).
 */

import {
  DEFAULT_WAYBILL_ROUTE_FROM,
  DEFAULT_WAYBILL_ROUTE_TO,
  WAYBILL_REPRESENTATIVES,
  WAYBILL_VALID_MAX_HOURS,
  sanitizeNoteUntrusted,
} from "@/lib/iriss-waybill-create";
import { compactDealerPlate, displayDealerPlate, type IrissDealerPlate } from "@/lib/iriss-waybill-plates";
import { inProgressIsStale, waybillPendingExpired, type WaybillRequest } from "@/lib/iriss-waybill-requests";

export const AUTO_WAYBILL_WORKER = "auto";
export const IRISS_WAYBILL_AUTO_ENV = "IRISS_WAYBILL_AUTO";
/**
 * Cik ilgi standarta darbu Aivars neredz (worker poll ir ~10 s); pēc tam tas ir Aivaram kā rezerve.
 * j16: 2 min - tas pats brīdis, kad UI saka "automātika darbu nesāka, nodots Aivaram" (WAYBILL_AUTO_CLAIM_TIMEOUT_MS).
 */
export const AUTO_WAYBILL_GRACE_MS = 2 * 60 * 1000;

export type AutoWaybillCompany = "iriss" | "dzintarzeme";

/** CSDD konteksts: ĪRISS (ctx1) vai Dzintarzeme Auto (ctx2). */
export const AUTO_WAYBILL_PLATES: Record<IrissDealerPlate, { company: AutoWaybillCompany; ctx: "ctx1" | "ctx2" }> = {
  "B193-7": { company: "iriss", ctx: "ctx1" },
  "B762-7": { company: "iriss", ctx: "ctx1" },
  "B192-7": { company: "dzintarzeme", ctx: "ctx2" },
};

export type AutoWaybillFlow = "tradeAct" | "new";

export type AutoWaybillTarget = {
  plate: IrissDealerPlate;
  company: AutoWaybillCompany;
  ctx: "ctx1" | "ctx2";
  flow: AutoWaybillFlow;
  /** "Anulēt iepriekšējo un izveidot jaunu" (lietotājs apstiprināja tieši šo pavadzīmi). */
  replace?: { waybillNo: string };
};

/** Vercel slēdzis: aizņemta numura darbu ("anulēt un izveidot") dod automātikai. Noklusējumā izslēgts -> Aivars. */
export const IRISS_WAYBILL_AUTO_REPLACE_ENV = "IRISS_WAYBILL_AUTO_REPLACE";

export function autoWaybillReplaceEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env[IRISS_WAYBILL_AUTO_REPLACE_ENV]?.trim() === "1";
}

export type AutoWaybillClassification =
  | ({ standard: true } & AutoWaybillTarget)
  | { standard: false; reason: string };

function norm(s: string): string {
  return s.toLocaleLowerCase("lv").replace(/\s+/g, " ").trim();
}

/** Pārstāvja vārds bez diakritikas ("Taivo Batiņš" = "Taivo Batins" - CSDD sarakstā bez garumzīmēm). */
function normName(s: string): string {
  return norm(s.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
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

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

/** Pārstāvis atbilst numura firmai (ĪRISS - Nils Valainis, Dzintarzeme - Taivo Batins). "Cits" -> Aivars. */
export function isAllowedAutoRepresentative(plate: IrissDealerPlate, representative: string): boolean {
  const want = normName(representative);
  return Boolean(want) && WAYBILL_REPRESENTATIVES[plate].some((name) => normName(name) === want);
}

type ClassifyRequest = Pick<
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
> &
  Partial<Pick<WaybillRequest, "id" | "tradeAct" | "representative" | "validUntil" | "replaceWaybillNo">>;

/**
 * Cits pieprasījums ar to pašu numuru jau ir darbā vai tikko izdots (vēl derīgs) - dublikāts / numurs faktiski aizņemts,
 * pat ja pavadzīmju saraksts (Dropbox kešs) to vēl nerāda.
 */
export function plateTakenByOtherRequest(
  requests: ReadonlyArray<Pick<WaybillRequest, "id" | "status" | "vehicle" | "validUntil" | "pickedAt">>,
  req: Pick<WaybillRequest, "id" | "vehicle">,
  nowMs = Date.now(),
): boolean {
  const plate = compactDealerPlate(req.vehicle.plate);
  return requests.some((other) => {
    if (other.id === req.id || compactDealerPlate(other.vehicle.plate) !== plate) return false;
    if (other.status === "in_progress") return !inProgressIsStale(other as WaybillRequest, nowMs);
    if (other.status === "issued") {
      const until = Date.parse(other.validUntil);
      return Number.isFinite(until) && until > nowMs;
    }
    return false;
  });
}

export function classifyWaybillForAuto(
  req: ClassifyRequest,
  opts: { plateBusyNow: boolean; plateInOtherRequest?: boolean; nowMs?: number; replaceEnabled?: boolean },
): AutoWaybillClassification {
  const nowMs = opts.nowMs ?? Date.now();
  if (req.status !== "queued") return { standard: false, reason: "nav rindā" };
  if (req.autoDisabled) return { standard: false, reason: "nodots Aivaram" };
  // Aizņemts numurs nozīmē beigt aktīvu pavadzīmi. Automātikai tikai, ja lietotājs apstiprināja tieši šo pavadzīmi
  // ("Vai tiešām anulēt iepriekšējo un izveidot jaunu?" -> Jā) un ieslēgts IRISS_WAYBILL_AUTO_REPLACE; citādi Aivars.
  const replaceNo = req.plateBusyAtCreate && /^P\d{5,6}$/.test(req.replaceWaybillNo ?? "") ? (req.replaceWaybillNo as string) : "";
  const replace = Boolean(replaceNo && opts.replaceEnabled);
  if (!replace && (req.plateBusyAtCreate || opts.plateBusyNow)) return { standard: false, reason: "numurs aizņemts" };
  if (opts.plateInOtherRequest) return { standard: false, reason: "numurs jau citā darbā" };
  const plate = displayDealerPlate(req.vehicle.plate);
  if (!plate) return { standard: false, reason: "numurs nav sarakstā" };
  if (!req.vehicle.brandModel.trim()) return { standard: false, reason: "nav auto" };
  const hours = req.validHours;
  if (hours == null || !Number.isInteger(hours) || hours < 1 || hours > WAYBILL_VALID_MAX_HOURS) {
    return { standard: false, reason: "nederīgs laiks" };
  }
  if (req.validUntil && waybillPendingExpired({ status: req.status, validUntil: req.validUntil }, nowMs)) {
    return { standard: false, reason: "termiņš beidzies" };
  }
  if (req.attempts > 1) return { standard: false, reason: "atkārtots pieprasījums" };
  if (!isStandardWaybillComment(req.noteUntrusted, plate, req.vehicle.brandModel)) {
    return { standard: false, reason: "komentārs" };
  }
  if (req.tradeAct) {
    // Pieņemts auto: CSDD akts pēc VIN -> "Noformēt pavadzīmi". Maršrutu CSDD ņem no akta.
    if (!VIN_RE.test(req.vehicle.vin.trim().toUpperCase())) return { standard: false, reason: "aktam vajag VIN" };
    if (!isAllowedAutoRepresentative(plate, req.representative ?? "")) return { standard: false, reason: "cits pārstāvis" };
    return { standard: true, plate, ...AUTO_WAYBILL_PLATES[plate], flow: "tradeAct", ...(replace ? { replace: { waybillNo: replaceNo } } : {}) };
  }
  // Jauna pavadzīme: automātika prot tikai noklusējuma maršrutu (CSDD adrešu koks Tukums, Rīgas iela 75 -> CSDD Tukums).
  if (req.routeFrom !== DEFAULT_WAYBILL_ROUTE_FROM || req.routeTo !== DEFAULT_WAYBILL_ROUTE_TO) {
    return { standard: false, reason: "cits maršruts" };
  }
  return { standard: true, plate, ...AUTO_WAYBILL_PLATES[plate], flow: "new", ...(replace ? { replace: { waybillNo: replaceNo } } : {}) };
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
