import { NextResponse } from "next/server";
import { readAutoparksState } from "@/lib/iriss-autoparks-store";
import { cabinetCarVisibleToActor } from "@/lib/iriss-logistics-cabinet-access";
import { listCabinetAccessRules } from "@/lib/iriss-logistics-cabinet-store";
import { logisticsCabinetAccessQuery } from "@/lib/iriss-logistics-access";
import { listLogisticsOrders } from "@/lib/iriss-logistics-store";
import { offerSourceCarsFromAutoparks, offerSourceCarsFromLogistics } from "@/lib/iriss-offer-source-cars";
import { offerSourceSection, type OfferSourceKind } from "@/lib/iriss-stock-photos";
import { requireIrissSectionApi } from "@/lib/staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };

/**
 * GET ?kind=autoparks|logistics - auto saraksts klienta kabineta "Izveidot piedāvājumu" izvēlei.
 * Tiesības: Pasūtījumi + Autoparks pamatdati / Loģistika. Bez summām.
 */
export async function GET(req: Request) {
  const gate = await requireIrissSectionApi("pasutijumi");
  if (!gate.ok) return gate.response;
  const raw = new URL(req.url).searchParams.get("kind");
  if (raw !== "autoparks" && raw !== "logistics") return NextResponse.json({ error: "invalid" }, { status: 400, headers: noStore });
  const kind: OfferSourceKind = raw;
  const source = await requireIrissSectionApi(offerSourceSection({ kind, id: "" }));
  if (!source.ok) return source.response;
  try {
    if (kind === "autoparks") {
      const { cars } = await readAutoparksState();
      return NextResponse.json({ rows: offerSourceCarsFromAutoparks(cars) }, { headers: noStore });
    }
    const [orders, rules] = await Promise.all([listLogisticsOrders(), listCabinetAccessRules()]);
    const visible = orders.filter((o) => cabinetCarVisibleToActor(logisticsCabinetAccessQuery(gate.actor, o.id), rules));
    return NextResponse.json({ rows: offerSourceCarsFromLogistics(visible) }, { headers: noStore });
  } catch (e) {
    console.error("[iriss-offer-seed/cars]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "list_failed", rows: [] }, { status: 500, headers: noStore });
  }
}
