import { NextResponse, after } from "next/server";
import { irissAivarsApiTokenConfigured, verifyIrissAivarsApiToken } from "@/lib/iriss-aivars-api-token";
import { toAivarsWaybillAction } from "@/lib/iriss-waybill-create";
import { isWaybillRequestEventKind, isWaybillWorkerStage, waybillCancelPending } from "@/lib/iriss-waybill-requests";
import { ackWaybillCancel, appendWaybillRequestEvent } from "@/lib/iriss-waybill-requests-store";
import { ensureWaybillRequestInDropbox } from "@/lib/iriss-waybill-dropbox";

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
  let body: {
    kind?: unknown;
    text?: unknown;
    waybillNo?: unknown;
    pdfUrl?: unknown;
    errorReason?: unknown;
    by?: unknown;
    stage?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  // Atcelšanas apstiprinājums: izrakstītājs apstājās pirms CSDD Saglabāt (tikai, ja atcelšana pieprasīta).
  if (body.kind === "cancelled") {
    const ack = await ackWaybillCancel({
      id,
      by: body.by === "auto" ? "auto" : "aivars",
      text: typeof body.text === "string" ? body.text : "",
    });
    if (!ack.ok) {
      return ack.reason === "not_found"
        ? NextResponse.json({ error: "not_found" }, { status: 404 })
        : NextResponse.json({ error: "cancel_not_requested" }, { status: 409 });
    }
    return NextResponse.json(
      { ok: true, request: toAivarsWaybillAction(ack.request), status: ack.request.status, cancelRequested: false },
      { headers: { "Cache-Control": "private, no-store" } },
    );
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
    // Automātikas solis (VPN, forma, Saglabāt, PDF): UI rāda tikai šos reālos soļus.
    stage: isWaybillWorkerStage(body.stage) ? body.stage : undefined,
  });
  if (!request) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // Izdota (arī Aivara ar roku): PDF -> Dropbox /Pavadzīmes_IRISS; kļūdu cron mēģina vēlreiz.
  if (request.status === "issued" && !request.dropboxPath) after(() => ensureWaybillRequestInDropbox(request.id));
  return NextResponse.json(
    {
      ok: true,
      request: toAivarsWaybillAction(request),
      status: request.status,
      // Lietotājs nospieda "Atcelt": apstājies pirms nākamā CSDD soļa un atsūti {kind:"cancelled"}.
      // Ja Saglabāt jau notika - pabeidz parasti (result); serveris atzīmēs "jāanulē manuāli".
      cancelRequested: waybillCancelPending(request) || request.status === "cancelled",
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
