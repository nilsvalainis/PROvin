import "./autoparks-v2.css";
import { redirect } from "next/navigation";
import { AutoparksV2List } from "@/components/admin/iriss-autoparks-v2/AutoparksV2List";
import { readAutoparksState } from "@/lib/iriss-autoparks-store";
import { getAutoparksV2PageActor } from "@/lib/iriss-autoparks-v2-access";
import { autoparksV2ListRows } from "@/lib/iriss-autoparks-v2-list";
import { readAutoparksV2State } from "@/lib/iriss-autoparks-v2-store";
import { getIrissLogisticsStorageState } from "@/lib/iriss-logistics-store";

export const metadata = { title: "Autoparks | IRISS" };
export const dynamic = "force-dynamic";

/** Autoparks v2 saraksts (aiz karoga: darbiniekiem tikai ar IRISS_AUTOPARKS_V2_STAFF=1 un ap_pamatdati). */
export default async function AutoparksV2Page() {
  const access = await getAutoparksV2PageActor();
  if (!access) redirect("/admin/iriss");
  if (!access.perms.pamatdati) redirect("/admin/iriss");
  const storeEnabled = getIrissLogisticsStorageState().enabled;
  const [v1, v2] = storeEnabled ? await Promise.all([readAutoparksState(), readAutoparksV2State()]) : [null, null];
  return <AutoparksV2List initialCars={v1 && v2 ? autoparksV2ListRows(v1.cars, v2) : []} />;
}
