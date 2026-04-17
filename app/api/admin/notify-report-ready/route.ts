import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { getInvoiceEmailAttachment } from "@/lib/email/invoice-email-attachment";
import {
  collectAttachmentsFromFormData,
  collectAttachmentsFromJsonBase64,
  MAX_NOTIFY_ATTACHMENTS_BYTES,
} from "@/lib/email/notify-attachments-parse";
import { isSmtpConfigured, sendReportReadyEmail, type ReportReadyMailAttachment } from "@/lib/email/send-transactional";
import { readOrderDraft } from "@/lib/admin-order-draft-store";
import { isValidOrderEmail, isValidVin, normalizeVin } from "@/lib/order-field-validation";

/** Stripe metadata var būt tukšs; VIN bieži ir tikai admina melnrakstā (`orderEdits.vin`). */
function resolveVinForNotify(sessionVin: string | null | undefined, draftVin: string | undefined): string {
  const s = (sessionVin ?? "").trim();
  if (s && isValidVin(s)) return normalizeVin(s);
  const d = (draftVin ?? "").trim();
  if (d && isValidVin(d)) return normalizeVin(d);
  return "";
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function totalAttachmentBytes(list: ReportReadyMailAttachment[]): number {
  return list.reduce((s, a) => s + a.content.length, 0);
}

function mapParseError(e: unknown): NextResponse | null {
  const code = e instanceof Error ? e.message : "";
  if (code === "attachments_too_large") {
    return NextResponse.json(
      {
        error: "attachments_too_large",
        message: `Pielikumu kopējais apjoms pārsniedz ${MAX_NOTIFY_ATTACHMENTS_BYTES / (1024 * 1024)} MB.`,
      },
      { status: 413 },
    );
  }
  if (code === "too_many_attachments") {
    return NextResponse.json({ error: "too_many_attachments", message: "Pārāk daudz failu." }, { status: 400 });
  }
  if (code === "unsupported_file_type") {
    return NextResponse.json(
      { error: "unsupported_file_type", message: "Atļauti tikai PDF un JPEG/PNG/WEBP/GIF." },
      { status: 400 },
    );
  }
  return null;
}

/**
 * Nosūta klientam „audits gatavs” ar pielikumiem (nodemailer + SMTP).
 * – JSON: { sessionId, customerEmail?, attachmentsBase64?: { filename, data, mimeType? }[] }
 * – multipart/form-data: sessionId, customerEmail?, reportPdf (optional → PROVIN_AUDITS_<VIN>.pdf), attachment (repeat)
 * Rēķina PDF tiek pievienots automātiski apmaksātiem pasūtījumiem.
 */
export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") || "";
  let sessionId = "";
  let bodyCustomerEmail = "";
  let multipartForm: FormData | null = null;
  let jsonAttachmentsBase64: unknown = undefined;

  try {
    if (contentType.includes("multipart/form-data")) {
      multipartForm = await req.formData();
      sessionId = String(multipartForm.get("sessionId") ?? "").trim();
      bodyCustomerEmail = String(multipartForm.get("customerEmail") ?? "").trim();
    } else {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: "invalid_json" }, { status: 400 });
      }
      sessionId =
        typeof body === "object" &&
        body !== null &&
        "sessionId" in body &&
        typeof (body as { sessionId: unknown }).sessionId === "string"
          ? (body as { sessionId: string }).sessionId.trim()
          : "";
      bodyCustomerEmail =
        typeof body === "object" &&
        body !== null &&
        "customerEmail" in body &&
        typeof (body as { customerEmail: unknown }).customerEmail === "string"
          ? (body as { customerEmail: string }).customerEmail.trim()
          : "";
      jsonAttachmentsBase64 =
        typeof body === "object" &&
        body !== null &&
        "attachmentsBase64" in body &&
        (body as { attachmentsBase64: unknown }).attachmentsBase64;
    }
  } catch (e) {
    const mapped = mapParseError(e);
    if (mapped) return mapped;
    console.error("[api/admin/notify-report-ready] parse phase1", e);
    return NextResponse.json({ error: "invalid_body", message: "Neizdevās apstrādāt pieprasījumu." }, { status: 400 });
  }

  if (!sessionId) {
    return NextResponse.json({ error: "missing_session_id" }, { status: 400 });
  }

  const order = await getCheckoutSessionDetail(sessionId);
  if (!order || order.paymentStatus !== "paid") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const draft = await readOrderDraft(sessionId);
  const notifyVin = resolveVinForNotify(order.vin, draft?.orderEdits?.vin);

  let manualAttachments: ReportReadyMailAttachment[] = [];

  try {
    if (multipartForm) {
      const { attachments } = await collectAttachmentsFromFormData(multipartForm, {
        auditReportVin: notifyVin || null,
      });
      manualAttachments = attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      }));
    } else {
      const { attachments } = collectAttachmentsFromJsonBase64(jsonAttachmentsBase64);
      manualAttachments = attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      }));
    }
  } catch (e) {
    const mapped = mapParseError(e);
    if (mapped) return mapped;
    console.error("[api/admin/notify-report-ready] parse phase2", e);
    return NextResponse.json({ error: "invalid_body", message: "Neizdevās apstrādāt pielikumus." }, { status: 400 });
  }

  const draftCustomerEmail = draft?.orderEdits?.customerEmail?.trim() ?? "";
  const fromOrder = (order.customerEmail ?? order.customerDetailsEmail ?? "").trim();
  /** 1) multipart/JSON `customerEmail` (admin izvēle šajā sūtījumā) 2) melnraksts 3) Stripe. */
  const to =
    [bodyCustomerEmail, draftCustomerEmail, fromOrder].find((v) => v && isValidOrderEmail(v))?.trim() ?? "";
  if (!to) {
    return NextResponse.json({ error: "no_customer_email" }, { status: 400 });
  }

  const norm = (s: string) => s.trim().toLowerCase();
  const toN = norm(to);
  const sentToSource: "request" | "draft" | "stripe" =
    bodyCustomerEmail && isValidOrderEmail(bodyCustomerEmail) && norm(bodyCustomerEmail) === toN
      ? "request"
      : draftCustomerEmail && isValidOrderEmail(draftCustomerEmail) && norm(draftCustomerEmail) === toN
        ? "draft"
        : "stripe";

  if (!isSmtpConfigured()) {
    return NextResponse.json(
      {
        error: "smtp_not_configured",
        message:
          "SMTP_USER un SMTP_PASS nav iestatīti servera vidē (Vercel → Environment Variables vai lokālais .env.local). Skatīt .env.example — Google Workspace app password.",
      },
      { status: 503 },
    );
  }

  let invoice: ReportReadyMailAttachment | null = null;
  try {
    invoice = await getInvoiceEmailAttachment(sessionId);
  } catch (e) {
    console.error("[api/admin/notify-report-ready] invoice attachment", e);
    invoice = null;
  }

  const merged: ReportReadyMailAttachment[] = [...manualAttachments];
  if (invoice) merged.push(invoice);

  if (merged.length === 0) {
    return NextResponse.json(
      {
        error: "no_attachments",
        message:
          "Nav pievienots neviens derīgs fails un rēķina PDF neizdevās sagatavot. Pievienojiet audita PDF (multipart forma) vai pārbaudiet pasūtījuma / rēķina datus.",
      },
      { status: 400 },
    );
  }

  if (totalAttachmentBytes(merged) > MAX_NOTIFY_ATTACHMENTS_BYTES) {
    return NextResponse.json(
      {
        error: "attachments_too_large",
        message: `Kopā ar rēķinu pielikumi pārsniedz ${MAX_NOTIFY_ATTACHMENTS_BYTES / (1024 * 1024)} MB — samaziniet failu apjomu.`,
      },
      { status: 413 },
    );
  }

  try {
    await sendReportReadyEmail({
      to,
      carVin: notifyVin || "—",
      attachments: merged,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Nezināma kļūda";
    console.error("[api/admin/notify-report-ready]", e);
    return NextResponse.json({ error: "send_failed", message }, { status: 500 });
  }

  console.info("[api/admin/notify-report-ready] sent", {
    sessionId,
    sentTo: to,
    sentToSource,
  });

  return NextResponse.json({ ok: true, sentTo: to, sentToSource });
}
