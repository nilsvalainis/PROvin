import { after, NextResponse } from "next/server";
import { cabinetActorHidesSums, cabinetActorSeesTransportCost, maskOrderSums, stripAdminOnlyOrderFields } from "@/lib/iriss-logistics-cabinet-access";
import { logisticsCabinetAccessQuery, logisticsCabinetWriteForbidden, requireIrissLogisticsApi, irissLogisticsScopeHeader } from "@/lib/iriss-logistics-access";
import { autoparksActor } from "@/lib/iriss-autoparks-access";
import { upsertLogisticsOrder } from "@/lib/iriss-logistics-store";
import { normalizeLogisticsVin, type LogisticsOrder } from "@/lib/iriss-logistics-types";

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
  const order = await upsertLogisticsOrder(hideTransport ? stripAdminOnlyOrderFields(input) : input);
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
  return NextResponse.json({ ok: true, order: maskOrderSums(order, hideSums, hideTransport), autoparksCarId }, { headers: irissLogisticsScopeHeader() });
}
