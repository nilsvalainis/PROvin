import { NextResponse } from "next/server";
import { irissLogisticsScopeHeader, logisticsCabinetActorId, requireIrissLogisticsApi } from "@/lib/iriss-logistics-access";
import { isLogisticsOrderActive } from "@/lib/iriss-logistics-archive";
import { CARGO_DOC_EXPECTED, isCargoBucket, normalizeCargoPlan, pickupStageForCargoMove } from "@/lib/iriss-logistics-cargo-plan";
import { loadCargoPlanForActiveOrders, listRouteTemplates, saveCargoPlanForActiveOrders } from "@/lib/iriss-logistics-cargo-store";
import { liveCabinetDocuments } from "@/lib/iriss-logistics-cabinet";
import { listCabinetDocuments, listCabinetPickups, upsertCabinetPickup } from "@/lib/iriss-logistics-cabinet-store";
import { listLogisticsOrders } from "@/lib/iriss-logistics-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function cargoExtras() {
  const [orders, docs, pickups, templates] = await Promise.all([
    listLogisticsOrders(),
    listCabinetDocuments(),
    listCabinetPickups(),
    listRouteTemplates(),
  ]);
  const active = orders.filter(isLogisticsOrderActive);
  const live = liveCabinetDocuments(docs);
  const docCounts: Record<string, { have: number; expected: number }> = {};
  for (const order of active) {
    docCounts[order.id] = {
      have: live.filter((d) => d.carId === order.id).length,
      expected: CARGO_DOC_EXPECTED,
    };
  }
  // Gatavības krāsai: kuriem auto kabinetā ir «Pickup dokuments».
  const activeIds = new Set(active.map((o) => o.id));
  const pickupDocCarIds = [...new Set(live.filter((d) => d.type === "pickup_pdf" && activeIds.has(d.carId)).map((d) => d.carId))];
  return { orders: active, pickups, docCounts, templates, pickupDocCarIds };
}

export async function GET() {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const plan = await loadCargoPlanForActiveOrders();
  const extra = await cargoExtras();
  return NextResponse.json({ ok: true, plan, ...extra }, { headers: irissLogisticsScopeHeader() });
}

export async function PUT(req: Request) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
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
  const incoming = normalizeCargoPlan(row.plan ?? row);
  const prev = await loadCargoPlanForActiveOrders();
  const plan = await saveCargoPlanForActiveOrders(incoming);
  const actor = logisticsCabinetActorId(gate.actor);
  const prevMap = new Map(prev.cars.map((c) => [c.carId, c]));
  const pickups = await listCabinetPickups();
  const pickupMap = new Map(pickups.map((p) => [p.carId, p]));
  for (const car of plan.cars) {
    const before = prevMap.get(car.carId);
    if (!before || before.bucket === car.bucket) continue;
    const nextStage = pickupStageForCargoMove(car.bucket, pickupMap.get(car.carId)?.stage ?? null);
    if (!nextStage) continue;
    await upsertCabinetPickup({ carId: car.carId, stage: nextStage, updatedBy: actor });
  }
  const extra = await cargoExtras();
  return NextResponse.json({ ok: true, plan, ...extra }, { headers: irissLogisticsScopeHeader() });
}

export async function PATCH(req: Request) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
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
  const carId = typeof row.carId === "string" ? row.carId.trim() : "";
  if (!carId) {
    return NextResponse.json({ error: "missing_car" }, { status: 400, headers: irissLogisticsScopeHeader() });
  }
  const plan = await loadCargoPlanForActiveOrders();
  const { moveCargoCar, setCargoShowOnMap } = await import("@/lib/iriss-logistics-cargo-plan");
  let next = plan;
  if (isCargoBucket(row.bucket)) {
    next = moveCargoCar(next, carId, row.bucket, typeof row.sort === "number" ? row.sort : undefined);
  }
  if (typeof row.showOnMap === "boolean") {
    next = setCargoShowOnMap(next, carId, row.showOnMap);
  }
  const saved = await saveCargoPlanForActiveOrders(next);
  if (isCargoBucket(row.bucket)) {
    const pickups = await listCabinetPickups();
    const current = pickups.find((p) => p.carId === carId)?.stage ?? null;
    const stage = pickupStageForCargoMove(row.bucket, current);
    if (stage) {
      await upsertCabinetPickup({
        carId,
        stage,
        updatedBy: logisticsCabinetActorId(gate.actor),
      });
    }
  }
  const extra = await cargoExtras();
  return NextResponse.json({ ok: true, plan: saved, ...extra }, { headers: irissLogisticsScopeHeader() });
}
