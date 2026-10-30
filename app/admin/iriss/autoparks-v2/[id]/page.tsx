import "../autoparks-v2.css";
import { notFound, redirect } from "next/navigation";
import { AutoparksV2Cabinet } from "@/components/admin/iriss-autoparks-v2/AutoparksV2Cabinet";
import { autoparksV2Basics } from "@/lib/iriss-autoparks-v2";
import { getAutoparksV2PageActor } from "@/lib/iriss-autoparks-v2-access";
import { readAutoparksV2Car } from "@/lib/iriss-autoparks-v2-store";
import { staffHasSection } from "@/lib/staff-roles";
import { buildAutoparksTransit, type AutoparksTransit } from "@/lib/iriss-autoparks-transit";
import { isLogisticsOrderActive } from "@/lib/iriss-logistics-archive";
import { logisticsCabinetWriteForbidden } from "@/lib/iriss-logistics-access";
import { getCabinetPickup } from "@/lib/iriss-logistics-cabinet-store";
import { readCargoPlan } from "@/lib/iriss-logistics-cargo-store";
import { getLogisticsOrder } from "@/lib/iriss-logistics-store";
import { staffHasLogisticsCabinet } from "@/lib/staff-auth";

export const metadata = { title: "Auto kabinets | IRISS" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/** Auto kabinets v2. Pamatdati (bez summām) ielādē serveris; pārējās cilnes - savi API ar savām tiesībām. */
export default async function AutoparksV2CarPage({ params }: Props) {
  const access = await getAutoparksV2PageActor();
  if (!access) redirect("/admin/iriss");
  const { id } = await params;
  const found = await readAutoparksV2Car(id);
  if (!found) notFound();
  // "Izveidot piedāvājumu" tikai ar Pasūtījumu tiesību (j20 Nila atbilde 5).
  const canCreateOffer = access.actor.kind === "admin" || staffHasSection(access.actor.user, "pasutijumi");
  // «Pavadzīme» kartītē (Nils 27.10) - tikai ar Pavadzīmju tiesību (tās pašas API pārbaudes).
  const canWaybill = access.actor.kind === "admin" || staffHasSection(access.actor.user, "pavadzimes");
  // «Ceļā» posms (Nils 27.10): Loģistikas ieraksts, no kura auto nāk (tikai aktīvs; tikai ar Loģistikas tiesību).
  let transit: AutoparksTransit | null = null;
  if (found.car.orderId && staffHasLogisticsCabinet(access.actor)) {
    const order = await getLogisticsOrder(found.car.orderId).catch(() => null);
    if (order && isLogisticsOrderActive(order)) {
      const [pickup, plan] = await Promise.all([getCabinetPickup(order.id).catch(() => null), readCargoPlan().catch(() => null)]);
      transit = buildAutoparksTransit(order, pickup, plan);
    }
  }
  return (
    <AutoparksV2Cabinet
      transit={transit}
      transitCanWrite={logisticsCabinetWriteForbidden(access.actor) === null}
      initialBasics={autoparksV2Basics(found.car, found.v2)}
      perms={access.perms}
      canCreateOffer={canCreateOffer}
      canWaybill={canWaybill}
    />
  );
}
