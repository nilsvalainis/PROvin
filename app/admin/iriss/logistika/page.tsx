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

  return (
    <IrissLogistikaClient
      initialOrders={orders}
      initialPoints={points}
      initialPrevious={previous}
      initialSources={sources}
      storeEnabled={storeEnabled}
      viewerName={viewerName}
      canEnableTotp={canEnableTotp}
    />
  );
}
