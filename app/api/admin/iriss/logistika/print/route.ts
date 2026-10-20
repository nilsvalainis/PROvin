import { NextResponse } from "next/server";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { requireLogisticsApi } from "@/lib/staff-auth";
import { ENV_ADMIN_USER_ID } from "@/lib/staff-roles";
import { appendStaffAudit } from "@/lib/staff-store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const gate = await requireLogisticsApi();
  if (!gate.ok) return gate.response;
  await appendStaffAudit({
    userId: gate.actor.kind === "admin" ? ENV_ADMIN_USER_ID : gate.actor.user.id,
    action: "print",
    target: "karte",
    ip: getClientIpFromRequest(req),
    userAgent: req.headers.get("user-agent") ?? "",
  });
  return NextResponse.json({ ok: true });
}
