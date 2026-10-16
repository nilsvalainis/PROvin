import { NextResponse } from "next/server";
import { requireB2bDemoPlatformAdmin } from "@/lib/b2b-demo-admin-gate";
import { b2bDemoErrorResponse } from "@/lib/b2b-demo-api";
import { isSafeB2bDemoTenantId } from "@/lib/b2b-demo-ids";
import { addB2bDemoTenantOwner } from "@/lib/b2b-demo-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ tenantId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const gate = await requireB2bDemoPlatformAdmin(req);
  if (!gate.ok) return gate.response;

  const { tenantId } = await ctx.params;
  if (!isSafeB2bDemoTenantId(tenantId)) {
    return NextResponse.json({ error: "Nederīgs tenant_id." }, { status: 400 });
  }

  let body: { email?: string; name?: string; password?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Nederīgs JSON." }, { status: 400 });
  }

  try {
    const created = await addB2bDemoTenantOwner(tenantId, {
      email: typeof body.email === "string" ? body.email : "",
      name: typeof body.name === "string" ? body.name : undefined,
      password: typeof body.password === "string" ? body.password : undefined,
    });
    return NextResponse.json(
      { user: created.user, generatedPassword: created.generatedPassword },
      { status: 201 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (message === "Tenants nav atrasts.") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return b2bDemoErrorResponse(e);
  }
}
