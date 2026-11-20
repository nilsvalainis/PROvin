import "../autoparks-v2.css";
import { redirect } from "next/navigation";
import { AutoparksV2TransitFix } from "@/components/admin/iriss-autoparks-v2/AutoparksV2TransitFix";
import { listTransitWithoutLogistics, transitFixAdminOf } from "@/lib/iriss-autoparks-transit-fix";
import { getAdminOrStaffActor } from "@/lib/staff-auth";
import { getIrissLogisticsStorageState } from "@/lib/iriss-logistics-store";

export const metadata = { title: "Ceļā bez Loģistikas | IRISS" };
export const dynamic = "force-dynamic";

/** P2 (Nils 20.11, 4A): saraksts Nila apstiprināšanai; pārcelšana tikai ar admina klikšķi + apstiprinājumu. */
export default async function CelaBezLogistikasPage() {
  const actor = await getAdminOrStaffActor();
  if (!transitFixAdminOf(actor)) redirect("/admin/iriss/autoparks-v2");
  const rows = getIrissLogisticsStorageState().enabled ? (await listTransitWithoutLogistics()).rows : [];
  return <AutoparksV2TransitFix initialRows={rows} />;
}
