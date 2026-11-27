/**
 * Admin: «Izsoļu arhīvs dīlera datu vietā» (Nils 23.11.2026).
 *
 * GET  ?sessionId=            - piedāvājums (bez tokena), kopsavilkums no bloka, bildes izvēlei.
 * GET  ?sessionId=&photo=<id> - piedāvājuma bilžu kopija (admin priekšskatījums / PDF).
 * POST action:
 *   - prepare        {channel, locale, previewIds[], manualSources[]} - nokopē bildes, izplūdina 2,
 *                    izveido izvēles saiti. Klientam NEKO nesūta (sūtīšana - sūtīšanas logā).
 *   - manual_choice  {choice: archive|refund} - klients atbildēja «1/2» WhatsApp/e-pastā.
 *   - mark_refunded  - Nils veica atmaksu (esošais ceļš).
 *   - withdraw       - atsaukt piedāvājumu (saite vairs nedarbojas).
 *   - delete         - dzēst piedāvājumu un bilžu kopijas.
 *   - statuses       {ids[]} - saraksta statusi.
 *   - send_offer     {channel, previewIds[], manualSources[], subject, text, customerEmail} - prepare +
 *                    e-pasts klientam (Nila poga «Sūtīt piedāvājumu»). WhatsApp: tikai prepare (ziņu atver Nils).
 *   - pdf            - sagatavo «Izsoļu arhīvs» PDF (priekšskatījums: GET ?sessionId=&pdf=1).
 *   - send_archive   {channel, subject, text, customerEmail} - TIKAI pēc klienta «Jā» (statuss
 *                    «Izvēlējās arhīvu»): e-pasts ar PDF; WhatsApp - atzīme pēc tam, kad Nils PDF nosūtījis.
 *   - marks          {marks[]} - operatora «Redzams bildē» atzīmes PDF shēmai.
 */
import { after, NextResponse } from "next/server";

import { saveOrderDocumentToDropboxSafe } from "@/lib/order-documents-dropbox";
import { getAdminSession } from "@/lib/admin-auth";
import { canNotifyClientOrder } from "@/lib/admin-notify-client-eligibility";
import { isSafeOrderDraftSessionId, readOrderDraft } from "@/lib/admin-order-draft-store";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { dealerSendRecipientErrorBody, resolveDealerSendRecipient } from "@/lib/dealer-send-recipient";
import {
  auctionArchiveOfferEmailHtml,
  auctionArchiveOfferPlainText,
  auctionArchiveReadyEmailHtml,
} from "@/lib/email/auction-archive-email";
import { trySendAuctionArchiveClientEmail } from "@/lib/email/send-transactional";
import { buildAuctionArchivePdf } from "@/lib/auction-archive-pdf";
import { auctionArchivePdfFilename } from "@/lib/auction-archive-pdf-html";
import { formatIsoDayLv, markAuctionArchiveSent, sanitizeOperatorMarks, type AuctionArchiveOfferDoc } from "@/lib/auction-archive-offer";
import {
  auctionArchiveOfferForAdmin,
  isAuctionArchiveChoice,
  isAuctionArchiveEligible,
  markAuctionArchiveRefunded,
  resolveAuctionArchiveLocale,
  sanitizeManualSources,
  withdrawAuctionArchiveOffer,
  AUCTION_ARCHIVE_STATUS_LV,
  AUCTION_ARCHIVE_STATUS_TONE,
} from "@/lib/auction-archive-offer";
import { collectAuctionArchivePhotoSources } from "@/lib/auction-archive-offer-photos";
import {
  deleteAuctionArchiveOffer,
  readAuctionArchiveOffer,
  readAuctionArchivePdf,
  readAuctionArchivePhoto,
  updateAuctionArchiveOffer,
} from "@/lib/auction-archive-offer-store";
import {
  auctionArchiveSummaryFor,
  loadAuctionArchiveOrderContext,
  prepareAuctionArchiveOffer,
  recordAuctionArchiveChoice,
} from "@/lib/auction-archive-offer-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Bilžu kopēšanai (līdz ~100 bildēm) - zem maxDuration, lai paspētu saglabāt piedāvājumu. */
const PREPARE_BUDGET_MS = 240_000;
const STATUS_MAX_IDS = 200;
const PHOTO_ID_RE = /^ih_ph_[a-f0-9]{24}$/;
const SUBJECT_MAX = 180;
const TEXT_MAX = 12_000;

function previewCaption(doc: AuctionArchiveOfferDoc, i: number): string {
  const p = doc.photos.find((x) => x.id === doc.previewIds[i]);
  if (!p) return "";
  const date = formatIsoDayLv(p.date);
  return [date, /odomet/i.test(p.caption) ? "Odometrs" : ""].filter(Boolean).join(" · ");
}

/** Tas pats saņēmēja noteikums kā dīlera «Sūtīt klientam» (pasūtījuma e-pasts; cits - tikai ar apstiprinājumu). */
async function recipientFor(
  sessionId: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; to: string } | { ok: false; status: number; body: Record<string, unknown> }> {
  const order = await getCheckoutSessionDetail(sessionId);
  if (!order) return { ok: false, status: 404, body: { error: "not_found" } };
  const draft = await readOrderDraft(sessionId);
  const recipient = await resolveDealerSendRecipient({
    logTag: "api/admin/auction-archive-offer",
    sessionId,
    requested: String(body.customerEmail ?? ""),
    confirmOverride: body.confirmRecipientOverride === true,
    draftEmail: draft?.orderEdits?.customerEmail?.trim() ?? "",
    orderEmail: (order.customerEmail ?? order.customerDetailsEmail ?? "").trim(),
    order: { partnerId: order.partnerId, notes: order.notes },
  });
  if (!recipient.ok) return { ok: false, status: recipient.status, body: dealerSendRecipientErrorBody(recipient) };
  if (!canNotifyClientOrder(order, recipient.to)) {
    return { ok: false, status: 400, body: { error: "order_not_eligible", message: "Nepieciešams derīgs klienta e-pasts (un apmaksa, ja nav manuāls)." } };
  }
  return { ok: true, to: recipient.to };
}

function logPdfTimings(b: { photos: number; missingPhotos: number; pdf: Buffer; timings: { photosMs: number; renderMs: number; htmlBytes: number } }) {
  console.info(
    `[admin/auction-archive-offer] pdf photos=${b.photos} missing=${b.missingPhotos} photosMs=${b.timings.photosMs} renderMs=${b.timings.renderMs} htmlMB=${(b.timings.htmlBytes / 1e6).toFixed(1)} pdfMB=${(b.pdf.length / 1e6).toFixed(1)}`,
  );
}

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function GET(req: Request) {
  if (!(await getAdminSession())) return bad("unauthorized", 401);
  const url = new URL(req.url);
  const sessionId = (url.searchParams.get("sessionId") ?? "").trim();
  if (!isSafeOrderDraftSessionId(sessionId)) return bad("invalid_session");

  if (url.searchParams.get("pdf") === "1") {
    const pdf = await readAuctionArchivePdf(sessionId).catch(() => null);
    if (!pdf) return bad("not_found", 404);
    const [doc, ctx] = await Promise.all([
      readAuctionArchiveOffer(sessionId).catch(() => null),
      loadAuctionArchiveOrderContext(sessionId).catch(() => null),
    ]);
    const vin = doc?.summary.vin || ctx?.vin || "VIN";
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${url.searchParams.get("dl") === "1" ? "attachment" : "inline"}; filename="${auctionArchivePdfFilename(vin, ctx?.lang)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  const photo = (url.searchParams.get("photo") ?? "").trim();
  if (photo) {
    if (!PHOTO_ID_RE.test(photo)) return bad("invalid_photo");
    const buf = await readAuctionArchivePhoto(sessionId, photo).catch(() => null);
    if (!buf) return bad("not_found", 404);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=300" },
    });
  }

  const [ctx, doc] = await Promise.all([
    loadAuctionArchiveOrderContext(sessionId).catch(() => null),
    readAuctionArchiveOffer(sessionId).catch(() => null),
  ]);
  if (!ctx) return bad("not_found", 404);
  const summary = auctionArchiveSummaryFor(ctx, doc?.summary.manualSources ?? []);
  const sources = collectAuctionArchivePhotoSources({ vin: ctx.vin, sessionId, block: ctx.block });
  const vinQ = encodeURIComponent(ctx.vin);
  return NextResponse.json({
    offer: doc ? auctionArchiveOfferForAdmin(doc) : null,
    eligible: isAuctionArchiveEligible(summary),
    summary,
    paidCents: ctx.paidCents,
    refunded: ctx.refunded,
    // Bildes izvēlei sūtīšanas logā (2 izplūdinātās): jau saglabātās ar admin sīktēlu.
    photos: sources.slice(0, 500).map((s) => ({
      id: s.id,
      auctionKey: s.auctionKey,
      date: s.date,
      caption: s.caption,
      thumb: s.stored
        ? s.stored.sessionId === sessionId
          ? `/api/admin/cc-vin-photo?sessionId=${encodeURIComponent(sessionId)}&photoId=${s.stored.photoId}`
          : `/api/admin/sources/thecarapi/photo?vin=${vinQ}&photoId=${s.stored.photoId}`
        : null,
    })),
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
  const action = String(body.action ?? "");

  if (action === "statuses") {
    const ids = (Array.isArray(body.ids) ? body.ids : [])
      .filter((v): v is string => typeof v === "string" && isSafeOrderDraftSessionId(v))
      .slice(0, STATUS_MAX_IDS);
    const items = await Promise.all(
      ids.map(async (id) => {
        const doc = await readAuctionArchiveOffer(id).catch(() => null);
        return doc
          ? {
              id,
              status: doc.status,
              label: AUCTION_ARCHIVE_STATUS_LV[doc.status],
              tone: AUCTION_ARCHIVE_STATUS_TONE[doc.status],
              at: doc.choiceAt ?? doc.createdAt,
            }
          : null;
      }),
    );
    return NextResponse.json({ items: items.filter(Boolean) });
  }

  const sessionId = String(body.sessionId ?? "").trim();
  if (!isSafeOrderDraftSessionId(sessionId)) return bad("invalid_session");

  if (action === "send_offer" || action === "send_archive") {
    const channel = body.channel === "whatsapp" ? "whatsapp" : "email";
    const subject = String(body.subject ?? "").trim().slice(0, SUBJECT_MAX);
    const text = String(body.text ?? "").trim().slice(0, TEXT_MAX);
    const showPrices = body.showPrices === true;
    let to = "";
    if (channel === "email") {
      if (!subject || !text) return bad("missing_subject_or_text");
      const rec = await recipientFor(sessionId, body);
      if (!rec.ok) return NextResponse.json(rec.body, { status: rec.status });
      to = rec.to;
    }

    if (action === "send_offer") {
      const previewIds = (Array.isArray(body.previewIds) ? body.previewIds : [])
        .filter((v): v is string => typeof v === "string" && PHOTO_ID_RE.test(v))
        .slice(0, 2);
      const r = await prepareAuctionArchiveOffer({
        sessionId,
        channel,
        // Klienta valoda (sūtīšanas logs) vai pasūtījuma valoda (`resolveOrderClientLang`).
        ...(typeof body.lang === "string" && body.lang.trim() ? { locale: resolveAuctionArchiveLocale(body.lang) } : {}),
        previewIds,
        manualSources: sanitizeManualSources(body.manualSources),
        deadline: startedAt + PREPARE_BUDGET_MS,
        showPrices,
      });
      if (!r.ok) return bad(r.error, r.error === "not_found" ? 404 : r.error === "store_failed" ? 503 : 409);
      if (channel === "whatsapp") {
        return NextResponse.json({ ok: true, choiceUrl: r.choiceUrl, offer: auctionArchiveOfferForAdmin(r.doc) });
      }
      const previews = r.previewUrls.map((u, i) => ({ url: u, caption: previewCaption(r.doc, i) }));
      const sent = await trySendAuctionArchiveClientEmail({
        to,
        subject,
        text: auctionArchiveOfferPlainText(text, r.choiceUrl, r.doc.locale),
        html: auctionArchiveOfferEmailHtml({
          summary: r.doc.summary,
          paidCents: r.doc.paidCents,
          text,
          choiceUrl: r.choiceUrl,
          previews,
          showPrices,
          lang: r.doc.locale,
        }),
      });
      if (!sent) {
        // Klients neko nesaņēma - saite nedrīkst palikt «Gaida klienta izvēli».
        await updateAuctionArchiveOffer(sessionId, (cur) => (cur ? { next: withdrawAuctionArchiveOffer(cur), result: null } : { result: null })).catch(
          () => null,
        );
        return bad("email_failed", 502);
      }
      // Atgādinājumam - tas pats saņēmējs, uz kuru aizgāja piedāvājums.
      const saved = await updateAuctionArchiveOffer(sessionId, (c) =>
        c && c.status === "pending" ? { next: { ...c, sentTo: to }, result: { ...c, sentTo: to } } : { result: c },
      ).catch(() => null);
      return NextResponse.json({ ok: true, to, offer: auctionArchiveOfferForAdmin(saved ?? r.doc) });
    }

    // send_archive: TIKAI pēc klienta «Jā».
    const cur = await readAuctionArchiveOffer(sessionId);
    if (!cur) return bad("not_found", 404);
    if (cur.status !== "chose_archive") return bad(cur.status === "archive_sent" ? "already_sent" : "not_chosen", 409);
    if (channel === "email") {
      let built: Awaited<ReturnType<typeof buildAuctionArchivePdf>>;
      try {
        built = await buildAuctionArchivePdf(sessionId, { showPrices });
        logPdfTimings(built);
      } catch (e) {
        console.error("[admin/auction-archive-offer] pdf", e instanceof Error ? e.message.slice(0, 160) : "error");
        return bad("pdf_failed", 500);
      }
      const sent = await trySendAuctionArchiveClientEmail({
        to,
        subject,
        text,
        html: auctionArchiveReadyEmailHtml({
          summary: cur.summary,
          text,
          attachment: { filename: built.filename, bytes: built.pdf.length },
          lang: cur.locale,
        }),
        attachments: [{ filename: built.filename, content: built.pdf, contentType: "application/pdf" }],
      });
      if (!sent) return bad("email_failed", 502);
      const pdfCopy = new Uint8Array(built.pdf);
      const pdfName = built.filename;
      after(() => saveOrderDocumentToDropboxSafe(sessionId, pdfName, pdfCopy));
    } else if (!(await readAuctionArchivePdf(sessionId).catch(() => null))) {
      return bad("pdf_missing", 409);
    }
    try {
      const doc = await updateAuctionArchiveOffer(sessionId, (c) =>
        c && c.status === "chose_archive" ? { next: markAuctionArchiveSent(c), result: markAuctionArchiveSent(c) } : { result: c },
      );
      return NextResponse.json({ ok: true, to: to || null, offer: doc ? auctionArchiveOfferForAdmin(doc) : null });
    } catch {
      return bad("store_failed", 503);
    }
  }

  if (action === "pdf") {
    const cur = await readAuctionArchiveOffer(sessionId);
    if (!cur) return bad("not_found", 404);
    const showPrices = typeof body.showPrices === "boolean" ? body.showPrices : cur.showPrices === true;
    try {
      const built = await buildAuctionArchivePdf(sessionId, { showPrices });
      logPdfTimings(built);
      if (showPrices !== (cur.showPrices === true)) {
        await updateAuctionArchiveOffer(sessionId, (c) => {
          if (!c) return { result: null };
          const { showPrices: _old, ...rest } = c;
          void _old;
          const next = showPrices ? { ...rest, showPrices: true } : rest;
          return { next, result: null };
        }).catch(() => null);
      }
      return NextResponse.json({
        ok: true,
        bytes: built.pdf.length,
        photos: built.photos,
        missingPhotos: built.missingPhotos,
        url: `/api/admin/auction-archive-offer?sessionId=${encodeURIComponent(sessionId)}&pdf=1`,
      });
    } catch (e) {
      console.error("[admin/auction-archive-offer] pdf", e instanceof Error ? e.message.slice(0, 160) : "error");
      return bad("pdf_failed", 500);
    }
  }

  if (action === "marks") {
    const marks = sanitizeOperatorMarks(body.marks);
    try {
      const doc = await updateAuctionArchiveOffer(sessionId, (c) => (c ? { next: { ...c, marks }, result: { ...c, marks } } : { result: null }));
      if (!doc) return bad("not_found", 404);
      return NextResponse.json({ ok: true, offer: auctionArchiveOfferForAdmin(doc) });
    } catch {
      return bad("store_failed", 503);
    }
  }

  if (action === "prepare") {
    const channel = body.channel === "whatsapp" ? "whatsapp" : "email";
    const previewIds = (Array.isArray(body.previewIds) ? body.previewIds : [])
      .filter((v): v is string => typeof v === "string" && PHOTO_ID_RE.test(v))
      .slice(0, 2);
    const r = await prepareAuctionArchiveOffer({
      sessionId,
      channel,
      locale: resolveAuctionArchiveLocale(typeof body.locale === "string" ? body.locale : "lv"),
      previewIds,
      manualSources: sanitizeManualSources(body.manualSources),
      deadline: startedAt + PREPARE_BUDGET_MS,
    });
    if (!r.ok) return bad(r.error, r.error === "not_found" ? 404 : r.error === "store_failed" ? 503 : 409);
    return NextResponse.json({
      ok: true,
      choiceUrl: r.choiceUrl,
      previewUrls: r.previewUrls,
      offer: auctionArchiveOfferForAdmin(r.doc),
    });
  }

  if (action === "manual_choice") {
    if (!isAuctionArchiveChoice(body.choice)) return bad("invalid_choice");
    const r = await recordAuctionArchiveChoice({ sessionId, choice: body.choice, via: "manual" });
    if (!r.ok) return bad(r.error, r.error === "not_found" ? 404 : r.error === "store_failed" ? 503 : 409);
    return NextResponse.json({ ok: true, offer: auctionArchiveOfferForAdmin(r.doc) });
  }

  if (action === "mark_refunded" || action === "withdraw") {
    try {
      const doc = await updateAuctionArchiveOffer(sessionId, (cur) => {
        if (!cur) return { result: null };
        if (cur.status === "archive_sent" || cur.status === "refunded" || cur.status === "withdrawn") {
          return { result: cur };
        }
        const next = action === "withdraw" ? withdrawAuctionArchiveOffer(cur) : markAuctionArchiveRefunded(cur);
        return { next, result: next };
      });
      if (!doc) return bad("not_found", 404);
      return NextResponse.json({ ok: true, offer: auctionArchiveOfferForAdmin(doc) });
    } catch {
      return bad("store_failed", 503);
    }
  }

  if (action === "delete") {
    await deleteAuctionArchiveOffer(sessionId);
    return NextResponse.json({ ok: true, offer: null });
  }

  return bad("invalid_action");
}
