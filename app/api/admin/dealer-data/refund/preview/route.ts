/**
 * Atmaksas loga priekšskats: tieši tas HTML, ko saņems klients (Nila rediģētais teksts,
 * bez «nosūtīts automātiski»). Tikai renderē - neko nesūta un naudu neaiztiek.
 */
import { NextResponse } from "next/server";

import { dealerRefundEmailFacts, parseDealerStripeRefundMessage } from "@/lib/admin-dealer-data-refund";
import { getAdminSession } from "@/lib/admin-auth";
import { dealerDataOperatorMessageEmailHtml } from "@/lib/email/html-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const parsed = parseDealerStripeRefundMessage({ ...o, channel: "email" });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { text, lang } = parsed.message;
  const cents = typeof o.amountCents === "number" && o.amountCents > 0 ? Math.floor(o.amountCents) : 0;
  const html = dealerDataOperatorMessageEmailHtml({
    text,
    lang,
    humanSent: true,
    context: {
      situation: o.cancelled === true ? "cancelled" : "no_data",
      productKind: "dealer",
      vin: String(o.vin ?? "").trim() || null,
      facts: dealerRefundEmailFacts(lang, cents),
    },
  });
  return NextResponse.json({ ok: true, html });
}
