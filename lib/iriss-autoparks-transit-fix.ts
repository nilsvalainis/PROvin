import "server-only";

import type { AdminOrStaffActor } from "@/lib/staff-auth";
import { ENV_ADMIN_USER_ID } from "@/lib/staff-roles";
import { readAutoparksState } from "@/lib/iriss-autoparks-store";
import { readAutoparksV2State } from "@/lib/iriss-autoparks-v2-store";
import { autoparksV2ListRows } from "@/lib/iriss-autoparks-v2-list";
import { carIdsWithActiveLogistics, isTransitWithoutLogistics } from "@/lib/iriss-autoparks-transit";
import { isLogisticsOrderActive } from "@/lib/iriss-logistics-archive";
import { listLogisticsOrders } from "@/lib/iriss-logistics-store";

export type TransitFixRow = { id: string; title: string; vin: string; purchaseDate: string };

/** P2 (Nils 20.11, 4A): tikai administrators (ne darbinieki). */
export function transitFixAdminOf(actor: AdminOrStaffActor | null): { id: string; name: string } | null {
  return actor?.kind === "admin" ? { id: ENV_ADMIN_USER_ID, name: actor.name } : null;
}

/** Tikai lasīšana: Autoparka auto ar «Ceļā» bez aktīva Loģistikas ieraksta (jaunākā iegāde augšā). */
export async function listTransitWithoutLogistics(): Promise<{ rows: TransitFixRow[]; eligible: Set<string> }> {
  const [v1, v2, orders] = await Promise.all([readAutoparksState(), readAutoparksV2State(), listLogisticsOrders()]);
  const active = carIdsWithActiveLogistics(v1.cars, orders, isLogisticsOrderActive);
  const eligible = new Set(v1.cars.filter((c) => isTransitWithoutLogistics(c, active)).map((c) => c.id));
  const rows = autoparksV2ListRows(
    v1.cars.filter((c) => eligible.has(c.id)),
    v2,
  )
    .map((r) => ({ id: r.id, title: r.title, vin: r.vin, purchaseDate: r.purchaseDate }))
    .sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate) || a.title.localeCompare(b.title, "lv"));
  return { rows, eligible };
}
