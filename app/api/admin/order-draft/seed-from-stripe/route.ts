import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import {
  isOrderDraftStoreEnabled,
  patchOrderDraft,
  readOrderDraft,
} from "@/lib/admin-order-draft-store";
import type { OrderDraftOrderEdits } from "@/lib/admin-order-draft-types";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";

export const runtime = "nodejs";

/**
 * Aizpilda **tukšos** `orderEdits` laukus melnrakstā no Stripe Checkout sesijas (metadata + klients).
 * Neatjauno avotu blokus / portfeli — tikai to, kas ir Stripe.
 */
export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const sessionId =
    typeof body === "object" &&
    body !== null &&
    "sessionId" in body &&
    typeof (body as { sessionId: unknown }).sessionId === "string"
      ? (body as { sessionId: string }).sessionId.trim()
      : "";
  if (!sessionId) {
    return NextResponse.json({ error: "missing_sessionId" }, { status: 400 });
  }

  const order = await getCheckoutSessionDetail(sessionId);
  if (!order || order.paymentStatus !== "paid") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const prev = await readOrderDraft(sessionId);
  const prevEdits = prev?.orderEdits ?? {};
  const orderEdits: OrderDraftOrderEdits = {};

  const prevTrim = (k: keyof OrderDraftOrderEdits) =>
    typeof prevEdits[k] === "string" ? (prevEdits[k] as string).trim() : "";

  if (!prevTrim("vin") && order.vin?.trim() && isValidVin(order.vin)) {
    orderEdits.vin = normalizeVin(order.vin);
  }
  if (!prevTrim("listingUrl") && order.listingUrl?.trim()) {
    orderEdits.listingUrl = order.listingUrl.trim();
  }
  if (!prevTrim("customerName") && order.customerName?.trim()) {
    orderEdits.customerName = order.customerName.trim();
  }
  const stripeEmail = (order.customerEmail ?? order.customerDetailsEmail ?? "").trim();
  if (!prevTrim("customerEmail") && stripeEmail) {
    orderEdits.customerEmail = stripeEmail;
  }
  const stripePhone = (order.phone ?? order.customerDetailsPhone ?? "").trim();
  if (!prevTrim("customerPhone") && stripePhone) {
    orderEdits.customerPhone = stripePhone;
  }
  if (!prevTrim("contactMethod") && order.contactMethod?.trim()) {
    orderEdits.contactMethod = order.contactMethod.trim();
  }
  if (!prevTrim("notes") && order.notes?.trim()) {
    orderEdits.notes = order.notes.trim();
  }

  const filledKeys = Object.keys(orderEdits) as (keyof OrderDraftOrderEdits)[];

  if (filledKeys.length === 0) {
    return NextResponse.json({
      ok: true,
      filled: [],
      message: "Stripe neatrod papildu datus tukšajiem laukiem (vai melnraksts jau pilns).",
      persistedServer: isOrderDraftStoreEnabled(),
    });
  }

  const persisted = isOrderDraftStoreEnabled();
  if (persisted) {
    const result = await patchOrderDraft(sessionId, { orderEdits: orderEdits });
    if (!result.ok) {
      if (result.error === "store_disabled") {
        return NextResponse.json({ error: "store_disabled" }, { status: 503 });
      }
      return NextResponse.json({ error: result.error }, { status: result.error === "not_found" ? 404 : 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    filled: filledKeys,
    orderEdits,
    persistedServer: persisted,
  });
}
