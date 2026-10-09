import "server-only";

import { readIrissListingsLatestView, readIrissListingsOperatorState, writeIrissListingsRun } from "@/lib/iriss-listings-aggregate-store";
import { applyListingMembership } from "@/lib/iriss-listings-membership";
import { operatorRejectedIds } from "@/lib/iriss-listings-operator-state";
import { buildIrissListingSources } from "@/lib/iriss-listings-sources";
import type { IrissListingVehicle } from "@/lib/iriss-listings-types";
import { listIrissPasutijumi } from "@/lib/iriss-pasutijumi-store";

function membershipSig(vehicles: IrissListingVehicle[]): string {
  return vehicles
    .map((v) => `${v.id}:${v.orderIds.join(",")}:${(v.sourceKeys ?? []).join(",")}:${v.change}`)
    .join("|");
}

/** Uzreiz izņem sludinājumus, kas vairs nepieder derīgām saitēm / ir noraidīti / izsole beigusies. */
export async function applyIrissListingsMembershipNow(): Promise<{ dropped: number; ok: boolean; error?: string }> {
  const [latest, rows, operator] = await Promise.all([
    readIrissListingsLatestView(),
    listIrissPasutijumi(),
    readIrissListingsOperatorState(),
  ]);
  if (!latest) return { dropped: 0, ok: true };
  const sources = buildIrissListingSources(rows);
  const { vehicles, dropped } = applyListingMembership({
    vehicles: latest.vehicles,
    sources,
    rejectedIds: operatorRejectedIds(operator),
    nowMs: Date.now(),
  });
  if (dropped === 0 && membershipSig(vehicles) === membershipSig(latest.vehicles)) {
    return { dropped: 0, ok: true };
  }
  const write = await writeIrissListingsRun({
    ...latest,
    generatedAt: new Date().toISOString(),
    vehicles,
    summary: { ...latest.summary, vehicleCount: vehicles.length },
  });
  if (!write.ok) return { dropped, ok: false, error: write.error };
  return { dropped, ok: true };
}
