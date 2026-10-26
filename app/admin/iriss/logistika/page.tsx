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

export const metadata = {
  title: "Loģistika | IRISS",
};

export const dynamic = "force-dynamic";

export default async function IrissLogistikaPage() {
  const actor = await requireLogisticsPage();
  const storage = getIrissLogisticsStorageState();
  const storeEnabled = storage.enabled;
  const [orders, points, previous, sources] = storeEnabled
    ? await Promise.all([
        listLogisticsOrders(),
        listLogisticsPoints(),
        listPreviousLogisticsPoints(),
        listLogisticsAuctionSources(),
      ])
    : [[], [], [], []];
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
      autoparksByOrder={autoparksByOrder}
    />
    </Suspense>
  );
}
