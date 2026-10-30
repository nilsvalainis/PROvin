import { NextResponse } from "next/server";
import { logisticsCabinetWriteForbidden, requireIrissLogisticsApi, irissLogisticsScopeHeader } from "@/lib/iriss-logistics-access";
import { autoparksActor } from "@/lib/iriss-autoparks-access";
import { upsertLogisticsOrder } from "@/lib/iriss-logistics-store";
import type { LogisticsOrder } from "@/lib/iriss-logistics-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const denied = logisticsCabinetWriteForbidden(gate.actor);
  if (denied) return denied;
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: irissLogisticsScopeHeader() });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: irissLogisticsScopeHeader() });
  }
  const raw = body as Partial<LogisticsOrder> & { toAutoparks?: unknown };
  const { toAutoparks, ...input } = raw;
  const order = await upsertLogisticsOrder(input);
  // Nils 27.10: «+ Nopirkts» = auto uzreiz Autoparkā ar statusu «Ceļā» (Loģistika ir tā posms). Kļūda neaptur pirkumu.
  let autoparksCarId = "";
  if (toAutoparks === true && !raw.id) {
    try {
      const { ensureAutoparksCarFromOrder } = await import("@/lib/iriss-autoparks-store");
      const { car } = await ensureAutoparksCarFromOrder(order, autoparksActor(gate.actor), { status: "in_transit" });
      autoparksCarId = car.id;
    } catch (e) {
      console.error("[iriss-logistics/orders] autoparks", e instanceof Error ? e.message : e);
    }
  }
  return NextResponse.json({ ok: true, order, autoparksCarId }, { headers: irissLogisticsScopeHeader() });
}
