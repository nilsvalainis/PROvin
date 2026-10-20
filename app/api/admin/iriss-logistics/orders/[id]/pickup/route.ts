import { NextResponse } from "next/server";
import { irissLogisticsScopeHeader, logisticsCabinetActorId, logisticsCabinetWriteForbidden, requireIrissLogisticsApi } from "@/lib/iriss-logistics-access";
import { isCabinetPickupStage } from "@/lib/iriss-logistics-cabinet";
import { upsertCabinetPickup } from "@/lib/iriss-logistics-cabinet-store";
import { getLogisticsOrder } from "@/lib/iriss-logistics-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const denied = logisticsCabinetWriteForbidden(gate.actor);
  if (denied) return denied;
  const { id } = await ctx.params;
  const order = await getLogisticsOrder(id);
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404, headers: irissLogisticsScopeHeader() });
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: irissLogisticsScopeHeader() });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: irissLogisticsScopeHeader() });
  }
  const row = body as Record<string, unknown>;
  if (row.stage !== undefined && !isCabinetPickupStage(row.stage)) {
    return NextResponse.json({ error: "invalid_stage" }, { status: 400, headers: irissLogisticsScopeHeader() });
  }
  const pickup = await upsertCabinetPickup({
    carId: id,
    stage: isCabinetPickupStage(row.stage) ? row.stage : undefined,
    pickupCode: typeof row.pickupCode === "string" ? row.pickupCode : undefined,
    pickupDate: typeof row.pickupDate === "string" ? row.pickupDate : undefined,
    notes: typeof row.notes === "string" ? row.notes : undefined,
    updatedBy: logisticsCabinetActorId(gate.actor),
  });
  return NextResponse.json({ ok: true, pickup }, { headers: irissLogisticsScopeHeader() });
}
