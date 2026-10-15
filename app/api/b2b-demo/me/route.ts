import { NextResponse } from "next/server";
import { requireB2bDemoActor } from "@/lib/b2b-demo-api";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requireB2bDemoActor();
  if (!gate.ok) return gate.response;
  return NextResponse.json({
    tenant: gate.actor.tenant,
    user: gate.actor.user,
    role: gate.actor.session.role,
  });
}
