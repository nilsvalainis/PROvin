import { Suspense } from "react";
import "./iriss-logistika.css";
import { IrissLogistikaClient } from "@/components/admin/iriss-logistika/IrissLogistikaClient";
import {
  getIrissLogisticsStorageState,
  listLogisticsAuctionSources,
  listLogisticsOrders,
  listLogisticsPoints,
  listPreviousLogisticsPoints,
} from "@/lib/iriss-logistics-store";
import { requireLogisticsPage } from "@/lib/staff-auth";
import { staffHasSection } from "@/lib/staff-roles";
import { autoparksCarIdsByLogisticsOrder } from "@/lib/iriss-car-share";
import { readAutoparksState } from "@/lib/iriss-autoparks-store";
import { autoparksV2Perms } from "@/lib/iriss-autoparks-v2-access";
import { autoparksV2CanOpen } from "@/lib/iriss-autoparks-v2-perms";
import { listCabinetAccessRules } from "@/lib/iriss-logistics-cabinet-store";
import { cabinetActorCanWrite, cabinetActorHidesSums, cabinetActorSeesTransportCost, cabinetCarVisibleToActor, maskOrderSums } from "@/lib/iriss-logistics-cabinet-access";
import { logisticsCabinetAccessQuery } from "@/lib/iriss-logistics-access";
import { overlayOrdersForActor } from "@/lib/iriss-logistics-viens-avots-server";

export const metadata = {
  title: "Loģistika | IRISS",
};

export const dynamic = "force-dynamic";

export default async function IrissLogistikaPage() {
  const actor = await requireLogisticsPage();
  const storage = getIrissLogisticsStorageState();
  const storeEnabled = storage.enabled;
  const [allOrders, points, previous, sources, rules] = storeEnabled
    ? await Promise.all([
        listLogisticsOrders(),
        listLogisticsPoints(),
        listPreviousLogisticsPoints(),
        listLogisticsAuctionSources(),
        listCabinetAccessRules(),
      ])
    : [[], [], [], [], []];
  // Tā pati tvēruma un summu maska kā GET /api/admin/iriss-logistics (Loģistika/Serviss neredz cenas arī SSR).
  const actorQuery = logisticsCabinetAccessQuery(actor, "");
  const hideSums = cabinetActorHidesSums(actorQuery);
  const hideTransport = !cabinetActorSeesTransportCost(actorQuery);
  // P3 (viens avots): kopējie auto lauki no saistītā Autoparka auto (kā API).
  const orders = (
    await overlayOrdersForActor(
      allOrders.filter((order) => cabinetCarVisibleToActor({ ...actorQuery, carId: order.id }, rules)),
      actor,
    )
  ).map((order) => maskOrderSums(order, hideSums, hideTransport));
  const viewerName = actor.kind === "admin" ? actor.name : actor.user.name;
  const canEnableTotp = actor.kind === "staff" && !actor.user.totpEnabled;
  // Piedāvājumu veido tikai ar Pasūtījumu tiesību (Nila atbilde 5).
  const canCreateOffer = actor.kind === "admin" || staffHasSection(actor.user, "pasutijumi");
  // Kravu rindām saite "Kartīte" uz Autoparka auto - tikai tiem, kas Autoparku drīkst atvērt.
  const autoparksByOrder =
    storeEnabled && autoparksV2CanOpen(autoparksV2Perms(actor))
      ? autoparksCarIdsByLogisticsOrder(orders, (await readAutoparksState().catch(() => null))?.cars ?? [])
      : {};

  return (
    <Suspense>
    <IrissLogistikaClient
      initialOrders={orders}
      initialPoints={points}
      initialPrevious={previous}
      initialSources={sources}
      storeEnabled={storeEnabled}
      viewerName={viewerName}
      canEnableTotp={canEnableTotp}
      canCreateOffer={canCreateOffer}
      canMoveToAutopark={cabinetActorCanWrite(actorQuery)}
      autoparksByOrder={autoparksByOrder}
      showAutoparksLink={autoparksV2CanOpen(autoparksV2Perms(actor))}
      isAdmin={actor.kind === "admin"}
    />
    </Suspense>
  );
}
