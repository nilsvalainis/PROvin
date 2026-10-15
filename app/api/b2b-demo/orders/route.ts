import { NextResponse } from "next/server";
import { b2bDemoErrorResponse, requireB2bDemoActor } from "@/lib/b2b-demo-api";
import { addB2bDemoTenantOrder, listB2bDemoTenantOrders } from "@/lib/b2b-demo-store";
import { isB2bDemoOrderStatus } from "@/lib/b2b-demo-types";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requireB2bDemoActor();
  if (!gate.ok) return gate.response;
  const orders = await listB2bDemoTenantOrders(gate.actor.session.tenantId);
  return NextResponse.json({ orders });
}

export async function POST(req: Request) {
  const gate = await requireB2bDemoActor();
  if (!gate.ok) return gate.response;
  let body: { clientName?: string; brandModel?: string; vin?: string; note?: string; status?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Nederīgs JSON." }, { status: 400 });
  }
  try {
    const order = await addB2bDemoTenantOrder(gate.actor.session.tenantId, {
      clientName: typeof body.clientName === "string" ? body.clientName : "",
      brandModel: typeof body.brandModel === "string" ? body.brandModel : "",
      vin: typeof body.vin === "string" ? body.vin : "",
      note: typeof body.note === "string" ? body.note : "",
      status: isB2bDemoOrderStatus(body.status) ? body.status : "active",
    });
    return NextResponse.json({ order }, { status: 201 });
  } catch (e) {
    return b2bDemoErrorResponse(e);
  }
}
