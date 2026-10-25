import { NextResponse, after } from "next/server";
import { IRISS_AIVARS_API_TOKEN_ENV, irissAivarsApiTokenConfigured, verifyIrissAivarsApiToken } from "@/lib/iriss-aivars-api-token";
import { AIVARS_ACTION_CREATE_WAYBILL, toAivarsCreateWaybillAction } from "@/lib/iriss-waybill-create";
import { isWaybillStopRequest, toAivarsStopWaybillAction } from "@/lib/iriss-waybill-stop";
import {
  AUTO_WAYBILL_PLATES,
  autoWaybillEnabled,
  autoWaybillReplaceEnabled,
  classifyWaybillForAuto,
  hiddenFromAivars,
  plateTakenByOtherRequest,
} from "@/lib/iriss-waybill-auto";
import { autoWaybillLiveNow, busyWaybillPlatesNow } from "@/lib/iriss-waybill-auto-server";
import { pendingWaybillRequests } from "@/lib/iriss-waybill-requests";
import { readWaybillRequestsDoc } from "@/lib/iriss-waybill-requests-store";
import { noteWaybillWorkerHeartbeat } from "@/lib/iriss-ttr-control-store";
import { knownWaybillNumbers } from "@/lib/iriss-waybill-csdd-plates";
import { readCsddPlatesDocSafe } from "@/lib/iriss-waybill-csdd-plates-store";
import { readIrissPavadzimesCached } from "@/lib/iriss-pavadzimes-store";
import type { IrissDealerPlate } from "@/lib/iriss-waybill-plates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ctx1 (ĪRISS) / ctx2 (DZA) -> zināmie pavadzīmju numuri. Kļūda -> tukšs (worker tad meklē tikai CSDD sarakstos). */
async function knownByCtx(): Promise<Record<"ctx1" | "ctx2", string[]>> {
  const [rows, csdd] = await Promise.all([readIrissPavadzimesCached().catch(() => []), readCsddPlatesDocSafe()]);
  const plates = (ctx: "ctx1" | "ctx2") =>
    (Object.keys(AUTO_WAYBILL_PLATES) as IrissDealerPlate[]).filter((p) => AUTO_WAYBILL_PLATES[p].ctx === ctx);
  return {
    ctx1: knownWaybillNumbers(rows, csdd, plates("ctx1")),
    ctx2: knownWaybillNumbers(rows, csdd, plates("ctx2")),
  };
}

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
}

/**
 * Aivars: rindas darbi. Ja ieslēgta automātika (IRISS_WAYBILL_AUTO=1), standarta darbus pirmās 3 min ņem
 * Hetzner worker (`?scope=auto`, tikai standarta + mērķis), pēc tam tie redzami arī Aivaram kā rezerve.
 * Worker sūta `&live=1|0` (īstais režīms vai dry-run) - no tā UI zina, vai automātika tiešām izraksta.
 */
export async function GET(req: Request) {
  if (!irissAivarsApiTokenConfigured()) {
    return NextResponse.json(
      { error: "not_configured", env: IRISS_AIVARS_API_TOKEN_ENV },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  if (!verifyIrissAivarsApiToken(req.headers.get("authorization"))) return unauthorized();
  const params = new URL(req.url).searchParams;
  const scopeAuto = params.get("scope") === "auto";
  if (scopeAuto && params.has("live")) {
    const live = params.get("live") === "1";
    after(() => noteWaybillWorkerHeartbeat(live));
  }
  const nowMs = Date.now();
  const doc = await readWaybillRequestsDoc();
  const pending = pendingWaybillRequests(doc.requests, nowMs);
  const creates = pending.filter((row) => !isWaybillStopRequest(row));
  const stops = pending.filter((row) => isWaybillStopRequest(row));
  const enabled = autoWaybillEnabled();
  if (!scopeAuto && !enabled) {
    return NextResponse.json(
      {
        ok: true,
        action: AIVARS_ACTION_CREATE_WAYBILL,
        requests: creates.map(toAivarsCreateWaybillAction),
        stopRequests: stops.map(toAivarsStopWaybillAction),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }
  const isBusy = await busyWaybillPlatesNow();
  // Aivaram standarta darbus uz 3 min slēpj tikai, ja worker tiešām izraksta (nav dry-run), citādi tie gaidītu velti.
  const live = scopeAuto ? enabled : await autoWaybillLiveNow(nowMs);
  const rows = creates.map((request) => ({
    request,
    auto: classifyWaybillForAuto(request, {
      plateBusyNow: isBusy(request.vehicle.plate),
      plateInOtherRequest: plateTakenByOtherRequest(doc.requests, request, nowMs),
      nowMs,
      replaceEnabled: autoWaybillReplaceEnabled(),
    }),
  }));
  // Worker CSDD pārbaudei: zināmie numuri (CSDD + indekss) firmas numuriem, no kuriem sākt meklēt jaunākās pavadzīmes.
  // Darbiem - tikai, ja ir standarta darbs; periodiskajai sinhronizācijai (ik ~5 min) - ar &known=1.
  const wantKnown = scopeAuto && params.get("known") === "1";
  const known = scopeAuto && (wantKnown || rows.some((row) => row.auto.standard)) ? await knownByCtx() : null;
  const requests = scopeAuto
    ? enabled
      ? rows
          .filter((row) => row.auto.standard)
          .map((row) => ({
            ...toAivarsCreateWaybillAction(row.request),
            auto: row.auto,
            knownWaybills: row.auto.standard && known ? known[row.auto.ctx] : [],
          }))
      : []
    : rows
        .filter((row) => !hiddenFromAivars(row.auto, row.request.createdAt, nowMs, live))
        .map((row) => toAivarsCreateWaybillAction(row.request));
  return NextResponse.json(
    {
      ok: true,
      action: AIVARS_ACTION_CREATE_WAYBILL,
      enabled,
      requests,
      stopRequests: scopeAuto ? [] : stops.map(toAivarsStopWaybillAction),
      ...(wantKnown && known ? { knownWaybills: known } : {}),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
