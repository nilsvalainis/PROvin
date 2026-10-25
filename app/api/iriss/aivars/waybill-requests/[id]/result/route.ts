import { NextResponse, after } from "next/server";
import { irissAivarsApiTokenConfigured, verifyIrissAivarsApiToken } from "@/lib/iriss-aivars-api-token";
import { toAivarsCreateWaybillAction, toAivarsWaybillAction } from "@/lib/iriss-waybill-create";
import { isWaybillStopRequest } from "@/lib/iriss-waybill-stop";
import { completeWaybillRequest, handAutoFailureToAivars } from "@/lib/iriss-waybill-requests-store";
import { autoFailureHandoff } from "@/lib/iriss-waybill-requests";
import { wakeAivars } from "@/lib/iriss-aivars-wake";
import { uploadIrissPavadzime } from "@/lib/iriss-pavadzimes-store";
import { ensureWaybillRequestInDropbox } from "@/lib/iriss-waybill-dropbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
    ok?: unknown;
    waybillNo?: unknown;
    pdfUrl?: unknown;
    pdfBase64?: unknown;
    fileName?: unknown;
    errorReason?: unknown;
    by?: unknown;
    validFrom?: unknown;
    validUntil?: unknown;
    validTo?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const ok = body.ok === true;
  let pdfUrl = typeof body.pdfUrl === "string" ? body.pdfUrl.trim() : "";
  const waybillNo = typeof body.waybillNo === "string" ? body.waybillNo.trim() : "";
  if (ok && typeof body.pdfBase64 === "string" && body.pdfBase64.trim()) {
    try {
      const bytes = Buffer.from(body.pdfBase64.trim(), "base64");
      const fileName =
        (typeof body.fileName === "string" && body.fileName.trim().endsWith(".pdf")
          ? body.fileName.trim()
          : `${waybillNo || "pavadzime"}.pdf`);
      const rec = await uploadIrissPavadzime({ fileName, bytes });
      pdfUrl = `/api/admin/iriss-pavadzimes/${encodeURIComponent(rec.id)}/pdf`;
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "pdf_store_failed" },
        { status: 500 },
      );
    }
  }
  const by = body.by === "auto" ? "auto" : "aivars";
  const errorReason = typeof body.errorReason === "string" ? body.errorReason : "";
  // j57: CSDD piešķirtais derīguma laiks (ja rezultāts to sūta) - uzvar pāri pieprasījuma brīdī aprēķinātajam.
  const validFrom = typeof body.validFrom === "string" ? body.validFrom : undefined;
  const validUntilRaw = body.validUntil ?? body.validTo;
  const validUntil = typeof validUntilRaw === "string" ? validUntilRaw : undefined;
  // j47: automātikas neveiksme nedrīkst palikt klusa "Kļūda" - pavadzīme nav izrakstīta, Aivars par to nezina.
  // Nododam Aivaram (atpakaļ rindā, neautomātisks) un pamodinām. Izņēmums: "numurs CSDD aizņemts" - lemj lietotājs.
  if (!ok && by === "auto") {
    const decision = autoFailureHandoff(errorReason);
    if (decision.handoff) {
      const handed = await handAutoFailureToAivars({ id, reason: errorReason, checkCsddFirst: decision.checkCsddFirst });
      if (handed) {
        after(() => wakeAivars(handed.id));
        return NextResponse.json(
          { ok: true, request: toAivarsCreateWaybillAction(handed), status: handed.status, handedToAivars: true },
          { headers: { "Cache-Control": "private, no-store" } },
        );
      }
    }
  }
  const request = await completeWaybillRequest({
    id,
    ok,
    waybillNo,
    pdfUrl,
    errorReason,
    by,
    validFrom,
    validUntil,
  });
  if (!request) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // Izdotās pavadzīmes PDF -> Dropbox /Pavadzīmes_IRISS (idempotenti, pārbaudīts); kļūdu cron mēģina vēlreiz.
  if (request.status === "issued" && !isWaybillStopRequest(request) && !request.dropboxPath) {
    after(() => ensureWaybillRequestInDropbox(request.id));
  }
  return NextResponse.json(
    {
      ok: true,
      request: toAivarsWaybillAction(request),
      status: request.status,
      waybillNo: request.waybillNo,
      pdfUrl: request.pdfUrl,
      errorReason: request.errorReason,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
