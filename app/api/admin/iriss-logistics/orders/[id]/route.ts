import { NextResponse } from "next/server";
import { cabinetActorHidesSums, cabinetActorSeesTransportCost, maskOrderSums, sanitizeHiddenSumsPatch, stripAdminOnlyOrderFields } from "@/lib/iriss-logistics-cabinet-access";
import { logisticsCabinetAccessQuery, logisticsCabinetWriteForbidden, requireIrissLogisticsApi, irissLogisticsScopeHeader } from "@/lib/iriss-logistics-access";
import { getLogisticsOrder, removeManualLogisticsOrder, setLogisticsOrderArchiveState, upsertLogisticsOrder } from "@/lib/iriss-logistics-store";
import type { LogisticsOrder } from "@/lib/iriss-logistics-types";
import { autoparksActor } from "@/lib/iriss-autoparks-access";
import { syncAutoparksCarWithLogisticsAction } from "@/lib/iriss-autoparks-store";
import { overlayOrderForActor, routeSharedCarFields, sharedCarRouteErrorBody } from "@/lib/iriss-logistics-viens-avots-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const order = await getLogisticsOrder(id);
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404, headers: irissLogisticsScopeHeader() });
  const query = logisticsCabinetAccessQuery(gate.actor, id);
  const hideSums = cabinetActorHidesSums(query);
  const hideTransport = !cabinetActorSeesTransportCost(query);
  // P3: kopējie auto lauki no saistītā Autoparka auto (viens avots).
  return NextResponse.json(
    { ok: true, order: maskOrderSums(await overlayOrderForActor(order, gate.actor), hideSums, hideTransport) },
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
  const query = logisticsCabinetAccessQuery(gate.actor, id);
  const hideSums = cabinetActorHidesSums(query);
  const hideTransport = !cabinetActorSeesTransportCost(query);
  if (row.action === "wake" || row.action === "picked_up" || row.action === "delivered" || row.action === "archive" || row.action === "other_company") {
    const order = await setLogisticsOrderArchiveState(id, row.action);
    if (!order) return NextResponse.json({ error: "not_found" }, { status: 404, headers: irissLogisticsScopeHeader() });
    // P2 (Nils 20.11): saistītais Autoparka auto pēc tiem pašiem noteikumiem kā «Uz Autoparku» (nekad nedzēš).
    if (row.action === "delivered" || row.action === "archive" || row.action === "other_company") {
      await syncAutoparksCarWithLogisticsAction(order, row.action, autoparksActor(gate.actor)).catch((e) =>
        console.error("[iriss-logistics] autoparks sync", id, e instanceof Error ? e.message : e),
      );
    }
    return NextResponse.json(
      { ok: true, order: maskOrderSums(await overlayOrderForActor(order, gate.actor), hideSums, hideTransport) },
      { headers: irissLogisticsScopeHeader() },
    );
  }
  const existing = await getLogisticsOrder(id);
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404, headers: irissLogisticsScopeHeader() });
  let patch: Record<string, unknown> = hideTransport ? stripAdminOnlyOrderFields(row) : row;
  if (hideSums) {
    const clean = sanitizeHiddenSumsPatch(patch, existing);
    if (!clean.ok) {
      return NextResponse.json(
        { error: "hidden_sums_in_text", field: clean.field, message: "Šajā laukā ir summas, ko jūs neredzat - to var labot admins." },
        { status: 409, headers: irissLogisticsScopeHeader() },
      );
    }
    patch = clean.patch;
  }
  // P3 (viens avots): saistītam auto VIN/marka/modelis/gads/km/krāsa pieder Autoparkam - raksta tur, ne Loģistikā.
  const routed = await routeSharedCarFields(existing, patch, gate.actor);
  if (!routed.ok) return NextResponse.json(sharedCarRouteErrorBody(routed), { status: routed.status, headers: irissLogisticsScopeHeader() });
  patch = routed.rest;
  const order = Object.keys(patch).length > 0 ? await upsertLogisticsOrder({ ...(patch as Partial<LogisticsOrder>), id }) : existing;
  return NextResponse.json(
    { ok: true, order: maskOrderSums(await overlayOrderForActor(order, gate.actor), hideSums, hideTransport) },
    { headers: irissLogisticsScopeHeader() },
  );
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
