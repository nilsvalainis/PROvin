/**
 * Stripe apmaksas saite esošam `manual_order_*`.
 * Jauna pasūtījuma rinda netiek veidota.
 */
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { extractCsddMakeModelFromWorkspace } from "@/lib/admin-csdd-make-model";
import {
  getManualOrder,
  isManualOrderId,
  isPartnerCreditManualOrder,
} from "@/lib/admin-manual-orders";
import { isSafeOrderDraftSessionId, readOrderDraft } from "@/lib/admin-order-draft-store";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { normalizeWhatsAppPhoneDigits } from "@/lib/admin-whatsapp-phone";
import {
  buildManualOrderPaymentDraft,
  isManualOrderStripePaid,
  parseManualOrderPaymentInput,
  suggestManualOrderServiceName,
} from "@/lib/manual-order-payment";
import { ensureManualOrderStripePaymentUrl } from "@/lib/manual-order-checkout";
import { isValidOrderEmail } from "@/lib/order-field-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadContext(sessionId: string) {
  if (!isManualOrderId(sessionId) || !isSafeOrderDraftSessionId(sessionId)) return null;
  const record = await getManualOrder(sessionId);
  if (!record) return null;
  const order = await getCheckoutSessionDetail(sessionId);
  const draft = await readOrderDraft(sessionId);
  const email =
    [draft?.orderEdits?.customerEmail, order?.customerEmail, order?.customerDetailsEmail].find(
      (v) => v && isValidOrderEmail(v),
    ) ?? "";
  const phone =
    normalizeWhatsAppPhoneDigits(
      draft?.orderEdits?.customerPhone || order?.phone || order?.customerDetailsPhone || "",
    ) ?? "";
  const customerName =
    [draft?.orderEdits?.customerName, order?.customerName].find((v) => typeof v === "string" && v.trim())?.trim() ??
    "";
  const vin = [draft?.orderEdits?.vin, order?.vin].find((v) => typeof v === "string" && v.trim())?.trim() ?? "";
  const car = extractCsddMakeModelFromWorkspace(draft?.workspace) ?? "";
  return { record, order, email: email.trim(), phone, customerName, vin, car };
}

export async function GET(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sessionId = new URL(req.url).searchParams.get("sessionId")?.trim() ?? "";
  if (!isManualOrderId(sessionId)) {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  }
  const ctx = await loadContext(sessionId);
  if (!ctx) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (isPartnerCreditManualOrder(ctx.record)) {
    return NextResponse.json({ error: "not_available" }, { status: 400 });
  }
  const paid = isManualOrderStripePaid(ctx.record);
  return NextResponse.json({
    email: ctx.email,
    phone: ctx.phone,
    customerName: ctx.customerName,
    vin: ctx.vin,
    car: ctx.car,
    amountCents: ctx.record.amountTotal,
    serviceName: ctx.record.serviceName || suggestManualOrderServiceName({ vin: ctx.vin, car: ctx.car }),
    paid,
    paidAt: ctx.record.paidAt ?? null,
    paidStripeSessionId: ctx.record.paidStripeSessionId ?? null,
    checkoutUrl: !paid ? ctx.record.stripeCheckoutUrl ?? null : null,
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
  if (!isManualOrderId(sessionId)) {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  }
  const parsed = parseManualOrderPaymentInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const ctx = await loadContext(sessionId);
  if (!ctx) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (isPartnerCreditManualOrder(ctx.record)) {
    return NextResponse.json({ error: "not_available" }, { status: 400 });
  }
  if (isManualOrderStripePaid(ctx.record)) {
    return NextResponse.json({ error: "already_paid" }, { status: 409 });
  }
  const emailRaw = String(body.email ?? ctx.email ?? "").trim();
  const email = emailRaw && isValidOrderEmail(emailRaw) ? emailRaw : "";
  const pay = await ensureManualOrderStripePaymentUrl({
    record: ctx.record,
    amountCents: parsed.amountCents,
    serviceName: parsed.serviceName,
    email: email || null,
    vin: ctx.vin || ctx.order?.vin,
    phone: ctx.phone,
  });
  if (!pay.ok) {
    return NextResponse.json({ error: pay.error }, { status: 503 });
  }
  const draft = buildManualOrderPaymentDraft({
    serviceName: parsed.serviceName,
    amountCents: parsed.amountCents,
    url: pay.url,
    customerName: ctx.customerName,
  });
  return NextResponse.json({
    url: pay.url,
    stripeSessionId: pay.stripeSessionId,
    email,
    phone: ctx.phone,
    customerName: ctx.customerName,
    ...draft,
  });
}
