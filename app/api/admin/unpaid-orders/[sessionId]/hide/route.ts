import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { isSafeCheckoutSessionId } from "@/lib/admin-unpaid-orders-core";
import { listUnpaidAdminOrders } from "@/lib/admin-unpaid-orders";
import { hideUnpaidReminderGroup } from "@/lib/admin-unpaid-reminder-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ sessionId: string }> };

export async function POST(_req: Request, ctx: Ctx) {
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
  await hideUnpaidReminderGroup({
    sessionId: row.sessionId,
    aliasSessionIds: row.aliasSessionIds,
    email: row.email,
    vin: row.vin,
  });
  return NextResponse.json({ ok: true });
}
