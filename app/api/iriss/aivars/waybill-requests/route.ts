import { NextResponse } from "next/server";
import { IRISS_AIVARS_API_TOKEN_ENV, irissAivarsApiTokenConfigured, verifyIrissAivarsApiToken } from "@/lib/iriss-aivars-api-token";
import { AIVARS_ACTION_CREATE_WAYBILL, toAivarsCreateWaybillAction } from "@/lib/iriss-waybill-create";
import { listPendingWaybillRequests } from "@/lib/iriss-waybill-requests-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(req: Request) {
  if (!irissAivarsApiTokenConfigured()) {
    return NextResponse.json(
      { error: "not_configured", env: IRISS_AIVARS_API_TOKEN_ENV },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  if (!verifyIrissAivarsApiToken(req.headers.get("authorization"))) return unauthorized();
  const pending = await listPendingWaybillRequests();
  return NextResponse.json(
    {
      ok: true,
      action: AIVARS_ACTION_CREATE_WAYBILL,
      requests: pending.map(toAivarsCreateWaybillAction),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
