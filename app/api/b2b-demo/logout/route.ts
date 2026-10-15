import { NextResponse } from "next/server";
import { clearB2bDemoSessionCookie } from "@/lib/b2b-demo-auth";

export const runtime = "nodejs";

export async function POST() {
  await clearB2bDemoSessionCookie();
  return NextResponse.json({ ok: true });
}
