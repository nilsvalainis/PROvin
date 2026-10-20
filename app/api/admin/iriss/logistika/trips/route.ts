import { NextResponse } from "next/server";
import { requireLogisticsApi } from "@/lib/staff-auth";
import { isLogisticsOrderActive } from "@/lib/iriss-logistics-archive";
import { CARGO_BUCKET_LV, carsInCargoBucket, logisticsCarTitle } from "@/lib/iriss-logistics-cargo-plan";
import { loadCargoPlanForActiveOrders } from "@/lib/iriss-logistics-cargo-store";
import { listLogisticsOrders } from "@/lib/iriss-logistics-store";
import { toLogisticsTripView } from "@/lib/staff-data-filter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Kravu plāns (Nākošā / Aiznākošā). Cenas un klienti šeit netiek atdoti. */
export async function GET() {
  const gate = await requireLogisticsApi();
  if (!gate.ok) return gate.response;
  const [orders, plan] = await Promise.all([listLogisticsOrders(), loadCargoPlanForActiveOrders()]);
  const byId = new Map(orders.filter(isLogisticsOrderActive).map((o) => [o.id, o]));
  const trips = (["next", "after"] as const).flatMap((bucket) =>
    carsInCargoBucket(plan, bucket).flatMap((car) => {
      const order = byId.get(car.carId);
      if (!order) return [];
      return [
        toLogisticsTripView({
          id: order.id,
          vehicleTitle: `${CARGO_BUCKET_LV[bucket]} · ${logisticsCarTitle(order)}`,
          pointName: order.pickupSnapshot?.name || order.pickupAddress,
          hours: order.pickupSnapshot?.hoursText || "",
          deadline: order.pickupDate || null,
          vin: order.vin,
        }),
      ];
    }),
  );
  return NextResponse.json({ ok: true, trips }, { headers: { "Cache-Control": "private, no-store" } });
}
