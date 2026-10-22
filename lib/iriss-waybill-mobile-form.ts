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
} from "@/lib/iriss-waybill-create";
import { displayDealerPlate, type WaybillPlateState } from "@/lib/iriss-waybill-plates";
import type { WaybillAivarsReply, WaybillRequest, WaybillRequestStatus } from "@/lib/iriss-waybill-requests";

export const WAYBILL_MOBILE_HOUR_PRESETS = [12, 24, 48] as const;

export type WaybillRoutePlace = "tukums" | "other";

export type WaybillMobileCar = { brandModel: string; vin: string; id: string };

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
  from: WaybillRoutePlace;
  fromAddress: string;
  to: WaybillRoutePlace;
  toAddress: string;
};

export type WaybillMobilePayload = {
  plate: string;
  brandModel: string;
  vin: string;
  validHours: number;
  comment_untrusted: string;
  routeFromAddress: string;
  routeToAddress: string;
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
    to: "tukums",
    toAddress: "",
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
  if (!brandModel && !comment) return { ok: false, error: "Izvēlies auto vai uzraksti komentāru." };
  if (!brandModel && !waybillHintsFromComment(comment).brandModel) {
    return { ok: false, error: 'Komentārā neatradu auto. Raksti, piem., "193 uz BMW 330".' };
  }
  const validHours = waybillMobileHours(state);
  if (validHours == null) return { ok: false, error: `Ieraksti stundas: 1 līdz ${WAYBILL_VALID_MAX_HOURS}.` };
  const fromAddress = state.from === "other" ? state.fromAddress.trim().slice(0, WAYBILL_ROUTE_MAX) : "";
  const toAddress = state.to === "other" ? state.toAddress.trim().slice(0, WAYBILL_ROUTE_MAX) : "";
  if (state.from === "other" && !fromAddress) return { ok: false, error: "Ieraksti sākuma adresi." };
  if (state.to === "other" && !toAddress) return { ok: false, error: "Ieraksti galamērķa adresi." };
  return {
    ok: true,
    payload: {
      plate,
      brandModel,
      vin: state.manual ? "" : (state.car?.vin ?? ""),
      validHours,
      comment_untrusted: comment,
      routeFromAddress: fromAddress,
      routeToAddress: toAddress,
    },
  };
}

export type WaybillMobileChipTone = "wait" | "wip" | "ok" | "bad";

export const WAYBILL_MOBILE_STATUS: Record<WaybillRequestStatus, { label: string; tone: WaybillMobileChipTone }> = {
  queued: { label: "Gaida", tone: "wait" },
  in_progress: { label: "Izveido", tone: "wip" },
  issued: { label: "Izdota", tone: "ok" },
  error: { label: "Kļūda", tone: "bad" },
};

export type WaybillMobileRequestRow = {
  id: string;
  title: string;
  sub: string;
  label: string;
  tone: WaybillMobileChipTone;
  pdfUrl: string;
  canRetry: boolean;
  errorText: string;
};

function hm(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Kompakts Aivara pieprasījumu saraksts (jaunākie augšā). */
export function waybillMobileRequestRows(
  requests: ReadonlyArray<WaybillRequest>,
  replies: ReadonlyArray<WaybillAivarsReply>,
  limit = 5,
): WaybillMobileRequestRow[] {
  return [...requests]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map((request) => {
      const reply = replies.find((r) => r.requestId === request.id);
      const status = reply?.status ?? request.status;
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
      return {
        id: request.id,
        title: request.vehicle.brandModel || request.noteUntrusted || "Auto",
        sub,
        label: WAYBILL_MOBILE_STATUS[status].label,
        tone: WAYBILL_MOBILE_STATUS[status].tone,
        pdfUrl: reply?.pdfUrl || request.pdfUrl,
        canRetry: status === "error",
        errorText: status === "error" ? request.errorReason || reply?.text || "" : "",
      };
    });
}

export function firstFreeWaybillPlate(plates: ReadonlyArray<WaybillPlateState>, fallback: string): string {
  return plates.find((row) => !row.busy)?.plate ?? fallback;
}
