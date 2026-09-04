import { NextResponse } from "next/server";
import { clearB2bPartnerServerSession } from "@/lib/b2b-partner-server-session";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json({ error: "use_login" }, { status: 405, headers: { Allow: "DELETE" } });
}

export async function DELETE() {
  await clearB2bPartnerServerSession();
  return NextResponse.json({ ok: true });
}
