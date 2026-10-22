import { NextResponse } from "next/server";
import { irissAivarsApiTokenConfigured, verifyIrissAivarsApiToken } from "@/lib/iriss-aivars-api-token";
import { toAivarsCreateWaybillAction } from "@/lib/iriss-waybill-create";
import { completeWaybillRequest } from "@/lib/iriss-waybill-requests-store";
import { uploadIrissPavadzime } from "@/lib/iriss-pavadzimes-store";

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
  const request = await completeWaybillRequest({
    id,
    ok,
    waybillNo,
    pdfUrl,
    errorReason: typeof body.errorReason === "string" ? body.errorReason : "",
    by: body.by === "auto" ? "auto" : "aivars",
  });
  if (!request) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(
    {
      ok: true,
      request: toAivarsCreateWaybillAction(request),
      status: request.status,
      waybillNo: request.waybillNo,
      pdfUrl: request.pdfUrl,
      errorReason: request.errorReason,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
