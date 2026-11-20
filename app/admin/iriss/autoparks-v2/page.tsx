import "./autoparks-v2.css";
import { redirect } from "next/navigation";
import { AutoparksV2List } from "@/components/admin/iriss-autoparks-v2/AutoparksV2List";
import { readAutoparksState } from "@/lib/iriss-autoparks-store";
import { readAutoparksRegistryImportStamp } from "@/lib/iriss-autoparks-registry-dropbox";
import { registryFreshness } from "@/lib/iriss-autoparks-registry-freshness";
import { getAutoparksV2PageActor } from "@/lib/iriss-autoparks-v2-access";
import { autoparksV2ListRows } from "@/lib/iriss-autoparks-v2-list";
import { readAutoparksV2State } from "@/lib/iriss-autoparks-v2-store";
import { carIdsWithActiveLogistics } from "@/lib/iriss-autoparks-transit";
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
  const [v1, v2, registryStamp] = storeEnabled
    ? await Promise.all([readAutoparksState(), readAutoparksV2State(), readAutoparksRegistryImportStamp()])
    : [null, null, null];
  const orders = storeEnabled ? await listLogisticsOrders().catch(() => null) : null;
  // Ātrā pāreja uz Loģistiku (makets 26.10: posms "Ceļā") - tikai ar Loģistikas tiesību.
  const logisticsCount = orders && staffHasLogisticsCabinet(access.actor) ? orders.filter(isLogisticsOrderActive).length : null;
  // P2 (Nils 20.11): «Ceļā» tikai ar aktīvu Loģistikas ierakstu; pārējiem brīdinājums (neko nemaina).
  const activeLogistics = v1 && orders ? carIdsWithActiveLogistics(v1.cars, orders, isLogisticsOrderActive, v2) : undefined;
  const rows = v1 && v2 ? autoparksV2ListRows(v1.cars, v2, { sums: access.perms.summas, vat: access.perms.iegade, activeLogistics }) : [];
  return (
    <AutoparksV2List
      initialCars={rows}
      transitFixHref={access.actor.kind === "admin" && rows.some((r) => r.transitNoLogistics) ? "/admin/iriss/autoparks-v2/cela-bez-logistikas" : null}
      canAddCar={access.perms.pamatdati}
      canSortBySum={access.perms.summas}
      canChangeStatus={access.perms.pamatdati}
      showVat={access.perms.iegade}
      logisticsCount={logisticsCount}
      registryFresh={storeEnabled ? registryFreshness(registryStamp) : null}
    />
  );
}
