import { NextResponse } from "next/server";
import {
  irissOfferLinkRequestIsSameOrigin,
  isSafeIrissOfferLinkToken,
  type IrissOfferLinkAction,
} from "@/lib/iriss-offer-client-link";
import { hashIrissOfferLinkToken } from "@/lib/iriss-offer-client-link-token";
import { openUsableIrissOfferLink } from "@/lib/iriss-offer-client-link-load";
import { recordIrissOfferDecisionSummary, respondIrissOfferClientLink } from "@/lib/iriss-offer-client-link-store";
import { runIrissOfferDecisionEffects } from "@/lib/iriss-offer-decision-effects";
import { irissOfferNotifyFacts, notifyIrissOfferQuestion } from "@/lib/iriss-offer-notify";
import { readIrissPasutijums } from "@/lib/iriss-pasutijumi-store";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIpFromRequest } from "@/lib/client-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(req: Request): string {
  return getClientIpFromRequest(req);
}

function hidden() {
  return NextResponse.json(
    { ok: false },
    { status: 404, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } },
  );
}

export async function POST(req: Request) {
  if (!irissOfferLinkRequestIsSameOrigin(req)) return hidden();
  const ipRl = await checkRateLimit(`iriss-offer-respond:${clientIp(req)}`, 20, 10 * 60 * 1000);
  if (!ipRl.ok) return hidden();
  let body: { token?: unknown; action?: unknown; text?: unknown };
  try {
    body = (await req.json()) as { token?: unknown; action?: unknown; text?: unknown };
  } catch {
    return hidden();
  }
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const action = body.action;
  if (!isSafeIrissOfferLinkToken(token)) return hidden();
  if (action !== "approve" && action !== "decline" && action !== "question") return hidden();
  const hashRl = await checkRateLimit(`iriss-offer-respond-hash:${hashIrissOfferLinkToken(token).slice(0, 16)}`, 12, 10 * 60 * 1000);
  if (!hashRl.ok) return hidden();
  const opened = await openUsableIrissOfferLink(token);
  if (!opened) return hidden();
  const result = await respondIrissOfferClientLink(
    opened.link.tokenHash,
    action as IrissOfferLinkAction,
    typeof body.text === "string" ? body.text : "",
    Date.now(),
    { deadlineAt: opened.offer.validUntilAt ?? "" },
  );
  if (!result.ok && result.error === "expired") {
    return NextResponse.json(
      { ok: false, error: "expired" },
      { status: 410, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } },
    );
  }
  if (!result.ok && result.error === "question") {
    return NextResponse.json(
      { ok: false },
      { status: 400, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } },
    );
  }
  if (!result.ok) return hidden();
  if (action === "question" && result.record.question) {
    try {
      const order = await readIrissPasutijums(opened.link.orderId);
      const offer = order?.offers.find((item) => item.id === opened.link.offerId);
      if (order && offer) {
        await notifyIrissOfferQuestion(irissOfferNotifyFacts(order, offer), result.record.question);
      }
    } catch (e) {
      console.error("[iriss-offer-link] question notify", e instanceof Error ? e.message : e);
    }
  }
  if (result.won && (result.record.decision === "approve" || result.record.decision === "decline")) {
    await recordIrissOfferDecisionSummary(result.record, opened.offer.validUntilAt ?? "");
    await runIrissOfferDecisionEffects({
      orderId: opened.link.orderId,
      offerId: opened.link.offerId,
      decision: result.record.decision,
      decidedAt: result.record.decidedAt,
    });
  }
  return NextResponse.json(
    { ok: true, decision: result.record.decision, decidedAt: result.record.decidedAt, question: result.record.question },
    { headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } },
  );
}
