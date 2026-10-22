import { NextResponse } from "next/server";
import { IRISS_AIVARS_API_TOKEN_ENV, irissAivarsApiTokenConfigured, verifyIrissAivarsApiToken } from "@/lib/iriss-aivars-api-token";
import { AIVARS_ACTION_CREATE_WAYBILL, toAivarsCreateWaybillAction } from "@/lib/iriss-waybill-create";
import { autoWaybillEnabled, classifyWaybillForAuto, hiddenFromAivars } from "@/lib/iriss-waybill-auto";
import { busyWaybillPlatesNow } from "@/lib/iriss-waybill-auto-server";
import { listPendingWaybillRequests } from "@/lib/iriss-waybill-requests-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
}

/**
 * Aivars: rindas darbi. Ja ieslēgta automātika (IRISS_WAYBILL_AUTO=1), standarta darbus pirmās 3 min ņem
 * Hetzner worker (`?scope=auto`, tikai standarta + mērķis), pēc tam tie redzami arī Aivaram kā rezerve.
 */
export async function GET(req: Request) {
  if (!irissAivarsApiTokenConfigured()) {
    return NextResponse.json(
      { error: "not_configured", env: IRISS_AIVARS_API_TOKEN_ENV },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  if (!verifyIrissAivarsApiToken(req.headers.get("authorization"))) return unauthorized();
  const scopeAuto = new URL(req.url).searchParams.get("scope") === "auto";
  const pending = await listPendingWaybillRequests();
  const enabled = autoWaybillEnabled();
  if (!scopeAuto && !enabled) {
    return NextResponse.json(
      { ok: true, action: AIVARS_ACTION_CREATE_WAYBILL, requests: pending.map(toAivarsCreateWaybillAction) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }
  const isBusy = await busyWaybillPlatesNow();
  const nowMs = Date.now();
  const rows = pending.map((request) => ({
    request,
    auto: classifyWaybillForAuto(request, { plateBusyNow: isBusy(request.vehicle.plate) }),
  }));
  const requests = scopeAuto
    ? enabled
      ? rows
          .filter((row) => row.auto.standard)
          .map((row) => ({ ...toAivarsCreateWaybillAction(row.request), auto: row.auto }))
      : []
    : rows
        .filter((row) => !hiddenFromAivars(row.auto, row.request.createdAt, nowMs, enabled))
        .map((row) => toAivarsCreateWaybillAction(row.request));
  return NextResponse.json(
    { ok: true, action: AIVARS_ACTION_CREATE_WAYBILL, enabled, requests },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
