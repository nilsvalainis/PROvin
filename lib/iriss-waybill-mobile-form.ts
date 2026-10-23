/**
 * Pavadzīmes forma telefonā: tīra loģika (bez React), lai uzvedību var testēt.
 * Serveris visu pārbauda vēlreiz (`parseCreateWaybillInput`); šeit tikai ērtības un skaidras kļūdas.
 */

import {
  DEFAULT_WAYBILL_VALID_HOURS,
  NOTE_UNTRUSTED_MAX,
  WAYBILL_ROUTE_MAX,
  WAYBILL_VALID_MAX_HOURS,
  waybillHintsFromComment,
  waybillHoursBetween,
  waybillRepresentativesForPlate,
} from "@/lib/iriss-waybill-create";
import { displayDealerPlate, formatRigaDateTimeComma, type WaybillPlateState } from "@/lib/iriss-waybill-plates";
import { waybillErrorNeedsCheck } from "@/lib/iriss-waybill-push";
import {
  WAYBILL_STALE_LABEL,
  WAYBILL_WORKER_STAGE_TEXT,
  isStaleWaybillRequest,
  waybillPendingExpired,
  waybillQueuedText,
  waybillRequestCancellable,
  type WaybillAivarsReply,
  type WaybillAutoMode,
  type WaybillRequest,
  type WaybillRequestStatus,
  type WaybillWorkerStage,
} from "@/lib/iriss-waybill-requests";

export const WAYBILL_MOBILE_HOUR_PRESETS = [12, 24, 48] as const;

export type WaybillRoutePlace = "tukums" | "other";

/** Sākuma adrese pēc noklusējuma (Tukums); serverī tā ir DEFAULT_WAYBILL_ROUTE_FROM. */
export const WAYBILL_TUKUMS_STREET = "Rīgas iela 75";

/** accepted: auto ir CSDD tirdzniecībā pieņemto sarakstā (pavadzīme no akta, bez maršruta). */
export type WaybillMobileCar = { brandModel: string; vin: string; id: string; accepted?: boolean };

export type WaybillMobileFormState = {
  plate: string;
  /** Lietotājs pats pieskārās numuram. Ja nē, numuru var ņemt no komentāra ("193 uz ..."). */
  plateTouched: boolean;
  /** Auto no saraksta (vai iepriekšējās pavadzīmes). */
  car: WaybillMobileCar | null;
  /** "Cits auto - ierakstīt ar roku". */
  manual: boolean;
  manualBrandModel: string;
  /** null = "cits". */
  hoursPreset: number | null;
  hoursOther: string;
  comment: string;
  /** Sākuma adrese (tikai auto, kas nav tirdzniecībā pieņemts). Galamērķa lauka nav: CSDD Tukums. */
  from: WaybillRoutePlace;
  fromAddress: string;
  /** Komersanta pārstāvis (tikai pieņemtam auto); tukšs = pirmais šī numura firmas pārstāvis. */
  representative: string;
};

export type WaybillMobilePayload = {
  plate: string;
  brandModel: string;
  vin: string;
  validHours: number;
  comment_untrusted: string;
  routeFromAddress: string;
  tradeAct: boolean;
  representative: string;
};

export function initialWaybillMobileForm(plate: string): WaybillMobileFormState {
  return {
    plate,
    plateTouched: false,
    car: null,
    manual: false,
    manualBrandModel: "",
    hoursPreset: DEFAULT_WAYBILL_VALID_HOURS,
    hoursOther: "",
    comment: "",
    from: "tukums",
    fromAddress: "",
    representative: "",
  };
}

/** Derīgums stundās vai null, ja "cits" lauks nav derīgs. */
export function waybillMobileHours(state: Pick<WaybillMobileFormState, "hoursPreset" | "hoursOther">): number | null {
  if (state.hoursPreset != null) return state.hoursPreset;
  const s = state.hoursOther.trim();
  if (!/^\d{1,4}$/.test(s)) return null;
  const n = Number(s);
  return n >= 1 && n <= WAYBILL_VALID_MAX_HOURS ? n : null;
}

/** Numurs, kas tiks sūtīts: izvēlētais vai (ja nav pieskarts) no komentāra. */
export function waybillMobilePlate(state: Pick<WaybillMobileFormState, "plate" | "plateTouched" | "comment">): string {
  if (!state.plateTouched) {
    const hint = waybillHintsFromComment(state.comment).plate;
    if (hint) return hint;
  }
  return state.plate;
}

export type WaybillMobileBuildResult = { ok: true; payload: WaybillMobilePayload } | { ok: false; error: string };

export function buildWaybillMobilePayload(state: WaybillMobileFormState): WaybillMobileBuildResult {
  const plate = displayDealerPlate(waybillMobilePlate(state));
  if (!plate) return { ok: false, error: "Izvēlies numuru." };
  const comment = state.comment.trim().slice(0, NOTE_UNTRUSTED_MAX);
  const brandModel = state.manual ? state.manualBrandModel.trim() : (state.car?.brandModel ?? "").trim();
  if (!brandModel && !comment) return { ok: false, error: "Izvēlies auto vai ieraksti komentārā." };
  if (!brandModel && !waybillHintsFromComment(comment).brandModel) {
    return { ok: false, error: 'Komentārā nav atrasts auto. Raksti, piem., "193 uz BMW 330".' };
  }
  const validHours = waybillMobileHours(state);
  if (validHours == null) return { ok: false, error: `Ieraksti derīgumu: no 1 līdz ${WAYBILL_VALID_MAX_HOURS} h.` };
  const tradeAct = waybillMobileTradeAct(state);
  if (tradeAct) {
    const representative = waybillMobileRepresentative({ ...state, plate });
    if (!representative) return { ok: false, error: "Izvēlies komersanta pārstāvi." };
    return {
      ok: true,
      payload: {
        plate,
        brandModel,
        vin: state.car?.vin ?? "",
        validHours,
        comment_untrusted: comment,
        routeFromAddress: "",
        tradeAct: true,
        representative,
      },
    };
  }
  const fromAddress = state.from === "other" ? state.fromAddress.trim().slice(0, WAYBILL_ROUTE_MAX) : "";
  if (state.from === "other" && !fromAddress) return { ok: false, error: "Ieraksti sākuma adresi." };
  return {
    ok: true,
    payload: {
      plate,
      brandModel,
      vin: state.manual ? "" : (state.car?.vin ?? ""),
      validHours,
      comment_untrusted: comment,
      routeFromAddress: fromAddress,
      tradeAct: false,
      representative: "",
    },
  };
}

/** Pieņemts tirdzniecībā (no saraksta): tikai laiks + komersanta pārstāvis, maršruta nav. */
export function waybillMobileTradeAct(state: Pick<WaybillMobileFormState, "manual" | "car">): boolean {
  return !state.manual && state.car?.accepted === true;
}

/** Izvēlētais pārstāvis vai šī numura firmas pirmais. */
export function waybillMobileRepresentative(state: Pick<WaybillMobileFormState, "representative" | "plate">): string {
  const own = state.representative.trim();
  if (own) return own;
  return waybillRepresentativesForPlate(state.plate)[0] ?? "";
}

export type WaybillMobileChipTone = "wait" | "wip" | "ok" | "bad";

export const WAYBILL_MOBILE_STATUS: Record<WaybillRequestStatus, { label: string; tone: WaybillMobileChipTone }> = {
  queued: { label: "Gaida", tone: "wait" },
  in_progress: { label: "Izveido", tone: "wip" },
  issued: { label: "Izdota", tone: "ok" },
  error: { label: "Kļūda", tone: "bad" },
  cancelled: { label: "Atcelts", tone: "wait" },
};

export type WaybillMobileRequestRow = {
  id: string;
  title: string;
  sub: string;
  label: string;
  tone: WaybillMobileChipTone;
  pdfUrl: string;
  canRetry: boolean;
  /** "Atcelt": tikai Gaida un vēl neviens nav paņēmis. */
  canCancel: boolean;
  errorText: string;
  /** Novecojis: 24 h bez virzības - tikai Arhīvā. */
  stale: boolean;
  progress: WaybillMobileProgress;
};

/**
 * Dzīvais progress: 3 soļi (Gaida - Izveido - Izdota). Joslas platums atbilst TIKAI reālam solim
 * (worker notikumi: paņemts, VPN, forma, Saglabāt, PDF), nevis laikam - nekādu izdomātu procentu.
 */
export type WaybillMobileProgress = {
  step: 1 | 2 | 3;
  pct: number;
  text: string;
};

/** Joslas platums pēc reālā soļa. */
const STAGE_PCT: Record<WaybillWorkerStage, number> = { claimed: 40, vpn: 50, filling: 62, saving: 78, pdf: 90 };

/** Pēc cik ilga gaidīšanas rāda "Gaida ilgāk nekā parasti" un ļauj atkārtot. */
export const WAYBILL_MOBILE_LONG_WAIT_MS = 15 * 60 * 1000;

function hm(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function sinceMs(iso: string, nowMs: number): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, nowMs - t) : 0;
}

export function waybillMobileProgress(
  request: Pick<WaybillRequest, "status" | "createdAt" | "updatedAt" | "pickedAt" | "errorReason" | "validUntil" | "waybillNo"> &
    Partial<Pick<WaybillRequest, "stage">>,
  nowMs = Date.now(),
  auto: { autoMode?: WaybillAutoMode; autoStandard?: boolean } = {},
): WaybillMobileProgress {
  if (request.status === "issued") {
    const until = formatRigaDateTimeComma(request.validUntil);
    const text = [request.waybillNo ? `Nr. ${request.waybillNo}` : "", until ? `derīga līdz ${until}` : ""].filter(Boolean).join(" · ");
    return { step: 3, pct: 100, text: text || "Pavadzīme izdota." };
  }
  if (request.status === "error") {
    const reason = request.errorReason.trim();
    const text = waybillErrorNeedsCheck(reason)
      ? "Iespējams, pavadzīme CSDD jau ir izveidota. Pārbaudi, pirms atkārto."
      : `Neizdevās${reason ? `: ${reason.replace(/[.\s]+$/, "")}` : ""}. Spied "Atkārtot".`;
    return { step: request.pickedAt ? 2 : 1, pct: request.pickedAt ? 66 : 33, text };
  }
  if (request.status === "cancelled") return { step: 1, pct: 0, text: "Atcelts." };
  if (request.status === "in_progress") {
    if (request.stage) return { step: 2, pct: STAGE_PCT[request.stage], text: WAYBILL_WORKER_STAGE_TEXT[request.stage] };
    return { step: 2, pct: 40, text: "Aivars veido pavadzīmi CSDD..." };
  }
  const honest = waybillQueuedText({ expired: waybillPendingExpired(request, nowMs), ...auto });
  if (honest) return { step: 1, pct: 10, text: honest };
  const waited = sinceMs(request.updatedAt || request.createdAt, nowMs);
  if (waited > WAYBILL_MOBILE_LONG_WAIT_MS) {
    return { step: 1, pct: 10, text: 'Gaida ilgāk nekā parasti. Ja steidzami, spied "Atkārtot" vai raksti Aivaram.' };
  }
  return { step: 1, pct: 10, text: "Rindā. Aivars sāks pēc brīža." };
}

/**
 * Vai pieprasījums ir "tagadējs" (pirmajā lapā): darbā, nesena kļūda vai izrakstīta un vēl derīga.
 * Beigušās, vecas kļūdas un novecojušie (24 h bez virzības) ir tikai Arhīvā.
 */
export function waybillMobileRequestIsCurrent(
  request: Pick<WaybillRequest, "status" | "createdAt" | "updatedAt" | "validUntil">,
  nowMs = Date.now(),
): boolean {
  if (isStaleWaybillRequest(request, nowMs)) return false;
  // Atceltie pazūd no rindas (redzami tikai Arhīvā).
  if (request.status === "cancelled") return false;
  if (request.status === "queued" || request.status === "in_progress") return true;
  if (request.status === "issued") {
    const until = Date.parse(request.validUntil);
    return Number.isFinite(until) && until > nowMs;
  }
  return sinceMs(request.updatedAt || request.createdAt, nowMs) <= 24 * 60 * 60 * 1000;
}

/** Kompakts Aivara pieprasījumu saraksts (jaunākie augšā). which: tagadējie vai arhīvs. */
export function waybillMobileRequestRows(
  requests: ReadonlyArray<WaybillRequest>,
  replies: ReadonlyArray<WaybillAivarsReply>,
  limit = 5,
  opts: { nowMs?: number; which?: "current" | "archive" | "all" } = {},
): WaybillMobileRequestRow[] {
  const nowMs = opts.nowMs ?? Date.now();
  const which = opts.which ?? "current";
  return [...requests]
    .filter((request) => {
      if (which === "all") return true;
      const current = waybillMobileRequestIsCurrent(request, nowMs);
      return which === "current" ? current : !current;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map((request) => {
      const reply = replies.find((r) => r.requestId === request.id);
      const status = reply?.status ?? request.status;
      const stale = isStaleWaybillRequest({ ...request, status }, nowMs);
      const hours =
        request.validHours && request.validHours >= 1
          ? request.validHours
          : (waybillHoursBetween(request.validFrom, request.validUntil) ?? 0);
      const waybillNo = reply?.waybillNo || request.waybillNo;
      const sub = [
        waybillNo,
        displayDealerPlate(request.vehicle.plate) || request.vehicle.plate,
        hours ? `${hours} h` : "",
        hm(request.createdAt),
      ]
        .filter(Boolean)
        .join(" · ");
      const progress = waybillMobileProgress({ ...request, status, waybillNo }, nowMs, {
        autoMode: reply?.autoMode,
        autoStandard: reply?.autoStandard,
      });
      const longWait = status === "queued" && sinceMs(request.updatedAt || request.createdAt, nowMs) > WAYBILL_MOBILE_LONG_WAIT_MS;
      return {
        id: request.id,
        title: request.vehicle.brandModel || request.noteUntrusted || "Auto",
        sub,
        label: stale ? WAYBILL_STALE_LABEL : WAYBILL_MOBILE_STATUS[status].label,
        tone: stale ? "wait" : WAYBILL_MOBILE_STATUS[status].tone,
        pdfUrl: reply?.pdfUrl || request.pdfUrl,
        canRetry: status === "error" || (status === "queued" && (longWait || stale) && !waybillPendingExpired(request, nowMs)),
        canCancel: waybillRequestCancellable({ status, pickedBy: request.pickedBy }),
        errorText: status === "error" ? request.errorReason || reply?.text || "" : "",
        stale,
        progress,
      };
    });
}

export function firstFreeWaybillPlate(plates: ReadonlyArray<WaybillPlateState>, fallback: string): string {
  return plates.find((row) => !row.busy)?.plate ?? fallback;
}
