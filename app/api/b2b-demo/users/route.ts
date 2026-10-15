import { NextResponse } from "next/server";
import { b2bDemoErrorResponse, requireB2bDemoActor } from "@/lib/b2b-demo-api";
import { addB2bDemoTenantEmployee, listB2bDemoTenantUsers } from "@/lib/b2b-demo-store";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requireB2bDemoActor();
  if (!gate.ok) return gate.response;
  const users = await listB2bDemoTenantUsers(gate.actor.session.tenantId);
  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  const gate = await requireB2bDemoActor();
  if (!gate.ok) return gate.response;
  let body: { email?: string; name?: string; password?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Nederīgs JSON." }, { status: 400 });
  }
  try {
    const user = await addB2bDemoTenantEmployee(gate.actor.session.tenantId, gate.actor.session.role, {
      email: typeof body.email === "string" ? body.email : "",
      name: typeof body.name === "string" ? body.name : "",
      password: typeof body.password === "string" ? body.password : "",
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (e) {
    return b2bDemoErrorResponse(e);
  }
}
