import { NextResponse, after } from "next/server";
import { IRISS_AIVARS_API_TOKEN_ENV, irissAivarsApiTokenConfigured, verifyIrissAivarsApiToken } from "@/lib/iriss-aivars-api-token";
import { AIVARS_ACTION_CREATE_WAYBILL, toAivarsCreateWaybillAction } from "@/lib/iriss-waybill-create";
import { autoWaybillEnabled, classifyWaybillForAuto, hiddenFromAivars, plateTakenByOtherRequest } from "@/lib/iriss-waybill-auto";
import { autoWaybillLiveNow, busyWaybillPlatesNow } from "@/lib/iriss-waybill-auto-server";
import { pendingWaybillRequests } from "@/lib/iriss-waybill-requests";
import { readWaybillRequestsDoc } from "@/lib/iriss-waybill-requests-store";
import { noteWaybillWorkerHeartbeat } from "@/lib/iriss-ttr-control-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const enabled = autoWaybillEnabled();
  if (!scopeAuto && !enabled) {
    return NextResponse.json(
      { ok: true, action: AIVARS_ACTION_CREATE_WAYBILL, requests: pending.map(toAivarsCreateWaybillAction) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }
  const isBusy = await busyWaybillPlatesNow();
  // Aivaram standarta darbus uz 3 min slēpj tikai, ja worker tiešām izraksta (nav dry-run), citādi tie gaidītu velti.
  const live = scopeAuto ? enabled : await autoWaybillLiveNow(nowMs);
  const rows = pending.map((request) => ({
    request,
    auto: classifyWaybillForAuto(request, {
      plateBusyNow: isBusy(request.vehicle.plate),
      plateInOtherRequest: plateTakenByOtherRequest(doc.requests, request, nowMs),
      nowMs,
    }),
  }));
  const requests = scopeAuto
    ? enabled
      ? rows
          .filter((row) => row.auto.standard)
          .map((row) => ({ ...toAivarsCreateWaybillAction(row.request), auto: row.auto }))
      : []
    : rows
        .filter((row) => !hiddenFromAivars(row.auto, row.request.createdAt, nowMs, live))
        .map((row) => toAivarsCreateWaybillAction(row.request));
  return NextResponse.json(
    { ok: true, action: AIVARS_ACTION_CREATE_WAYBILL, enabled, requests },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
