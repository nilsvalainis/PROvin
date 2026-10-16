import { NextResponse } from "next/server";
import { b2bDemoErrorResponse, requireB2bDemoActor } from "@/lib/b2b-demo-api";
import { getB2bDemoTenantOrder, patchB2bDemoTenantOrder } from "@/lib/b2b-demo-store";
import { isB2bDemoOrderStatus } from "@/lib/b2b-demo-types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireB2bDemoActor();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const order = await getB2bDemoTenantOrder(gate.actor.session.tenantId, id);
  if (!order) return NextResponse.json({ error: "Pasūtījums nav atrasts." }, { status: 404 });
  return NextResponse.json({ order });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireB2bDemoActor();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  let body: { clientName?: string; brandModel?: string; vin?: string; note?: string; status?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Nederīgs JSON." }, { status: 400 });
  }
  try {
    const order = await patchB2bDemoTenantOrder(
      gate.actor.session.tenantId,
      id,
      {
        clientName: typeof body.clientName === "string" ? body.clientName : undefined,
        brandModel: typeof body.brandModel === "string" ? body.brandModel : undefined,
        vin: typeof body.vin === "string" ? body.vin : undefined,
        note: typeof body.note === "string" ? body.note : undefined,
        status: isB2bDemoOrderStatus(body.status) ? body.status : undefined,
      },
      undefined,
      { by: gate.actor.user.name || gate.actor.user.email },
    );
    return NextResponse.json({ order });
  } catch (e) {
    return b2bDemoErrorResponse(e);
  }
}
