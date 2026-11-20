import { after, NextResponse } from "next/server";
import { cabinetActorHidesSums, cabinetActorSeesTransportCost, maskOrderSums, stripAdminOnlyOrderFields } from "@/lib/iriss-logistics-cabinet-access";
import { logisticsCabinetAccessQuery, logisticsCabinetWriteForbidden, requireIrissLogisticsApi, irissLogisticsScopeHeader } from "@/lib/iriss-logistics-access";
import { autoparksActor } from "@/lib/iriss-autoparks-access";
import { getLogisticsOrder, upsertLogisticsOrder } from "@/lib/iriss-logistics-store";
import { normalizeLogisticsVin, type LogisticsOrder } from "@/lib/iriss-logistics-types";
import { overlayOrderForActor, routeSharedCarFields, sharedCarRouteErrorBody } from "@/lib/iriss-logistics-viens-avots-server";

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
  // VIN no formas (vai, ja tur tukšs, no atpazītā sludinājuma) - tīrs, lai nonāk arī Autoparkā un /STOCK sasaistē.
  if (typeof input.vin === "string" || input.listingParsed) {
    const vin = normalizeLogisticsVin(input.vin) || normalizeLogisticsVin(input.listingParsed?.vin);
    if (vin || typeof input.vin === "string") input.vin = vin;
  }
  const actorQuery = logisticsCabinetAccessQuery(gate.actor, "");
  const hideSums = cabinetActorHidesSums(actorQuery);
  const hideTransport = !cabinetActorSeesTransportCost(actorQuery);
  let fields: Partial<LogisticsOrder> = hideTransport ? stripAdminOnlyOrderFields(input) : input;
  // P3 (viens avots): esoša ieraksta (ar `id`) kopējie auto lauki saistītam auto tiek rakstīti Autoparkā.
  const existing = typeof input.id === "string" && input.id.trim() ? await getLogisticsOrder(input.id.trim()) : null;
  if (existing) {
    const routed = await routeSharedCarFields(existing, fields as Record<string, unknown>, gate.actor);
    if (!routed.ok) return NextResponse.json(sharedCarRouteErrorBody(routed), { status: routed.status, headers: irissLogisticsScopeHeader() });
    fields = { ...(routed.rest as Partial<LogisticsOrder>), id: existing.id };
  }
  const order = await upsertLogisticsOrder(fields);
  // Nils 27.10: «+ Nopirkts» = auto uzreiz Autoparkā ar statusu «Ceļā» (Loģistika ir tā posms). Kļūda neaptur pirkumu.
  let autoparksCarId = "";
  if (toAutoparks === true && !raw.id) {
    try {
      const { ensureAutoparksCarFromOrder } = await import("@/lib/iriss-autoparks-store");
      const { car } = await ensureAutoparksCarFromOrder(order, autoparksActor(gate.actor), { status: "in_transit" });
      autoparksCarId = car.id;
      // Esošo /STOCK mapi (pēc VIN6/VIN) sasaista uzreiz; jaunu mapi neveido un failus nepārvieto.
      const carId = car.id;
      after(async () => {
        const { linkAutoparksCarToDropbox } = await import("@/lib/iriss-autoparks-dropbox-sync");
        await linkAutoparksCarToDropbox(carId, { create: false }).catch(() => null);
      });
    } catch (e) {
      console.error("[iriss-logistics/orders] autoparks", e instanceof Error ? e.message : e);
    }
  }
  return NextResponse.json(
    { ok: true, order: maskOrderSums(await overlayOrderForActor(order, gate.actor), hideSums, hideTransport), autoparksCarId },
    { headers: irissLogisticsScopeHeader() },
  );
}
