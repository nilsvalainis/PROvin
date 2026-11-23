/**
 * Admin: «Izsoļu arhīvs» kā ATSEVIŠĶS PDF/pakalpojums jebkuram pasūtījumam (Nils 23.11, 3. punkts).
 * Papildus piedāvājumam «dīlera datu vietā» (`/api/admin/auction-archive-offer`), kas paliek kā ir.
 *
 * GET  ?sessionId=  - stāvoklis: kopsavilkums, pēdējais PDF, sūtījumu žurnāls.
 * POST action:
 *   - pdf   {showPrices} - nokopē bildes (ja vēl nav) un ģenerē servera PDF (Chromium, tas pats ceļš kā
 *                          dīlera PDF). Skatīt: GET /api/admin/auction-archive-offer?sessionId=&pdf=1.
 *   - send  {channel, situation, subject, text, customerEmail, offer, review, showPrices} - «Sūtīt klientam»
 *           (tie paši 3 gadījumi kā dīlera datiem). E-pasts: «Arhīvs gatavs» ar PDF pielikumā
 *           «IZSOLU_ARHIVS_<VIN>.pdf»; WhatsApp - tikai žurnāla ieraksts (ziņu un PDF sūta Nils).
 * Klientam šeit sūta TIKAI pēc Nila pogas «Sūtīt e-pastu».
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { canNotifyClientOrder } from "@/lib/admin-notify-client-eligibility";
import { isSafeOrderDraftSessionId, readOrderDraft } from "@/lib/admin-order-draft-store";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { isAuctionArchiveEligible } from "@/lib/auction-archive-offer";
import {
  appendAuctionArchiveReportSend,
  auctionArchiveReportPdfFilename,
  auctionArchiveReportStatusLine,
  isAuctionArchiveSendSituation,
} from "@/lib/auction-archive-report";
import { auctionArchiveSummaryFor, loadAuctionArchiveOrderContext } from "@/lib/auction-archive-offer-service";
import { readAuctionArchivePdf, readAuctionArchiveReport, updateAuctionArchiveReport } from "@/lib/auction-archive-offer-store";
import { buildAuctionArchivePdf } from "@/lib/auction-archive-pdf";
import { parsePartnerCompanyFromNotes, parsePartnerIdFromNotes } from "@/lib/b2b-partner-orders";
import { isB2bDealerReadyEmailOrder } from "@/lib/dealer-data-client-email";
import { dealerSendRecipientErrorBody, resolveDealerSendRecipient } from "@/lib/dealer-send-recipient";
import { trySendDealerDataOperatorEmail } from "@/lib/email/send-transactional";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Bilžu kopēšana (līdz ~100) + renderis zem maxDuration. */
const PHOTO_BUDGET_MS = 200_000;
const SUBJECT_MAX = 180;
const TEXT_MAX = 12_000;

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function pdfUrl(sessionId: string): string {
  return `/api/admin/auction-archive-offer?sessionId=${encodeURIComponent(sessionId)}&pdf=1`;
}

function pdfErrorCode(e: unknown): string {
  const m = e instanceof Error ? e.message : "";
  return m === "no_archive_data" || m === "no_vin" || m === "not_found" ? m : "pdf_failed";
}

async function buildAndRecord(sessionId: string, showPrices: boolean, startedAt: number) {
  const built = await buildAuctionArchivePdf(sessionId, { showPrices, requireOffer: false, deadline: startedAt + PHOTO_BUDGET_MS });
  console.info(
    `[admin/auction-archive-report] pdf photos=${built.photos} missing=${built.missingPhotos} photosMs=${built.timings.photosMs} renderMs=${built.timings.renderMs} htmlMB=${(built.timings.htmlBytes / 1e6).toFixed(1)} pdfMB=${(built.pdf.length / 1e6).toFixed(1)}`,
  );
  const report = await updateAuctionArchiveReport(sessionId, (cur) => {
    const next = { ...cur, generatedAt: new Date().toISOString(), pdfBytes: built.pdf.length, photos: built.photos, missingPhotos: built.missingPhotos };
    if (showPrices) next.showPrices = true;
    else delete next.showPrices;
    return next;
  }).catch(() => null);
  return { built, report };
}

export async function GET(req: Request) {
  if (!(await getAdminSession())) return bad("unauthorized", 401);
  const sessionId = (new URL(req.url).searchParams.get("sessionId") ?? "").trim();
  if (!isSafeOrderDraftSessionId(sessionId)) return bad("invalid_session");
  const [ctx, report, pdf] = await Promise.all([
    loadAuctionArchiveOrderContext(sessionId).catch(() => null),
    readAuctionArchiveReport(sessionId),
    readAuctionArchivePdf(sessionId).catch(() => null),
  ]);
  if (!ctx) return bad("not_found", 404);
  const summary = auctionArchiveSummaryFor(ctx);
  return NextResponse.json({
    vin: ctx.vin,
    summary,
    eligible: isAuctionArchiveEligible(summary),
    report,
    statusLine: auctionArchiveReportStatusLine(report),
    pdfUrl: pdf ? pdfUrl(sessionId) : null,
    filename: auctionArchiveReportPdfFilename(ctx.vin),
  });
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  if (!(await getAdminSession())) return bad("unauthorized", 401);
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return bad("invalid_json");
  }
  const sessionId = String(body.sessionId ?? "").trim();
  if (!isSafeOrderDraftSessionId(sessionId)) return bad("invalid_session");
  const showPrices = body.showPrices === true;
  const action = String(body.action ?? "");

  if (action === "pdf") {
    try {
      const { built, report } = await buildAndRecord(sessionId, showPrices, startedAt);
      return NextResponse.json({
        ok: true,
        url: pdfUrl(sessionId),
        bytes: built.pdf.length,
        photos: built.photos,
        missingPhotos: built.missingPhotos,
        report,
      });
    } catch (e) {
      const code = pdfErrorCode(e);
      if (code === "pdf_failed") console.error("[admin/auction-archive-report] pdf", e instanceof Error ? e.message.slice(0, 160) : "error");
      return bad(code, code === "not_found" ? 404 : code === "pdf_failed" ? 500 : 409);
    }
  }

  if (action !== "send") return bad("invalid_action");

  const channel = body.channel === "whatsapp" ? "whatsapp" : "email";
  const situation = isAuctionArchiveSendSituation(body.situation) ? body.situation : "ready";
  const ready = situation === "ready";
  const offer = ready && body.offer === true;
  const review = ready && body.review === true;
  let to: string | null = null;

  if (channel === "email") {
    const subject = String(body.subject ?? "").trim().slice(0, SUBJECT_MAX);
    const text = String(body.text ?? "").trim().slice(0, TEXT_MAX);
    if (!subject || !text) return bad("missing_subject_or_text");
    const order = await getCheckoutSessionDetail(sessionId);
    if (!order) return bad("not_found", 404);
    const draft = await readOrderDraft(sessionId);
    const recipient = await resolveDealerSendRecipient({
      logTag: "api/admin/auction-archive-report",
      sessionId,
      requested: String(body.customerEmail ?? ""),
      confirmOverride: body.confirmRecipientOverride === true,
      draftEmail: draft?.orderEdits?.customerEmail?.trim() ?? "",
      orderEmail: (order.customerEmail ?? order.customerDetailsEmail ?? "").trim(),
      order: { partnerId: order.partnerId, notes: order.notes },
    });
    if (!recipient.ok) return NextResponse.json(dealerSendRecipientErrorBody(recipient), { status: recipient.status });
    if (!canNotifyClientOrder(order, recipient.to)) {
      return NextResponse.json(
        { error: "order_not_eligible", message: "Nepieciešams derīgs klienta e-pasts (un apmaksa, ja nav manuāls)." },
        { status: 400 },
      );
    }
    to = recipient.to;

    const ctx = await loadAuctionArchiveOrderContext(sessionId).catch(() => null);
    const vin = ctx?.vin ?? "";
    let attachment: { filename: string; content: Buffer } | null = null;
    if (ready) {
      // Tas pats PDF, ko Nils skatīja (ja ģenerēts ar to pašu cenu izvēli); citādi - jauns.
      const report = await readAuctionArchiveReport(sessionId);
      let pdf = report.generatedAt && (report.showPrices === true) === showPrices ? await readAuctionArchivePdf(sessionId).catch(() => null) : null;
      if (!pdf) {
        try {
          pdf = (await buildAndRecord(sessionId, showPrices, startedAt)).built.pdf;
        } catch (e) {
          const code = pdfErrorCode(e);
          return bad(code, code === "pdf_failed" ? 500 : 409);
        }
      }
      attachment = { filename: auctionArchiveReportPdfFilename(vin), content: pdf };
    }
    const notes = draft?.orderEdits?.notes || order.notes || "";
    const b2bClient = isB2bDealerReadyEmailOrder({
      notes,
      partnerId: order.partnerId || parsePartnerIdFromNotes(notes),
      partnerCompanyName: parsePartnerCompanyFromNotes(notes) || order.companyName,
    });
    const sent = await trySendDealerDataOperatorEmail({
      to,
      subject,
      text,
      b2bClient,
      lang: "lv",
      ...(attachment ? { attachments: [{ filename: attachment.filename, content: attachment.content, contentType: "application/pdf" }] } : {}),
      context: {
        situation,
        productKind: "auction_archive",
        vin: vin || null,
        car: ctx?.title || null,
        ...(attachment ? { attachments: [{ filename: attachment.filename, bytes: attachment.content.length }] } : {}),
      },
    });
    if (!sent) return bad("email_failed", 502);
  }

  const report = await updateAuctionArchiveReport(sessionId, (cur) =>
    appendAuctionArchiveReportSend(cur, { at: new Date().toISOString(), channel, situation, offer, review }),
  ).catch(() => null);
  return NextResponse.json({
    ok: true,
    to,
    report,
    statusLine: auctionArchiveReportStatusLine(report),
  });
}
