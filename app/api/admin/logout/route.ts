import { NextResponse } from "next/server";
import { clearAdminSessionCookie } from "@/lib/admin-auth";
import { logoutStaffSessionIfAny } from "@/lib/staff-auth";

export const runtime = "nodejs";

export async function POST() {
  await logoutStaffSessionIfAny();
  await clearAdminSessionCookie();
  return NextResponse.json({ ok: true });
}
