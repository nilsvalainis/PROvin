import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { getInvoiceEmailAttachment } from "@/lib/email/invoice-email-attachment";
import {
  collectAttachmentsFromFormData,
  collectAttachmentsFromJsonBase64,
  MAX_NOTIFY_ATTACHMENTS_BYTES,
  MAX_NOTIFY_FILES,
} from "@/lib/email/notify-attachments-parse";
import { deleteNotifyBlobUrls, fetchNotifyBlobAttachmentsForEmail } from "@/lib/email/notify-blob-attachments-fetch";
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

export const maxDuration = 60;

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
  if (
    code === "invalid_blob_url" ||
    code === "invalid_blob_host" ||
    code === "blob_path_session_mismatch" ||
    code === "invalid_session_id"
  ) {
    return NextResponse.json(
      { error: "invalid_blob_attachment", message: "Nederīga Blob atsauce portfeļa pielikumam." },
      { status: 400 },
    );
  }
  if (code === "blob_fetch_failed") {
    return NextResponse.json(
      { error: "blob_fetch_failed", message: "Neizdevās lejupielādēt portfeļa failu no Blob." },
      { status: 502 },
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
  let jsonBlobAttachments: { url: string; filename?: string }[] | undefined;

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
      if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "invalid_body" }, { status: 400 });
      }
      const b = body as Record<string, unknown>;
      sessionId = typeof b.sessionId === "string" ? b.sessionId.trim() : "";
      bodyCustomerEmail = typeof b.customerEmail === "string" ? b.customerEmail.trim() : "";
      jsonAttachmentsBase64 = b.attachmentsBase64;
      if (Array.isArray(b.blobAttachments) && b.blobAttachments.length > 0) {
        if (b.blobAttachments.length > MAX_NOTIFY_FILES) {
          return NextResponse.json({ error: "too_many_attachments", message: "Pārāk daudz failu." }, { status: 400 });
        }
        const refs: { url: string; filename?: string }[] = [];
        for (const item of b.blobAttachments) {
          if (!item || typeof item !== "object") continue;
          const o = item as Record<string, unknown>;
          const url = typeof o.url === "string" ? o.url.trim() : "";
          if (!url) continue;
          refs.push({
            url,
            ...(typeof o.filename === "string" && o.filename.trim() ? { filename: o.filename.trim() } : {}),
          });
        }
        if (refs.length > 0) jsonBlobAttachments = refs;
      }
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
  if (!order) {
    return NextResponse.json({ error: "not_found", message: "Pasūtījums nav atrasts." }, { status: 404 });
  }
  const orderPaymentStatus = String(order.paymentStatus ?? "").trim().toLowerCase();
  if (orderPaymentStatus !== "paid") {
    return NextResponse.json(
      {
        error: "order_not_paid",
        message: `E-pastu var sūtīt tikai apmaksātam pasūtījumam. Pašreizējais statuss: ${order.paymentStatus ?? "unknown"}.`,
      },
      { status: 400 },
    );
  }

  const draft = await readOrderDraft(sessionId);
  const notifyVin = resolveVinForNotify(order.vin, draft?.orderEdits?.vin);

  let manualAttachments: ReportReadyMailAttachment[] = [];
  const blobRw = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";

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
    } else if (jsonBlobAttachments && jsonBlobAttachments.length > 0) {
      if (!blobRw) {
        return NextResponse.json(
          {
            error: "blob_token_missing",
            message:
              "Portfelis augšupielādēts uz Blob, bet serverī nav BLOB_READ_WRITE_TOKEN — nevar lejupielādēt pielikumus e-pastam.",
          },
          { status: 503 },
        );
      }
      manualAttachments = await fetchNotifyBlobAttachmentsForEmail(sessionId, jsonBlobAttachments, blobRw);
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
  let invoiceAttachError: string | null = null;
  try {
    invoice = await getInvoiceEmailAttachment(sessionId);
  } catch (e) {
    invoiceAttachError = e instanceof Error ? e.message : String(e);
    console.error("[api/admin/notify-report-ready] invoice attachment", e);
  }

  const merged: ReportReadyMailAttachment[] = [...manualAttachments];
  if (invoice) merged.push(invoice);

  if (merged.length === 0) {
    const invoiceHint = invoiceAttachError
      ? `Rēķina PDF kļūda: ${invoiceAttachError}`
      : "Rēķina PDF nav izdevies sagatavot (pārbaudi Stripe sesijas summu un servera logus).";
    return NextResponse.json(
      {
        error: "no_attachments",
        message: `Nav derīgu pielikumu — ${invoiceHint} Pievieno audita PDF (tabula: klienta portfelis; vai pasūtījuma forma „Nosūtīt klientam”).`,
        detail: invoiceAttachError ?? undefined,
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

  const blobUrlsForCleanup =
    jsonBlobAttachments?.map((x) => x.url.trim()).filter(Boolean) ?? [];

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

  if (blobUrlsForCleanup.length > 0 && blobRw) {
    void deleteNotifyBlobUrls(blobUrlsForCleanup, blobRw);
  }

  console.info("[api/admin/notify-report-ready] sent", {
    sessionId,
    sentTo: to,
    sentToSource,
  });

  return NextResponse.json({ ok: true, sentTo: to, sentToSource });
}
