import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { extractCsddMakeModelFromWorkspace } from "@/lib/admin-csdd-make-model";
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
import { ensureOrderUpsellStripePaymentUrl } from "@/lib/order-upsell-checkout";
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
  const customerName =
    [draft?.orderEdits?.customerName, order.customerName].find((v) => typeof v === "string" && v.trim())?.trim() ??
    "";
  const vin = [draft?.orderEdits?.vin, order.vin].find((v) => typeof v === "string" && v.trim())?.trim() ?? "";
  const car = extractCsddMakeModelFromWorkspace(draft?.workspace) ?? "";
  return { order, offers, email: email.trim(), phone, customerName, vin, car };
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
  let url = `${getPublicSiteOrigin()}${upsellPublicPath(opened.offer.token)}`;
  if (quote.kind === "mini_to_audit") {
    if (!ctx.email) {
      return NextResponse.json({ error: "missing_email" }, { status: 400 });
    }
    const pay = await ensureOrderUpsellStripePaymentUrl({
      parentSessionId: sessionId,
      email: ctx.email,
      vin: ctx.vin || ctx.order.vin,
      phone: ctx.phone,
      offer: opened.offer,
    });
    if (!pay.ok) {
      return NextResponse.json({ error: pay.error }, { status: 503 });
    }
    url = pay.url;
  }
  const draft = buildUpsellDraft({
    kind: quote.kind,
    vin: ctx.vin || ctx.order.vin,
    customerName: ctx.customerName,
    car: ctx.car,
    url,
    priorCents: quote.priorCents,
    chargeCents: quote.chargeCents,
    targetCents: quote.targetCents,
  });
  return NextResponse.json({
    url,
    email: ctx.email,
    phone: ctx.phone,
    customerName: ctx.customerName,
    car: ctx.car,
    ...draft,
  });
}
