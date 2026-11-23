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
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
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

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function GET(req: Request) {
  if (!(await getAdminSession())) return bad("unauthorized", 401);
  const url = new URL(req.url);
  const sessionId = (url.searchParams.get("sessionId") ?? "").trim();
  if (!isSafeOrderDraftSessionId(sessionId)) return bad("invalid_session");

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
