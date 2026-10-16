import { NextResponse } from "next/server";
import { requireB2bDemoPlatformAdmin } from "@/lib/b2b-demo-admin-gate";
import { b2bDemoErrorResponse } from "@/lib/b2b-demo-api";
import { isSafeB2bDemoTenantId } from "@/lib/b2b-demo-ids";
import { deleteB2bDemoTenant } from "@/lib/b2b-demo-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ tenantId: string }> };

export async function DELETE(req: Request, ctx: Ctx) {
  const gate = await requireB2bDemoPlatformAdmin(req);
  if (!gate.ok) return gate.response;

  const { tenantId } = await ctx.params;
  if (!isSafeB2bDemoTenantId(tenantId)) {
    return NextResponse.json({ error: "Nederīgs tenant_id." }, { status: 400 });
  }

  try {
    const result = await deleteB2bDemoTenant(tenantId);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (message === "Tenants nav atrasts.") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return b2bDemoErrorResponse(e);
  }
}
