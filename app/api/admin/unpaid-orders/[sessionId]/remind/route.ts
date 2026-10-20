import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  isSafeCheckoutSessionId,
  unpaidMatchesPaidIdentity,
  UNPAID_REMINDER_LINK_TTL_MS,
} from "@/lib/admin-unpaid-orders-core";
import { listUnpaidAdminOrders, paidIdentitiesForUnpaidFilter } from "@/lib/admin-unpaid-orders";
import { buildUnpaidReminderMailCopy } from "@/lib/admin-unpaid-reminder-mail";
import {
  findUnpaidReminderRecord,
  listUnpaidReminderRecords,
  upsertUnpaidReminderRecord,
} from "@/lib/admin-unpaid-reminder-store";
import { unpaidPaymentAbsoluteUrl } from "@/lib/admin-unpaid-payment-link";
import { hashClientLinkToken, newClientLinkToken } from "@/lib/client-link-crypto";
import { getCachedMessageTemplatesDoc, warmMessageTemplatesCache } from "@/lib/messages/message-runtime";
import { isSmtpConfigured, trySendUnpaidOrderReminderEmail } from "@/lib/email/send-transactional";
import { getPublicSiteOrigin } from "@/lib/site-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ sessionId: string }> };

function actor(): string {
  return process.env.ADMIN_USERNAME?.trim() || "admin";
}

export async function POST(req: Request, ctx: Ctx) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { sessionId: rawId } = await ctx.params;
  const sessionId = decodeURIComponent(rawId ?? "").trim();
  if (!isSafeCheckoutSessionId(sessionId)) {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  }
  if (!isSmtpConfigured()) {
    return NextResponse.json({ error: "smtp_not_configured" }, { status: 503 });
  }

  let body: { subject?: unknown; text?: unknown } = {};
  try {
    body = (await req.json()) as { subject?: unknown; text?: unknown };
  } catch {
    body = {};
  }
  const subjectOverride = typeof body.subject === "string" ? body.subject : null;
  const textOverride = typeof body.text === "string" ? body.text : null;

  const [{ rows }, paid, reminders] = await Promise.all([
    listUnpaidAdminOrders(),
    paidIdentitiesForUnpaidFilter(),
    listUnpaidReminderRecords(),
  ]);
  const row = rows.find((r) => r.sessionId === sessionId || r.aliasSessionIds.includes(sessionId));
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!row.remindable) {
    return NextResponse.json({ error: "not_remindable" }, { status: 409 });
  }
  const existing = findUnpaidReminderRecord(reminders, {
    sessionId: row.sessionId,
    email: row.email,
    vin: row.vin,
  });
  if (existing?.remindedAt) {
    return NextResponse.json({ error: "already_reminded" }, { status: 409 });
  }

  if (
    unpaidMatchesPaidIdentity(
      {
        id: row.sessionId,
        created: row.created,
        status: row.status,
        paymentStatus: row.paymentStatus,
        customerEmail: row.email || null,
        vin: row.vin || null,
        amountTotal: row.amountTotal,
        currency: row.currency,
        checkoutLine: row.checkoutLine,
      },
      paid,
    )
  ) {
    return NextResponse.json({ error: "already_paid" }, { status: 409 });
  }

  const token = newClientLinkToken();
  const origin = getPublicSiteOrigin();
  const paymentUrl = unpaidPaymentAbsoluteUrl(origin, token);
  await warmMessageTemplatesCache();
  const copy = buildUnpaidReminderMailCopy({
    vin: row.vin,
    paymentUrl,
    doc: getCachedMessageTemplatesDoc(),
    subjectOverride,
    textOverride,
  });
  const sent = await trySendUnpaidOrderReminderEmail({
    to: row.email,
    subject: copy.subject,
    text: copy.text,
  });
  if (!sent) {
    return NextResponse.json({ error: "send_failed" }, { status: 502 });
  }

  const now = new Date();
  await upsertUnpaidReminderRecord({
    sessionId: row.sessionId,
    aliasSessionIds: row.aliasSessionIds,
    email: row.email,
    vin: row.vin,
    createdAt: now.toISOString(),
    remindedAt: now.toISOString(),
    remindedBy: actor(),
    newSessionId: null,
    paymentTokenHash: hashClientLinkToken(token),
    paymentPublicUrl: paymentUrl,
    expiresAt: new Date(now.getTime() + UNPAID_REMINDER_LINK_TTL_MS).toISOString(),
    hidden: false,
  });

  return NextResponse.json({ ok: true, paymentUrl, remindedAt: now.toISOString() });
}
