/**
 * Nosūta dīlera PDF klientam no oficiālā dīlera bloka (vienas pogas plūsma).
 * PDF ģenerē operators (Drukāt → saglabāt), tad šeit pievieno un nosūta ar rediģējamu tekstu.
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { isSafeOrderDraftSessionId, readOrderDraft } from "@/lib/admin-order-draft-store";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { canNotifyClientOrder } from "@/lib/admin-notify-client-eligibility";
import { buildProvinDilerisPdfFilename } from "@/lib/audit-report-pdf-filename";
import { trySendDealerDataOperatorEmail, type ReportReadyMailAttachment } from "@/lib/email/send-transactional";
import { isValidOrderEmail, isValidVin, normalizeVin } from "@/lib/order-field-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SUBJECT_MAX = 180;
const TEXT_MAX = 12_000;
const PDF_MAX_BYTES = 18 * 1024 * 1024;

export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }

  const sessionId = String(form.get("sessionId") ?? "").trim();
  if (!isSafeOrderDraftSessionId(sessionId)) {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  }

  const subject = String(form.get("subject") ?? "").trim().slice(0, SUBJECT_MAX);
  const text = String(form.get("text") ?? "").trim().slice(0, TEXT_MAX);
  if (!subject || !text) {
    return NextResponse.json({ error: "missing_subject_or_text" }, { status: 400 });
  }

  const pdfEntry = form.get("reportPdf");
  if (!(pdfEntry instanceof File) || pdfEntry.size <= 0) {
    return NextResponse.json({ error: "missing_pdf" }, { status: 400 });
  }
  if (pdfEntry.size > PDF_MAX_BYTES) {
    return NextResponse.json({ error: "pdf_too_large" }, { status: 413 });
  }
  const mime = (pdfEntry.type || "").trim().toLowerCase();
  if (mime && mime !== "application/pdf") {
    return NextResponse.json({ error: "unsupported_file_type" }, { status: 400 });
  }

  const order = await getCheckoutSessionDetail(sessionId);
  if (!order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const draft = await readOrderDraft(sessionId);
  const draftEmail = draft?.orderEdits?.customerEmail?.trim() ?? "";
  const fromOrder = (order.customerEmail ?? order.customerDetailsEmail ?? "").trim();
  const bodyEmail = String(form.get("customerEmail") ?? "").trim();
  const to =
    [bodyEmail, draftEmail, fromOrder].find((v) => v && isValidOrderEmail(v))?.trim() ?? "";

  if (!canNotifyClientOrder(order, to)) {
    return NextResponse.json(
      { error: "order_not_eligible", message: "Nepieciešams derīgs klienta e-pasts (un apmaksa, ja nav manuāls)." },
      { status: 400 },
    );
  }

  const draftVin = draft?.orderEdits?.vin?.trim() ?? "";
  const vinRaw = (order.vin ?? "").trim() || draftVin;
  const vin = vinRaw && isValidVin(vinRaw) ? normalizeVin(vinRaw) : "";
  const filename = buildProvinDilerisPdfFilename(vin || null);

  const buf = Buffer.from(await pdfEntry.arrayBuffer());
  const attachments: ReportReadyMailAttachment[] = [
    { filename, content: buf, contentType: "application/pdf" },
  ];

  const emailSent = await trySendDealerDataOperatorEmail({ to, subject, text, attachments });
  if (!emailSent) {
    return NextResponse.json({ error: "email_failed", to }, { status: 502 });
  }
  return NextResponse.json({ ok: true, emailSent: true, to, filename });
}
