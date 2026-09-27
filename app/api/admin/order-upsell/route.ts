import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { isSafeOrderDraftSessionId, readOrderDraft } from "@/lib/admin-order-draft-store";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { normalizeWhatsAppPhoneDigits } from "@/lib/admin-whatsapp-phone";
import { isValidOrderEmail } from "@/lib/order-field-validation";
import {
  availableUpsellQuotes,
  buildUpsellDraft,
  isOrderUpsellKind,
  quoteOrderUpsell,
  upsellKindButtonLabel,
  upsellListOverlay,
  upsellPublicPath,
} from "@/lib/order-upsell";
import {
  openUpsellOffer,
  readSessionUpsellDoc,
  toOfferSnapshot,
} from "@/lib/order-upsell-store";
import { getPublicSiteOrigin } from "@/lib/site-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadContext(sessionId: string) {
  const order = await getCheckoutSessionDetail(sessionId);
  if (!order) return null;
  const doc = await readSessionUpsellDoc(sessionId);
  const offers = doc
    ? Object.values(doc.offers)
        .filter((o): o is NonNullable<typeof o> => Boolean(o))
        .map(toOfferSnapshot)
    : [];
  const draft = await readOrderDraft(sessionId);
  const email =
    [draft?.orderEdits?.customerEmail, order.customerEmail, order.customerDetailsEmail].find(
      (v) => v && isValidOrderEmail(v),
    ) ?? "";
  const phone =
    normalizeWhatsAppPhoneDigits(
      draft?.orderEdits?.customerPhone || order.phone || order.customerDetailsPhone || "",
    ) ?? "";
  return { order, offers, email: email.trim(), phone };
}

export async function GET(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sessionId = new URL(req.url).searchParams.get("sessionId")?.trim() ?? "";
  if (!isSafeOrderDraftSessionId(sessionId)) {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  }
  const ctx = await loadContext(sessionId);
  if (!ctx) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const snapshot = { checkoutLine: ctx.order.checkoutLine, amountTotalCents: ctx.order.amountTotal };
  const quotes = availableUpsellQuotes(snapshot, ctx.offers);
  const applied = upsellListOverlay(ctx.offers);
  return NextResponse.json({
    email: ctx.email,
    phone: ctx.phone,
    applied,
    available: quotes.map((q) => ({
      ...q,
      label: upsellKindButtonLabel(q),
    })),
  });
}

export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const sessionId = String(body.sessionId ?? "").trim();
  const kindRaw = String(body.kind ?? "").trim();
  if (!isSafeOrderDraftSessionId(sessionId) || !isOrderUpsellKind(kindRaw)) {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  }
  const ctx = await loadContext(sessionId);
  if (!ctx) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const quote = quoteOrderUpsell(
    kindRaw,
    { checkoutLine: ctx.order.checkoutLine, amountTotalCents: ctx.order.amountTotal },
    ctx.offers,
  );
  if (!quote) return NextResponse.json({ error: "not_available" }, { status: 400 });
  const opened = await openUpsellOffer(sessionId, quote);
  if (!opened.ok) {
    return NextResponse.json({ error: opened.error }, { status: opened.error === "already_settled" ? 409 : 503 });
  }
  const url = `${getPublicSiteOrigin()}${upsellPublicPath(opened.offer.token)}`;
  const draft = buildUpsellDraft({
    kind: quote.kind,
    vin: ctx.order.vin,
    url,
    priorCents: quote.priorCents,
    chargeCents: quote.chargeCents,
    targetCents: quote.targetCents,
  });
  return NextResponse.json({
    url,
    email: ctx.email,
    phone: ctx.phone,
    ...draft,
  });
}
