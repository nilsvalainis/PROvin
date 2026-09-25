import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { persistClientReportFromNotify } from "@/lib/partner-client-report-storage";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { MAX_NOTIFY_ATTACHMENTS_BYTES } from "@/lib/email/notify-attachments-parse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Ieliek PDF partnera / klienta pasūtījumu arhīvā, nesūtot e-pastu.
 */
export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "invalid_body", message: "Nepieciešams PDF fails." }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_body", message: "Neizdevās nolasīt failu." }, { status: 400 });
  }

  const sessionId = String(form.get("sessionId") ?? "").trim();
  if (!sessionId || !isSafeOrderDraftSessionId(sessionId)) {
    return NextResponse.json({ error: "missing_session_id" }, { status: 400 });
  }

  const order = await getCheckoutSessionDetail(sessionId);
  if (!order) {
    return NextResponse.json({ error: "not_found", message: "Pasūtījums nav atrasts." }, { status: 404 });
  }

  const file = form.get("reportPdf");
  if (!(file instanceof File) || file.size <= 0) {
    return NextResponse.json({ error: "no_file", message: "Pievieno PDF failu." }, { status: 400 });
  }
  if (file.size > MAX_NOTIFY_ATTACHMENTS_BYTES) {
    return NextResponse.json(
      { error: "attachments_too_large", message: "PDF ir pārāk liels." },
      { status: 413 },
    );
  }

  const mime = (file.type || "").trim().toLowerCase();
  const name = file.name.trim() || "PROVIN_BUSINESS.pdf";
  if (mime !== "application/pdf" && !name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "unsupported_file_type", message: "Atļauts tikai PDF." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    const stored = await persistClientReportFromNotify(sessionId, [
      { filename: name, content: bytes, contentType: "application/pdf" },
    ]);
    if (!stored) {
      return NextResponse.json(
        { error: "persist_failed", message: "Neizdevās saglabāt PDF partnera arhīvā." },
        { status: 500 },
      );
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Nezināma kļūda";
    console.error("[api/admin/partner-client-report]", e);
    return NextResponse.json({ error: "persist_failed", message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, filename: name });
}
