import { NextResponse } from "next/server";
import { cabinetActorHidesSums } from "@/lib/iriss-logistics-cabinet-access";
import { logisticsCabinetAccessQuery, logisticsCabinetWriteForbidden, requireIrissLogisticsApi, irissLogisticsScopeHeader } from "@/lib/iriss-logistics-access";
import { getLogisticsOrder, removeManualLogisticsOrder, setLogisticsOrderArchiveState, upsertLogisticsOrder } from "@/lib/iriss-logistics-store";
import type { LogisticsOrder } from "@/lib/iriss-logistics-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const order = await getLogisticsOrder(id);
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404, headers: irissLogisticsScopeHeader() });
  const hideSums = cabinetActorHidesSums(logisticsCabinetAccessQuery(gate.actor, id));
  return NextResponse.json(
    { ok: true, order: hideSums ? { ...order, priceEur: null } : order },
    { headers: irissLogisticsScopeHeader() },
  );
}

export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const denied = logisticsCabinetWriteForbidden(gate.actor);
  if (denied) return denied;
  const { id } = await ctx.params;
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
  if (row.action === "wake" || row.action === "picked_up" || row.action === "delivered" || row.action === "archive") {
    const order = await setLogisticsOrderArchiveState(id, row.action);
    if (!order) return NextResponse.json({ error: "not_found" }, { status: 404, headers: irissLogisticsScopeHeader() });
    return NextResponse.json({ ok: true, order }, { headers: irissLogisticsScopeHeader() });
  }
  const existing = await getLogisticsOrder(id);
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404, headers: irissLogisticsScopeHeader() });
  const order = await upsertLogisticsOrder({ ...(row as Partial<LogisticsOrder>), id });
  return NextResponse.json({ ok: true, order }, { headers: irissLogisticsScopeHeader() });
}

/** Tikai ar roku ievadītie citu klientu auto (source = manual). */
export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const denied = logisticsCabinetWriteForbidden(gate.actor);
  if (denied) return denied;
  const { id } = await ctx.params;
  const result = await removeManualLogisticsOrder(id);
  if (result === "not_found") return NextResponse.json({ error: "not_found" }, { status: 404, headers: irissLogisticsScopeHeader() });
  if (result === "not_manual") return NextResponse.json({ error: "not_manual" }, { status: 409, headers: irissLogisticsScopeHeader() });
  return NextResponse.json({ ok: true }, { headers: irissLogisticsScopeHeader() });
}
