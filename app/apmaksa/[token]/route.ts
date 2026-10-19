import { NextResponse } from "next/server";
import { unpaidMatchesPaidIdentity } from "@/lib/admin-unpaid-orders-core";
import { paidIdentitiesForUnpaidFilter } from "@/lib/admin-unpaid-orders";
import { findUnpaidReminderRecord, listUnpaidReminderRecords } from "@/lib/admin-unpaid-reminder-store";
import { isSafeUnpaidPaymentToken, unpaidReminderOrderUrl } from "@/lib/admin-unpaid-payment-link";
import { hashClientLinkToken } from "@/lib/client-link-crypto";
import { checkRateLimit } from "@/lib/rate-limit-memory";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { getPublicSiteOrigin } from "@/lib/site-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

function plain(status: number, text: string): NextResponse {
  return new NextResponse(text, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

export async function GET(req: Request, ctx: Ctx) {
  const ip = getClientIpFromRequest(req);
  const rl = checkRateLimit(`apmaksa:${ip}`, 40, 10 * 60 * 1000);
  if (!rl.ok) {
    return plain(429, "Pārāk daudz pieprasījumu. Mēģiniet vēlāk.");
  }
  const { token: raw } = await ctx.params;
  const token = (raw ?? "").trim();
  if (!isSafeUnpaidPaymentToken(token)) {
    return plain(404, "Saite nav derīga.");
  }
  const hash = hashClientLinkToken(token);
  const records = await listUnpaidReminderRecords();
  const rec = findUnpaidReminderRecord(records, { tokenHash: hash });
  if (!rec || rec.hidden) {
    return plain(404, "Saite nav derīga.");
  }
  if (rec.expiresAt && Date.parse(rec.expiresAt) < Date.now()) {
    return plain(410, "Šī apmaksas saite vairs nav derīga.");
  }

  const paid = await paidIdentitiesForUnpaidFilter().catch(() => []);
  if (
    unpaidMatchesPaidIdentity(
      {
        id: rec.sessionId,
        created: 0,
        status: "expired",
        paymentStatus: "unpaid",
        customerEmail: rec.email || null,
        vin: rec.vin || null,
        amountTotal: null,
        currency: null,
      },
      paid,
    )
  ) {
    return plain(410, "Šis pasūtījums jau ir apmaksāts.");
  }

  const orderUrl = unpaidReminderOrderUrl(rec.vin, getPublicSiteOrigin());
  return NextResponse.redirect(orderUrl, { status: 302 });
}
