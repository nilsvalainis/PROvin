import { NextResponse } from "next/server";
import { b2bDemoErrorResponse, requireB2bDemoActor } from "@/lib/b2b-demo-api";
import { readB2bDemoTenantSettings, writeB2bDemoTenantSettings } from "@/lib/b2b-demo-store";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requireB2bDemoActor();
  if (!gate.ok) return gate.response;
  const settings = await readB2bDemoTenantSettings(gate.actor.session.tenantId);
  return NextResponse.json({ settings });
}

export async function PATCH(req: Request) {
  const gate = await requireB2bDemoActor();
  if (!gate.ok) return gate.response;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Nederīgs JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Nederīgs pieprasījums." }, { status: 400 });
  }
  const rec = body as Record<string, unknown>;
  try {
    const settings = await writeB2bDemoTenantSettings(
      gate.actor.session.tenantId,
      gate.actor.session.role,
      rec,
      rec.tenantId,
    );
    return NextResponse.json({ settings });
  } catch (e) {
    return b2bDemoErrorResponse(e);
  }
}
