import "server-only";

/**
 * Kurš drīkst redzēt piedāvājuma avota (Loģistikas auto) datus un bildes - tāpat kā Loģistikas sarakstā:
 * auto jābūt redzamam darbiniekam, un summas paslēptas lomām logistika/serviss.
 */

import { cabinetActorHidesSums, cabinetCarVisibleToActor } from "@/lib/iriss-logistics-cabinet-access";
import { listCabinetAccessRules } from "@/lib/iriss-logistics-cabinet-store";
import { logisticsCabinetAccessQuery } from "@/lib/iriss-logistics-access";
import type { OfferSourceRef } from "@/lib/iriss-stock-photos";
import type { AdminOrStaffActor } from "@/lib/staff-auth";

export async function offerSourceAccess(
  actor: AdminOrStaffActor,
  ref: OfferSourceRef,
): Promise<{ visible: boolean; hideSums: boolean }> {
  if (ref.kind !== "logistics") return { visible: true, hideSums: false };
  const query = logisticsCabinetAccessQuery(actor, ref.id);
  const visible = cabinetCarVisibleToActor(query, await listCabinetAccessRules());
  return { visible, hideSums: cabinetActorHidesSums(query) };
}
