import "./iriss-logistika.css";
import { IrissLogistikaClient } from "@/components/admin/iriss-logistika/IrissLogistikaClient";
import { requireAdminPage } from "@/lib/admin-auth";
import {
  getIrissLogisticsStorageState,
  listLogisticsAuctionSources,
  listLogisticsOrders,
  listLogisticsPoints,
  listPreviousLogisticsPoints,
} from "@/lib/iriss-logistics-store";

export const metadata = {
  title: "Loģistika | IRISS",
};

export const dynamic = "force-dynamic";

export default async function IrissLogistikaPage() {
  await requireAdminPage();
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

  return (
    <IrissLogistikaClient
      initialOrders={orders}
      initialPoints={points}
      initialPrevious={previous}
      initialSources={sources}
      storeEnabled={storeEnabled}
    />
  );
}
