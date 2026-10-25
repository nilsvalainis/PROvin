import "server-only";

import { readIrissPavadzimesCached } from "@/lib/iriss-pavadzimes-store";
import { displayDealerPlate, waybillPlateOccupancy, type WaybillPlateState } from "@/lib/iriss-waybill-plates";
import { mergeCsddPlateStates } from "@/lib/iriss-waybill-csdd-plates";
import { readCsddPlatesDocSafe } from "@/lib/iriss-waybill-csdd-plates-store";
import { autoWaybillEnabled, autoWaybillReplaceEnabled, classifyWaybillForAuto, plateTakenByOtherRequest } from "@/lib/iriss-waybill-auto";
import type { WaybillAutoContext, WaybillRequest, WaybillRequestsDoc } from "@/lib/iriss-waybill-requests";
import { waybillWorkerLive } from "@/lib/iriss-ttr-control";
import { readTtrControlDoc } from "@/lib/iriss-ttr-control-store";

/**
 * Numuru stāvoklis: mūsu pavadzīmju indekss + CSDD reģistra momentuzņēmums (Hetzner sync.js, arī ar roku izrakstītās).
 * Met kļūdu, ja indeksu nevar nolasīt (izsaucējs izlemj, ko darīt).
 */
export async function loadWaybillPlateStates(now = new Date()): Promise<WaybillPlateState[]> {
  const [rows, csdd] = await Promise.all([readIrissPavadzimesCached(), readCsddPlatesDocSafe()]);
  return mergeCsddPlateStates(waybillPlateOccupancy(rows, now, csdd), csdd, now.getTime());
}

/**
 * Aizņemtie numuri tieši tagad. Ja nevar nolasīt, visi skaitās aizņemti:
 * automātika labāk atdod darbu Aivaram, nekā riskē ar aktīvu pavadzīmi.
 */
export async function busyWaybillPlatesNow(): Promise<(plate: string) => boolean> {
  try {
    const busy = new Set(
      (await loadWaybillPlateStates())
        .filter((row) => row.busy)
        .map((row) => row.plate as string),
    );
    return (plate) => busy.has(displayDealerPlate(plate));
  } catch (err) {
    console.error("[iriss-waybill] auto_plates_failed", err instanceof Error ? err.message : err);
    return () => true;
  }
}

/** Admin poll ik 3 s: worker sirdspukstu lasa ne biežāk kā reizi 30 s (Blob lasījumu taupība). */
const LIVE_CACHE_MS = 30_000;
let liveCache: { at: number; live: boolean } | null = null;

/** Automātika tiešām izraksta: Vercel IRISS_WAYBILL_AUTO=1 un worker ziņo live režīmu pēdējās 10 min. */
export async function autoWaybillLiveNow(nowMs = Date.now()): Promise<boolean> {
  if (!autoWaybillEnabled()) return false;
  if (liveCache && Math.abs(nowMs - liveCache.at) < LIVE_CACHE_MS) return liveCache.live;
  try {
    const live = waybillWorkerLive(await readTtrControlDoc(), nowMs);
    liveCache = { at: nowMs, live };
    return live;
  } catch (err) {
    console.error("[iriss-waybill] auto_live_failed", err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Automātikas konteksts admin atbildēm: "live" tikai, ja Vercel IRISS_WAYBILL_AUTO=1 UN Hetzner worker ziņo
 * īsto režīmu (IRISS_WAYBILL_WORKER_LIVE=1) pēdējās 10 min. Citādi "test": izraksta Aivars ar roku.
 */
export async function waybillAutoContext(
  doc: WaybillRequestsDoc,
  isBusy?: (plate: string) => boolean,
  nowMs = Date.now(),
): Promise<WaybillAutoContext> {
  const mode = (await autoWaybillLiveNow(nowMs)) ? "live" : "test";
  const busy = isBusy ?? (await busyWaybillPlatesNow());
  const classify = (request: WaybillRequest) =>
    classifyWaybillForAuto(request, {
      plateBusyNow: busy(request.vehicle.plate),
      plateInOtherRequest: plateTakenByOtherRequest(doc.requests, request, nowMs),
      nowMs,
      replaceEnabled: autoWaybillReplaceEnabled(),
    });
  return {
    mode,
    isStandard: (request) => classify(request).standard,
    reasonFor: (request) => {
      const c = classify(request);
      return c.standard ? "" : c.reason;
    },
  };
}
