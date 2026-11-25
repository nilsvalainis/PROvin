import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { CLIENT_REPORT_LANGS, type ClientReportLang } from "@/lib/client-report-i18n";
import {
  collectAttachmentsFromFormData,
  collectAttachmentsFromJsonBase64,
  MAX_NOTIFY_ATTACHMENTS_BYTES,
  MAX_NOTIFY_FILES,
} from "@/lib/email/notify-attachments-parse";
import { deleteNotifyBlobUrls, fetchNotifyBlobAttachmentsForEmail } from "@/lib/email/notify-blob-attachments-fetch";
import { isSmtpConfigured, sendReportReadyEmail, type ReportReadyMailAttachment } from "@/lib/email/send-transactional";
import { loadReportEmailExtras } from "@/lib/email/dealer-email-context-server";
import { persistClientReportFromNotify } from "@/lib/partner-client-report-storage";
import { readOrderDraft } from "@/lib/admin-order-draft-store";
import { canNotifyClientOrder } from "@/lib/admin-notify-client-eligibility";
import { isValidOrderEmail, isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { resolveReportReadyProductKind } from "@/lib/email/report-ready-copy";
import { isB2bInternationalClientReport } from "@/lib/b2b-pdf-brand";
import { del, get } from "@vercel/blob";
import { isReportPdfPathname, reportPdfPathPrefix } from "@/lib/report-pdf-constants";
import {
  readClientReportCommentSnapshots,
  readClientReportSends,
  recordClientReportCommentSnapshot,
  recordClientReportSend,
} from "@/lib/client-report-sends";
import { buildClientReportCommentSnapshot } from "@/lib/client-report-comment-snapshot-core";
import { dropboxReportFilename } from "@/lib/client-report-sends-core";
import { getDropboxClient } from "@/lib/dropbox-client";
import { saveFileToProvOrderFolder } from "@/lib/ltab-dropbox";
import { moveOrderDropboxFolderToCategory, saveFileToOrderFolderOrLegacy } from "@/lib/order-dropbox";
import { orderDropboxCategoryFromReportFilename } from "@/lib/order-dropbox-folder";
import { isManualOrderId } from "@/lib/admin-manual-orders";
import { orderCarFromCsdd } from "@/lib/ltab-auto";
import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { setAuditDeadlineComplete } from "@/lib/admin-audit-complete-store";
import { dealerSendRecordFromInput } from "@/lib/order-client-marks";
import { recordDealerSendOnServer } from "@/lib/order-client-marks-store";
import { getB2bPartnerByEmail } from "@/lib/b2b-partner-store";
import {
  evaluateReportRecipient,
  maskEmail,
  parseRecipientBlocklist,
  REPORT_RECIPIENT_BLOCKLIST_ENV,
} from "@/lib/report-recipient-guard";

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

function parseReportLang(raw: unknown): ClientReportLang {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return (CLIENT_REPORT_LANGS as readonly string[]).includes(v) ? (v as ClientReportLang) : "lv";
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
 * – multipart/form-data: sessionId, customerEmail?, reportPdf (optional → PROVIN_AUDITS_<VIN>.pdf vai PROVIN_MINI_<VIN>.pdf), attachment (repeat)
 * Rēķins netiek pievienots — klients to jau saņēma apmaksas apstiprinājumā (PDF saite).
 */
export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") || "";
  let sessionId = "";
  let bodyCustomerEmail = "";
  let includeGoogleReview = false;
  let reportLang: ClientReportLang = "lv";
  let multipartForm: FormData | null = null;
  let jsonAttachmentsBase64: unknown = undefined;
  let jsonBlobAttachments: { url: string; filename?: string }[] | undefined;
  /** "Sūtīt atskaiti" (2. posms): serverī izveidotais PDF (`/api/admin/report-pdf`). */
  let serverPdfPathname = "";
  let markComplete = false;
  let saveDropbox = true;
  /** Admins apzināti apstiprina adresi, kas atšķiras no pasūtījumā saglabātās. */
  let confirmRecipientOverride = false;
  /** Dīlera «Sūtīt klientam» logs: admina rediģēts temats + teksts (PDF tas pats servera ceļš). */
  let customMail: { subject: string; text: string } | null = null;
  /** Dīlera «Sūtīt klientam»: ierakstīt klienta saziņas žurnālā pēc veiksmīgas sūtīšanas. */
  let dealerSendInput: Record<string, unknown> | null = null;

  try {
    if (contentType.includes("multipart/form-data")) {
      multipartForm = await req.formData();
      sessionId = String(multipartForm.get("sessionId") ?? "").trim();
      bodyCustomerEmail = String(multipartForm.get("customerEmail") ?? "").trim();
      includeGoogleReview =
        String(multipartForm.get("includeGoogleReview") ?? "").trim() === "1" ||
        String(multipartForm.get("includeGoogleReview") ?? "").trim() === "true";
      reportLang = parseReportLang(multipartForm.get("lang"));
      confirmRecipientOverride = String(multipartForm.get("confirmRecipientOverride") ?? "").trim() === "true";
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
      includeGoogleReview = b.includeGoogleReview === true || b.includeGoogleReview === "1";
      reportLang = parseReportLang(b.lang);
      jsonAttachmentsBase64 = b.attachmentsBase64;
      serverPdfPathname = typeof b.serverPdfPathname === "string" ? b.serverPdfPathname.trim() : "";
      markComplete = b.markComplete === true;
      saveDropbox = b.saveDropbox !== false;
      confirmRecipientOverride = b.confirmRecipientOverride === true;
      const cs = typeof b.customSubject === "string" ? b.customSubject.trim().slice(0, 180) : "";
      const ct = typeof b.customText === "string" ? b.customText.trim().slice(0, 12_000) : "";
      if (cs && ct) customMail = { subject: cs, text: ct };
      if (b.dealerSend && typeof b.dealerSend === "object") dealerSendInput = b.dealerSend as Record<string, unknown>;
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

  const draft = await readOrderDraft(sessionId);
  const draftCustomerEmail = draft?.orderEdits?.customerEmail?.trim() ?? "";
  const fromOrder = (order.customerEmail ?? order.customerDetailsEmail ?? "").trim();
  /** Saglabātais adresāts: admina melnraksts, citādi Stripe/manuālā pasūtījuma e-pasts. */
  const storedRecipient =
    [draftCustomerEmail, fromOrder].find((v) => v && isValidOrderEmail(v))?.trim() ?? "";

  const requestedRecipient = bodyCustomerEmail.trim();
  let partnerWithRecipientEmail: { id: string } | null = null;
  const recipientForLookup = requestedRecipient || storedRecipient;
  if (recipientForLookup && isValidOrderEmail(recipientForLookup)) {
    try {
      const p = await getB2bPartnerByEmail(recipientForLookup);
      partnerWithRecipientEmail = p ? { id: p.id } : null;
    } catch (e) {
      console.error("[api/admin/notify-report-ready] partner lookup", e instanceof Error ? e.message.slice(0, 200) : e);
    }
  }

  const recipient = evaluateReportRecipient({
    requested: requestedRecipient,
    stored: storedRecipient,
    confirmOverride: confirmRecipientOverride,
    isValidEmail: isValidOrderEmail,
    blocklist: parseRecipientBlocklist(process.env[REPORT_RECIPIENT_BLOCKLIST_ENV]),
    partnerWithRecipientEmail,
    order: { partnerId: order.partnerId, notes: order.notes },
  });
  if (!recipient.ok) {
    // Pagaidu portfeļa Blob faili vairs nav vajadzīgi; servera PDF paliek atkārtotai sūtīšanai.
    const blobRwEarly = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
    const tmpUrls = jsonBlobAttachments?.map((x) => x.url.trim()).filter(Boolean) ?? [];
    if (tmpUrls.length > 0 && blobRwEarly) void deleteNotifyBlobUrls(tmpUrls, blobRwEarly);
    console.warn("[api/admin/notify-report-ready] recipient blocked", { sessionId, error: recipient.error });
    return NextResponse.json(
      {
        error: recipient.error,
        message: recipient.message,
        ...(recipient.stored ? { stored: recipient.stored } : {}),
        ...(recipient.requested ? { requested: recipient.requested } : {}),
      },
      { status: recipient.status },
    );
  }
  const toCandidate = recipient.to;

  if (!canNotifyClientOrder(order, toCandidate)) {
    const orderPaymentStatus = String(order.paymentStatus ?? "").trim().toLowerCase();
    const message =
      orderPaymentStatus === "paid"
        ? "Nepieciešams derīgs klienta e-pasts."
        : order.isManual || sessionId.startsWith("manual_order_")
          ? "Manuālam pasūtījumam nepieciešams derīgs klienta e-pasts."
          : `E-pastu var sūtīt tikai apmaksātam pasūtījumam. Pašreizējais statuss: ${order.paymentStatus ?? "unknown"}.`;
    return NextResponse.json({ error: "order_not_eligible", message }, { status: 400 });
  }

  const notifyVin = resolveVinForNotify(order.vin, draft?.orderEdits?.vin);

  let manualAttachments: ReportReadyMailAttachment[] = [];
  const blobRw = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";

  try {
    if (multipartForm) {
      const { attachments } = await collectAttachmentsFromFormData(multipartForm, {
        auditReportVin: notifyVin || null,
        checkoutLine: order.checkoutLine ?? null,
        amountTotalCents: order.amountTotal ?? null,
        lang: reportLang,
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

  let serverPdf: ReportReadyMailAttachment | null = null;
  if (serverPdfPathname) {
    if (!isReportPdfPathname(sessionId, serverPdfPathname, ".pdf")) {
      return NextResponse.json({ error: "invalid_server_pdf", message: "Nederīgs servera PDF ceļš." }, { status: 400 });
    }
    const res = await get(serverPdfPathname, { access: "private", useCache: false }).catch(() => null);
    if (!res || res.statusCode !== 200 || !res.stream) {
      return NextResponse.json({ error: "server_pdf_not_found", message: "Servera PDF nav atrasts - izveido to vēlreiz." }, { status: 404 });
    }
    serverPdf = {
      filename: serverPdfPathname.slice(reportPdfPathPrefix(sessionId).length).replace(/^\d+-/, ""),
      content: Buffer.from(await new Response(res.stream).arrayBuffer()),
      contentType: "application/pdf",
    };
    // Atskaite vienmēr pirmā; ja tāda paša nosaukuma fails ir arī pielikumos, to neliek divreiz.
    manualAttachments = [serverPdf, ...manualAttachments.filter((a) => a.filename !== serverPdf!.filename)];
  }

  const to = toCandidate;
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

  if (manualAttachments.length === 0) {
    return NextResponse.json(
      {
        error: "no_attachments",
        message:
          "Nav derīgu pielikumu — pievieno audita PDF (tabula: klienta portfelis; vai pasūtījuma forma „Nosūtīt klientam”).",
      },
      { status: 400 },
    );
  }

  if (totalAttachmentBytes(manualAttachments) > MAX_NOTIFY_ATTACHMENTS_BYTES) {
    return NextResponse.json(
      {
        error: "attachments_too_large",
        message: `Pielikumi pārsniedz ${MAX_NOTIFY_ATTACHMENTS_BYTES / (1024 * 1024)} MB — samaziniet failu apjomu.`,
      },
      { status: 413 },
    );
  }

  const blobUrlsForCleanup =
    jsonBlobAttachments?.map((x) => x.url.trim()).filter(Boolean) ?? [];

  const previousSends = serverPdf ? await readClientReportSends(sessionId) : [];

  const reportProductKind = resolveReportReadyProductKind({
    checkoutLine: order.checkoutLine,
    amountTotalCents: order.amountTotal,
  });
  // Kartītes fakti / piemaksas termiņš - tikai, ja sūtīšanas brīdī ir dati (kļūda sūtīšanu neaptur).
  const emailContext = await loadReportEmailExtras({
    sessionId,
    productKind: reportProductKind,
    lang: reportLang,
    text: customMail?.text ?? null,
    draft,
  }).catch(() => null);

  try {
    await sendReportReadyEmail({
      to,
      carVin: notifyVin || "-",
      attachments: manualAttachments,
      productKind: reportProductKind,
      emailContext,
      includeGoogleReview,
      b2bClient: isB2bInternationalClientReport({
        notes: order.notes,
        partnerId: order.partnerId,
        partnerCompanyName: order.companyName,
      }),
      lang: reportLang,
      corrected: previousSends.length > 0,
      custom: customMail,
    });
    try {
      const stored = await persistClientReportFromNotify(sessionId, manualAttachments);
      if (!stored) {
        console.warn("[api/admin/notify-report-ready] client report archive persist skipped", { sessionId });
      }
    } catch (persistErr) {
      console.error("[api/admin/notify-report-ready] client report archive persist:", persistErr);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Nezināma kļūda";
    console.error("[api/admin/notify-report-ready]", e);
    return NextResponse.json({ error: "send_failed", message }, { status: 500 });
  }

  if (blobUrlsForCleanup.length > 0 && blobRw) {
    void deleteNotifyBlobUrls(blobUrlsForCleanup, blobRw);
  }

  let serverSend: { version: number; dropboxPath?: string; dropboxError?: string; completedAt?: string | null } | undefined;
  if (serverPdf) {
    serverSend = { version: previousSends.length + 1 };
    const bytes = new Uint8Array(serverPdf.content);
    let dropboxPath: string | undefined;
    const client = getDropboxClient();
    if (!saveDropbox) {
      serverSend.dropboxError = "izslēgts";
    } else if (!client) {
      serverSend.dropboxError = "Dropbox nav konfigurēts";
    } else {
      try {
        const csdd = mergeSourceBlocksWithDefaults(draft?.workspace?.sourceBlocks ?? {}).csdd;
        const car = orderCarFromCsdd(csdd, "", notifyVin);
        const reportName = dropboxReportFilename(serverSend.version, serverPdf.filename);
        // Manuālais pasūtījums: produkts zināms tikai tagad (PROVIN_BUSINESS_*, OFICIALA_DILERA_DATI_*) -
        // esošo mapi pārvieto uz pareizo virsmapi (AUDITI -> BUSINESS / DILERA DATI), nevis veido jaunu.
        const productCategory = isManualOrderId(sessionId) ? orderDropboxCategoryFromReportFilename(serverPdf.filename) : null;
        if (productCategory) await moveOrderDropboxFolderToCategory(sessionId, productCategory, client).catch(() => null);
        // Jaunie pasūtījumi: tikai sava mape (AUDITI/..., DILERA DATI/...); vecajiem - mape pēc VIN `/_PROv` saknē.
        const saved = await saveFileToOrderFolderOrLegacy(sessionId, reportName, bytes, () =>
          saveFileToProvOrderFolder(client, car, reportName, bytes),
        );
        dropboxPath = saved.path;
        serverSend.dropboxPath = saved.path;
      } catch (e) {
        console.error("[api/admin/notify-report-ready] dropbox", e instanceof Error ? e.message.slice(0, 200) : e);
        serverSend.dropboxError = "PDF neizdevās saglabāt Dropbox";
      }
    }
    try {
      const rec = await recordClientReportSend(
        sessionId,
        {
          sentAt: new Date().toISOString(),
          to,
          filename: serverPdf.filename,
          lang: reportLang,
          bytes: bytes.byteLength,
          ...(dropboxPath ? { dropboxPath } : {}),
          ...(recipient.recipientOverride
            ? { recipientOverride: true, previousRecipientMasked: recipient.previousRecipientMasked ?? "" }
            : {}),
        },
        bytes,
      );
      serverSend.version = rec.version;
    } catch (e) {
      console.error("[api/admin/notify-report-ready] send log", e);
    }
    await del(serverPdfPathname).catch(() => undefined);
    if (markComplete) {
      const done = await setAuditDeadlineComplete(sessionId, true);
      serverSend.completedAt = done.ok ? done.completedAt : null;
    }
  }

  // AI komentāru gala versija pie sūtījuma (apmācībai), neatkarīgi no TRAINING_V2. Kļūda sūtījumu neaptur.
  try {
    const prevSnapshots = await readClientReportCommentSnapshots(sessionId);
    await recordClientReportCommentSnapshot(
      sessionId,
      buildClientReportCommentSnapshot({
        draft,
        sentAt: new Date().toISOString(),
        lang: reportLang,
        corrected: previousSends.length > 0 || prevSnapshots.length > 0,
        ...(serverSend ? { version: serverSend.version } : {}),
      }),
    );
  } catch (e) {
    console.error("[api/admin/notify-report-ready] comment snapshot", e instanceof Error ? e.message.slice(0, 200) : e);
  }

  console.info("[api/admin/notify-report-ready] sent", {
    sessionId,
    sentTo: maskEmail(to),
    sentToSource,
    reportLang,
    ...(recipient.recipientOverride ? { recipientOverride: true } : {}),
  });

  const dealerMarks = dealerSendInput
    ? await recordDealerSendOnServer(
        sessionId,
        dealerSendRecordFromInput(dealerSendInput, "email", new Date().toISOString(), "ready"),
      )
    : null;

  return NextResponse.json({
    ok: true,
    sentTo: to,
    sentToSource,
    ...(serverSend ? { serverSend } : {}),
    ...(dealerMarks ? { dealerMarks } : {}),
  });
}
