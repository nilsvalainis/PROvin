import "../autoparks-v2.css";
import { redirect } from "next/navigation";
import { AutoparksV2TransitFix } from "@/components/admin/iriss-autoparks-v2/AutoparksV2TransitFix";
import { getTransitFixAdmin, listTransitWithoutLogistics } from "@/lib/iriss-autoparks-transit-fix";
import { getIrissLogisticsStorageState } from "@/lib/iriss-logistics-store";

export const metadata = { title: "Ceļā bez Loģistikas | IRISS" };
export const dynamic = "force-dynamic";

/** P2 (Nils 20.11, 4A): saraksts Nila apstiprināšanai; pārcelšana tikai ar admina klikšķi + apstiprinājumu. */
export default async function CelaBezLogistikasPage() {
  if (!(await getTransitFixAdmin())) redirect("/admin/iriss/autoparks-v2");
  const rows = getIrissLogisticsStorageState().enabled ? (await listTransitWithoutLogistics()).rows : [];
  return <AutoparksV2TransitFix initialRows={rows} />;
}
