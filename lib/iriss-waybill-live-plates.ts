/**
 * Numuru stāvoklis apļiem UN numura pogām (viens kopīgs selektors, j25).
 * Incidents 23.10: P02816 (B193-7, tradeAct) izdota, poga rādīja "aizņemts", bet aplis "brīvs" -
 * aplis datus ielādēja tikai vienreiz un nezināja par izdoto pieprasījumu, kamēr tas vēl nebija indeksā/CSDD momentuzņēmumā.
 * Tāpēc: indekss + CSDD (mergeCsddPlateStates) + pieprasījumu rinda (izdotās vēl derīgās un "izdod...").
 */

import { compactDealerPlate, type WaybillPlateState } from "@/lib/iriss-waybill-plates";
import {
  isStaleWaybillRequest,
  waybillPendingExpired,
  waybillWrittenOffAtMs,
  type WaybillRequest,
} from "@/lib/iriss-waybill-requests";

export type WaybillLiveRequest = Pick<
  WaybillRequest,
  "id" | "status" | "createdAt" | "updatedAt" | "validUntil" | "waybillNo" | "vehicle"
> &
  Partial<Pick<WaybillRequest, "pickedBy" | "autoDisabled" | "attempts" | "plateBusyAtCreate" | "handoffAt">>;

/**
 * j47: pieprasījumu izraksta Aivars ar roku (ne automātika). Bez servera konteksta (testa režīms, numura aizņemtība)
 * - tikai pazīmes pašā pieprasījumā; pārējie paliek "izdod...".
 */
export function waybillRequestIsManual(r: WaybillLiveRequest): boolean {
  if (r.status === "in_progress") return Boolean(r.pickedBy) && r.pickedBy !== "auto";
  if (r.status !== "queued") return false;
  return (
    r.autoDisabled === true ||
    Boolean(r.handoffAt) ||
    (r.attempts ?? 1) > 1 ||
    r.plateBusyAtCreate === true ||
    compactDealerPlate(r.vehicle.plate) === "B1927"
  );
}

function ms(iso: string | undefined): number {
  const t = Date.parse(iso ?? "");
  return Number.isFinite(t) ? t : Number.NaN;
}

/** Izdota, vēl derīga (nav beigusies, nav aizstāta ar jaunāku izdoto tam pašam numuram) pieprasījuma pavadzīme. */
function liveIssuedFor(plate: string, requests: readonly WaybillLiveRequest[], nowMs: number): WaybillLiveRequest | null {
  const want = compactDealerPlate(plate);
  let best: WaybillLiveRequest | null = null;
  for (const r of requests) {
    if (r.status !== "issued" || compactDealerPlate(r.vehicle.plate) !== want) continue;
    const until = ms(r.validUntil);
    if (!Number.isFinite(until) || until <= nowMs) continue;
    if (waybillWrittenOffAtMs(r, requests, nowMs) != null) continue;
    if (!best || until > ms(best.validUntil)) best = r;
  }
  return best;
}

/** Jaunākais pieprasījums šim numuram, ko CSDD vēl izdod (Gaida / Izveido, ne novecojis, termiņš nav beidzies). */
function issuingFor(plate: string, requests: readonly WaybillLiveRequest[], nowMs: number): WaybillLiveRequest | null {
  const want = compactDealerPlate(plate);
  let best: WaybillLiveRequest | null = null;
  for (const r of requests) {
    if (r.status !== "queued" && r.status !== "in_progress") continue;
    if (compactDealerPlate(r.vehicle.plate) !== want) continue;
    if (isStaleWaybillRequest(r, nowMs) || waybillPendingExpired(r, nowMs)) continue;
    if (!best || r.createdAt > best.createdAt) best = r;
  }
  return best;
}

/**
 * Pieprasījumu rinda papildina numuru stāvokli: izdota derīga pavadzīme vienmēr padara numuru aizņemtu
 * (arī, ja Dropbox indekss / CSDD momentuzņēmums to vēl neredz). "Brīvs" nekad nepārraksta "aizņemts".
 */
export function withWaybillRequestStates(
  states: readonly WaybillPlateState[],
  requests: readonly WaybillLiveRequest[],
  nowMs = Date.now(),
): WaybillPlateState[] {
  return states.map((state) => {
    let next: WaybillPlateState = { plate: state.plate, busy: state.busy, ...(state.current ? { current: state.current } : {}) };
    const issued = liveIssuedFor(state.plate, requests, nowMs);
    if (issued) {
      const no = issued.waybillNo.trim().toUpperCase();
      const cur = state.current;
      const same = Boolean(no && cur?.number && cur.number.toUpperCase() === no);
      if (same && cur) {
        next = { ...next, busy: true, current: { ...cur, brandModel: cur.brandModel || issued.vehicle.brandModel.trim() } };
      } else if (!state.busy || !cur || !(ms(cur.validUntil) >= ms(issued.validUntil))) {
        next = {
          ...next,
          busy: true,
          current: { number: no, brandModel: issued.vehicle.brandModel.trim(), validUntil: issued.validUntil },
        };
      }
    }
    const issuing = issuingFor(state.plate, requests, nowMs);
    if (issuing) {
      next.issuing = {
        brandModel: issuing.vehicle.brandModel.trim(),
        ...(waybillRequestIsManual(issuing) ? { manual: true } : {}),
      };
    }
    return next;
  });
}

/** Pārlūkā: pavadzīmju forma (ik 3-10 s) paziņo jaunāko numuru stāvokli, apļi to uzreiz parāda. */
export const WAYBILL_PLATES_EVENT = "iriss:waybill-plates";

export function publishWaybillPlates(plates: readonly WaybillPlateState[]): void {
  if (typeof window === "undefined" || !plates.length) return;
  window.dispatchEvent(new CustomEvent<readonly WaybillPlateState[]>(WAYBILL_PLATES_EVENT, { detail: plates }));
}
