import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { buildClientLinkEmailCopy, clientLinkAbsoluteUrl, isSafeClientLinkToken, isClientLinkUsable } from "@/lib/client-link";
import { readClientLinkByHash } from "@/lib/client-link-store";
import { isValidOrderEmail } from "@/lib/order-field-validation";
import { getPublicSiteOrigin } from "@/lib/site-url";
import { isSmtpConfigured, trySendDealerDataOperatorEmail } from "@/lib/email/send-transactional";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const id = typeof body.id === "string" ? body.id.trim().toLowerCase() : "";
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const toRaw = typeof body.to === "string" ? body.to.trim() : "";
  if (!/^[a-f0-9]{64}$/.test(id) || !isSafeClientLinkToken(token)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const record = await readClientLinkByHash(id);
  if (!record || !isClientLinkUsable(record)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const to = toRaw || (record.recipientChannel === "email" ? record.recipient : "");
  if (!isValidOrderEmail(to)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (!isSmtpConfigured()) {
    return NextResponse.json({ error: "smtp_not_configured" }, { status: 503 });
  }
  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim() ? getPublicSiteOrigin() : "http://localhost:3040";
  const url = clientLinkAbsoluteUrl(origin, token);
  const copy = buildClientLinkEmailCopy({
    url,
    productName: record.productName,
    expiresAt: record.expiresAt,
    amountCents: record.amountCents,
  });
  const sent = await trySendDealerDataOperatorEmail({ to, subject: copy.subject, text: copy.text });
  if (!sent) {
    return NextResponse.json({ error: "send_failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
