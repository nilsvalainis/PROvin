import { NextResponse } from "next/server";
import { b2bDemoErrorResponse, requireB2bDemoActor } from "@/lib/b2b-demo-api";
import { isSafeB2bDemoOrderId } from "@/lib/b2b-demo-ids";
import { b2bDemoOrderInputFromBody } from "@/lib/b2b-demo-orders";
import { deleteB2bDemoTenantOrder, getB2bDemoTenantOrder, patchB2bDemoTenantOrder } from "@/lib/b2b-demo-store";
import { canWriteB2bDemoOrders } from "@/lib/b2b-demo-users";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireB2bDemoActor();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  if (!isSafeB2bDemoOrderId(id)) return NextResponse.json({ error: "Nederīgs pasūtījums." }, { status: 400 });
  const order = await getB2bDemoTenantOrder(gate.actor.session.tenantId, id);
  if (!order) return NextResponse.json({ error: "Pasūtījums nav atrasts." }, { status: 404 });
  return NextResponse.json({ order });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireB2bDemoActor();
  if (!gate.ok) return gate.response;
  if (!canWriteB2bDemoOrders(gate.actor.session.role)) {
    return NextResponse.json({ error: "Nav tiesību labot pasūtījumus." }, { status: 403 });
  }
  const { id } = await ctx.params;
  if (!isSafeB2bDemoOrderId(id)) return NextResponse.json({ error: "Nederīgs pasūtījums." }, { status: 400 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Nederīgs JSON." }, { status: 400 });
  }
  try {
    const order = await patchB2bDemoTenantOrder(
      gate.actor.session.tenantId,
      id,
      b2bDemoOrderInputFromBody(body),
      undefined,
      { by: gate.actor.user.name || gate.actor.user.email },
    );
    return NextResponse.json({ order });
  } catch (e) {
    return b2bDemoErrorResponse(e);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireB2bDemoActor();
  if (!gate.ok) return gate.response;
  if (!canWriteB2bDemoOrders(gate.actor.session.role)) {
    return NextResponse.json({ error: "Nav tiesību dzēst pasūtījumus." }, { status: 403 });
  }
  const { id } = await ctx.params;
  if (!isSafeB2bDemoOrderId(id)) return NextResponse.json({ error: "Nederīgs pasūtījums." }, { status: 400 });
  try {
    await deleteB2bDemoTenantOrder(gate.actor.session.tenantId, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return b2bDemoErrorResponse(e);
  }
}
