import { NextResponse } from "next/server";
import { b2bDemoErrorResponse, requireB2bDemoActor } from "@/lib/b2b-demo-api";
import { parseB2bDemoOrderListQuery } from "@/lib/b2b-demo-order-list";
import { b2bDemoOrderInputFromBody } from "@/lib/b2b-demo-orders";
import { addB2bDemoTenantOrder, listB2bDemoTenantOrderPage } from "@/lib/b2b-demo-store";
import { canWriteB2bDemoOrders } from "@/lib/b2b-demo-users";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const gate = await requireB2bDemoActor();
  if (!gate.ok) return gate.response;
  const url = new URL(req.url);
  const page = await listB2bDemoTenantOrderPage(
    gate.actor.session.tenantId,
    parseB2bDemoOrderListQuery({
      page: Number(url.searchParams.get("page") ?? "1"),
      limit: Number(url.searchParams.get("limit") ?? ""),
      status: url.searchParams.get("status"),
    }),
  );
  return NextResponse.json(page);
}

export async function POST(req: Request) {
  const gate = await requireB2bDemoActor();
  if (!gate.ok) return gate.response;
  if (!canWriteB2bDemoOrders(gate.actor.session.role)) {
    return NextResponse.json({ error: "Nav tiesību veidot pasūtījumus." }, { status: 403 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Nederīgs JSON." }, { status: 400 });
  }
  try {
    const order = await addB2bDemoTenantOrder(gate.actor.session.tenantId, b2bDemoOrderInputFromBody(body));
    return NextResponse.json({ order }, { status: 201 });
  } catch (e) {
    return b2bDemoErrorResponse(e);
  }
}
