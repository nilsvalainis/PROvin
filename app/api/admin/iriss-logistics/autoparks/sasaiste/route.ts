import { NextResponse } from "next/server";
import { autoparksActor } from "@/lib/iriss-autoparks-access";
import { ensureAutoparksCarFromOrder, linkAutoparksCarToOrder, readAutoparksState } from "@/lib/iriss-autoparks-store";
import { planAutoparksLinks } from "@/lib/iriss-autoparks-transit";
import { isLogisticsOrderActive } from "@/lib/iriss-logistics-archive";
import { listLogisticsOrders } from "@/lib/iriss-logistics-store";
import { requireAdminOnlyApi } from "@/lib/staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };

/**
 * Nils 27.10 (apstiprināts): aktīvie Loģistikas auto -> Autoparks posms «Ceļā».
 * GET - tikai plāns (nekas netiek rakstīts). POST { apply: true } - izpilda plānu:
 * pēc VIN atrastam auto piesaista Loģistikas ierakstu (statusu neaiztiek), pārējiem izveido auto «Ceļā».
 * Tikai administrators. Atkārtota palaišana dublikātus neveido.
 */
async function currentPlan() {
  const [orders, state] = await Promise.all([listLogisticsOrders(), readAutoparksState()]);
  return planAutoparksLinks(orders.filter(isLogisticsOrderActive), state.cars);
}

export async function GET() {
  const gate = await requireAdminOnlyApi();
  if (!gate.ok) return gate.response;
  return NextResponse.json({ ok: true, plan: await currentPlan() }, { headers: noStore });
}

export async function POST(req: Request) {
  const gate = await requireAdminOnlyApi();
  if (!gate.ok) return gate.response;
  const body = (await req.json().catch(() => ({}))) as { apply?: unknown };
  if (body.apply !== true) return NextResponse.json({ ok: false, error: "apply_required" }, { status: 400, headers: noStore });
  const actor = autoparksActor(gate.actor);
  const orders = new Map((await listLogisticsOrders()).map((o) => [o.id, o]));
  const plan = await currentPlan();
  let linked = 0;
  let created = 0;
  for (const step of plan) {
    if (step.kind === "link_vin" && (await linkAutoparksCarToOrder(step.carId, step.orderId, actor))) linked += 1;
    if (step.kind === "create") {
      const order = orders.get(step.orderId);
      if (!order) continue;
      const res = await ensureAutoparksCarFromOrder(order, actor, { status: "in_transit" });
      if (res.created) created += 1;
    }
  }
  return NextResponse.json({ ok: true, linked, created, plan: await currentPlan() }, { headers: noStore });
}
