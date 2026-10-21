import { NextResponse } from "next/server";
import { autoparksListRows } from "@/lib/iriss-autoparks";
import { autoparksActor, autoparksHidesSums, autoparksRowsForActor } from "@/lib/iriss-autoparks-access";
import { createAutoparksCar, ensureAutoparksCarFromOrder, readAutoparksState } from "@/lib/iriss-autoparks-store";
import { parseAutoparksCarInput } from "@/lib/iriss-autoparks-input";
import { irissLogisticsScopeHeader, logisticsCabinetActorId, logisticsCabinetWriteForbidden, requireIrissLogisticsApi } from "@/lib/iriss-logistics-access";
import { upsertCabinetPickup } from "@/lib/iriss-logistics-cabinet-store";
import { getLogisticsOrder, setLogisticsOrderArchiveState } from "@/lib/iriss-logistics-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const rows = autoparksListRows(await readAutoparksState());
  return NextResponse.json(
    { ok: true, cars: autoparksRowsForActor(rows, autoparksHidesSums(gate.actor)) },
    { headers: irissLogisticsScopeHeader() },
  );
}

/** Jauns auto: ar roku vai no Loģistikas (`fromOrderId`): pickup = Atvests, pasūtījums uz arhīvu. */
export async function POST(req: Request) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const denied = logisticsCabinetWriteForbidden(gate.actor);
  if (denied) return denied;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: irissLogisticsScopeHeader() });
  }
  const actor = autoparksActor(gate.actor);
  const fromOrderId = typeof body.fromOrderId === "string" ? body.fromOrderId.trim() : "";
  if (fromOrderId) {
    const order = await getLogisticsOrder(fromOrderId);
    if (!order) return NextResponse.json({ error: "not_found" }, { status: 404, headers: irissLogisticsScopeHeader() });
    const { car, created } = await ensureAutoparksCarFromOrder(order, actor);
    await upsertCabinetPickup({ carId: order.id, stage: "arrived", updatedBy: logisticsCabinetActorId(gate.actor) });
    const archived = await setLogisticsOrderArchiveState(order.id, "delivered");
    return NextResponse.json({ ok: true, car, created, order: archived ?? order }, { headers: irissLogisticsScopeHeader() });
  }
  const input = parseAutoparksCarInput(body, autoparksHidesSums(gate.actor));
  if (!input.make && !input.model && !input.vin) {
    return NextResponse.json({ error: "missing_car" }, { status: 400, headers: irissLogisticsScopeHeader() });
  }
  const car = await createAutoparksCar(input, actor);
  return NextResponse.json({ ok: true, car, created: true }, { headers: irissLogisticsScopeHeader() });
}
