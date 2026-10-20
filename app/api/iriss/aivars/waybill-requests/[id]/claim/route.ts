import { NextResponse } from "next/server";
import { irissAivarsApiTokenConfigured, verifyIrissAivarsApiToken } from "@/lib/iriss-aivars-api-token";
import { toAivarsCreateWaybillAction } from "@/lib/iriss-waybill-create";
import { claimWaybillRequest } from "@/lib/iriss-waybill-requests-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  if (!irissAivarsApiTokenConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  if (!verifyIrissAivarsApiToken(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const request = await claimWaybillRequest(id);
  if (!request) return NextResponse.json({ error: "already_claimed" }, { status: 409 });
  return NextResponse.json(
    { ok: true, request: toAivarsCreateWaybillAction(request), status: request.status, pickedAt: request.pickedAt },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
