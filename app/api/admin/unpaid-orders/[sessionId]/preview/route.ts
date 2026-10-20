import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { isSafeCheckoutSessionId } from "@/lib/admin-unpaid-orders-core";
import { listUnpaidAdminOrders, stripeCheckoutSessionDashboardUrl } from "@/lib/admin-unpaid-orders";
import { buildUnpaidReminderMailCopy } from "@/lib/admin-unpaid-reminder-mail";
import { getCachedMessageTemplatesDoc, warmMessageTemplatesCache } from "@/lib/messages/message-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ sessionId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { sessionId: rawId } = await ctx.params;
  const sessionId = decodeURIComponent(rawId ?? "").trim();
  if (!isSafeCheckoutSessionId(sessionId)) {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  }
  const { rows } = await listUnpaidAdminOrders();
  const row = rows.find((r) => r.sessionId === sessionId || r.aliasSessionIds.includes(sessionId));
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await warmMessageTemplatesCache();
  const copy = buildUnpaidReminderMailCopy({
    vin: row.vin,
    paymentUrl: "{{maksājuma_saite}}",
    doc: getCachedMessageTemplatesDoc(),
  });
  return NextResponse.json({
    to: row.email,
    vin: row.vin,
    attemptCount: row.attemptCount,
    remindable: row.remindable,
    stripeDashboardUrl: stripeCheckoutSessionDashboardUrl(row.sessionId),
    subject: copy.subject,
    text: copy.text.replaceAll("{{maksājuma_saite}}", "{{maksājuma_saite}}"),
  });
}
