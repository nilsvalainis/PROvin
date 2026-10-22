import { NextResponse, after } from "next/server";
import { irissAivarsApiTokenConfigured, verifyIrissAivarsApiToken } from "@/lib/iriss-aivars-api-token";
import { wakeAivars } from "@/lib/iriss-aivars-wake";
import { toAivarsCreateWaybillAction } from "@/lib/iriss-waybill-create";
import { AUTO_WAYBILL_WORKER } from "@/lib/iriss-waybill-auto";
import { releaseWaybillRequestToAivars } from "@/lib/iriss-waybill-requests-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Automātika atdod darbu Aivaram (kļūda pirms Saglabāt, VPN aizņemts u.c.) un pamodina viņu. */
export async function POST(req: Request, ctx: Ctx) {
  if (!irissAivarsApiTokenConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  if (!verifyIrissAivarsApiToken(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  let reason = "";
  try {
    const body = (await req.json()) as { reason?: unknown };
    reason = typeof body.reason === "string" ? body.reason.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, 300) : "";
  } catch {
    /* tukšs iemesls */
  }
  const request = await releaseWaybillRequestToAivars({ id, by: AUTO_WAYBILL_WORKER, reason: reason || "kļūda" });
  if (!request) return NextResponse.json({ error: "not_held_by_auto" }, { status: 409 });
  after(() => wakeAivars(request.id));
  return NextResponse.json(
    { ok: true, request: toAivarsCreateWaybillAction(request), status: request.status },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
