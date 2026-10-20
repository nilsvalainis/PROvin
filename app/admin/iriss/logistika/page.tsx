import "./iriss-logistika.css";
import { IrissLogistikaClient } from "@/components/admin/iriss-logistika/IrissLogistikaClient";
import { requireAdminPage } from "@/lib/admin-auth";
import {
  getIrissLogisticsStorageState,
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
  const [orders, points, previous] = storeEnabled
    ? await Promise.all([listLogisticsOrders(), listLogisticsPoints(), listPreviousLogisticsPoints()])
    : [[], [], []];

  return (
    <IrissLogistikaClient
      initialOrders={orders}
      initialPoints={points}
      initialPrevious={previous}
      storeEnabled={storeEnabled}
    />
  );
}
