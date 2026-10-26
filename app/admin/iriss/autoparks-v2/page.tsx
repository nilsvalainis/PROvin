import "./autoparks-v2.css";
import { redirect } from "next/navigation";
import { AutoparksV2List } from "@/components/admin/iriss-autoparks-v2/AutoparksV2List";
import { readAutoparksState } from "@/lib/iriss-autoparks-store";
import { getAutoparksV2PageActor } from "@/lib/iriss-autoparks-v2-access";
import { autoparksV2ListRows } from "@/lib/iriss-autoparks-v2-list";
import { readAutoparksV2State } from "@/lib/iriss-autoparks-v2-store";
import { isLogisticsOrderActive } from "@/lib/iriss-logistics-archive";
import { getIrissLogisticsStorageState, listLogisticsOrders } from "@/lib/iriss-logistics-store";
import { staffHasLogisticsCabinet } from "@/lib/staff-auth";

export const metadata = { title: "Autoparks | IRISS" };
export const dynamic = "force-dynamic";

/**
 * Autoparks v2 saraksts (aiz karoga: darbiniekiem tikai ar IRISS_AUTOPARKS_V2_STAFF=1 un kādu `ap_*` ar lapu).
 * j69: sarakstu atver ikviena kabineta tiesība (piem. tikai Serviss) - agrāk bez Pamatdatiem pāradresēja uz
 * sākumu, un cilne "Autoparks" izskatījās pēc lapas atjaunošanas. Jaunu auto pievieno tikai ar Pamatdatiem.
 */
export default async function AutoparksV2Page() {
  const access = await getAutoparksV2PageActor();
  if (!access) redirect("/admin/iriss");
  const storeEnabled = getIrissLogisticsStorageState().enabled;
  const [v1, v2] = storeEnabled ? await Promise.all([readAutoparksState(), readAutoparksV2State()]) : [null, null];
  // Ātrā pāreja uz Loģistiku (makets 26.10: posms "Ceļā") - tikai ar Loģistikas tiesību.
  const logisticsCount =
    storeEnabled && staffHasLogisticsCabinet(access.actor) ? (await listLogisticsOrders()).filter(isLogisticsOrderActive).length : null;
  return (
    <AutoparksV2List
      initialCars={v1 && v2 ? autoparksV2ListRows(v1.cars, v2) : []}
      canAddCar={access.perms.pamatdati}
      logisticsCount={logisticsCount}
    />
  );
}
