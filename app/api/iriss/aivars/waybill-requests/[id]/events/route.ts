import { NextResponse } from "next/server";
import { irissAivarsApiTokenConfigured, verifyIrissAivarsApiToken } from "@/lib/iriss-aivars-api-token";
import { toAivarsCreateWaybillAction } from "@/lib/iriss-waybill-create";
import { isWaybillRequestEventKind } from "@/lib/iriss-waybill-requests";
import { appendWaybillRequestEvent } from "@/lib/iriss-waybill-requests-store";

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
  let body: { kind?: unknown; text?: unknown; waybillNo?: unknown; pdfUrl?: unknown; errorReason?: unknown; by?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (body.kind !== "in_progress" && body.kind !== "issued" && body.kind !== "error" && body.kind !== "message") {
    return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  }
  if (!isWaybillRequestEventKind(body.kind)) {
    return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  }
  const request = await appendWaybillRequestEvent({
    id,
    kind: body.kind,
    text: typeof body.text === "string" ? body.text : "",
    waybillNo: typeof body.waybillNo === "string" ? body.waybillNo : "",
    pdfUrl: typeof body.pdfUrl === "string" ? body.pdfUrl : "",
    errorReason: typeof body.errorReason === "string" ? body.errorReason : "",
    by: body.by === "auto" ? "auto" : "aivars",
  });
  if (!request) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(
    { ok: true, request: toAivarsCreateWaybillAction(request), status: request.status },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
