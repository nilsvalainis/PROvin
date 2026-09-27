import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { setAuditDeadlineComplete } from "@/lib/admin-audit-complete-store";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { enqueueDealerDataJob } from "@/lib/dealer-data-job";
import { isOrderUpsellKind, quoteOrderUpsell } from "@/lib/order-upsell";
import {
  openUpsellOffer,
  readSessionUpsellDoc,
  settleUpsellOffer,
  toOfferSnapshot,
} from "@/lib/order-upsell-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Rēķins ārpus saites: tā pati summa, produkts, neizpildīts, jaunas 48 h. E-pastu nesūta. */
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
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const order = await getCheckoutSessionDetail(sessionId);
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const doc = await readSessionUpsellDoc(sessionId);
  const offers = doc
    ? Object.values(doc.offers)
        .filter((o): o is NonNullable<typeof o> => Boolean(o))
        .map(toOfferSnapshot)
    : [];
  const existing = doc?.offers[kindRaw];
  if (!existing) {
    const quote = quoteOrderUpsell(
      kindRaw,
      { checkoutLine: order.checkoutLine, amountTotalCents: order.amountTotal },
      offers,
    );
    if (!quote) return NextResponse.json({ error: "not_available" }, { status: 400 });
    const opened = await openUpsellOffer(sessionId, quote);
    if (!opened.ok) return NextResponse.json({ error: opened.error }, { status: 503 });
  } else if (existing.status === "paid" || existing.status === "manual") {
    return NextResponse.json({ error: "already_settled" }, { status: 409 });
  }

  const settled = await settleUpsellOffer({ sessionId, kind: kindRaw, status: "manual" });
  if (!settled.ok) return NextResponse.json({ error: settled.error }, { status: 409 });
  const cleared = await setAuditDeadlineComplete(sessionId, false);
  if (!cleared.ok) return NextResponse.json({ error: cleared.error }, { status: 503 });
  if (kindRaw === "mini_to_dealer" && order.vin) {
    await enqueueDealerDataJob({ sessionId, vin: order.vin }).catch((err) => {
      console.error("[order-upsell] dealer enqueue failed", err);
    });
  }
  return NextResponse.json({ ok: true });
}
