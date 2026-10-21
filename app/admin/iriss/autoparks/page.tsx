import "./iriss-autoparks.css";
import { IrissAutoparksClient } from "@/components/admin/iriss-autoparks/IrissAutoparksClient";
import { autoparksListRows } from "@/lib/iriss-autoparks";
import { autoparksHidesSums, autoparksRowsForActor } from "@/lib/iriss-autoparks-access";
import { readAutoparksState } from "@/lib/iriss-autoparks-store";
import { logisticsCabinetWriteForbidden } from "@/lib/iriss-logistics-access";
import { getIrissLogisticsStorageState } from "@/lib/iriss-logistics-store";
import { requireLogisticsPage } from "@/lib/staff-auth";

export const metadata = {
  title: "Autoparks | IRISS",
};

export const dynamic = "force-dynamic";

export default async function IrissAutoparksPage() {
  const actor = await requireLogisticsPage();
  const storeEnabled = getIrissLogisticsStorageState().enabled;
  const hideSums = autoparksHidesSums(actor);
  const rows = storeEnabled ? autoparksListRows(await readAutoparksState()) : [];
  return (
    <IrissAutoparksClient
      initialCars={autoparksRowsForActor(rows, hideSums)}
      storeEnabled={storeEnabled}
      hideSums={hideSums}
      canWrite={logisticsCabinetWriteForbidden(actor) === null}
    />
  );
}
