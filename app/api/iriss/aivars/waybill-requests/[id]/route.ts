import { NextResponse } from "next/server";
import { irissAivarsApiTokenConfigured, verifyIrissAivarsApiToken } from "@/lib/iriss-aivars-api-token";
import { toAivarsWaybillAction } from "@/lib/iriss-waybill-create";
import { waybillCancelPending } from "@/lib/iriss-waybill-requests";
import { readWaybillRequestsDoc } from "@/lib/iriss-waybill-requests-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Viena darba statuss izrakstītājam (automātika pirms CSDD Saglabāt, Aivars): vai lietotājs nav atcēlis.
 * Tikai lasa. 06.11 Aivars šo ceļu jau mēģināja (404) - tagad tas atbild.
 */
export async function GET(req: Request, ctx: Ctx) {
  if (!irissAivarsApiTokenConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  if (!verifyIrissAivarsApiToken(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const request = (await readWaybillRequestsDoc()).requests.find((row) => row.id === id);
  if (!request) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(
    {
      ok: true,
      request: toAivarsWaybillAction(request),
      status: request.status,
      pickedBy: request.pickedBy,
      cancelRequested: waybillCancelPending(request) || request.status === "cancelled",
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
