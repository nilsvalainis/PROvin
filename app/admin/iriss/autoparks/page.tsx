import "./iriss-autoparks.css";
import { IrissAutoparksClient } from "@/components/admin/iriss-autoparks/IrissAutoparksClient";
import { autoparksListRows } from "@/lib/iriss-autoparks";
import { autoparksHidesSums, autoparksRowsForActor } from "@/lib/iriss-autoparks-access";
import { readAutoparksState } from "@/lib/iriss-autoparks-store";
import { logisticsCabinetWriteForbidden } from "@/lib/iriss-logistics-access";
import { getIrissLogisticsStorageState } from "@/lib/iriss-logistics-store";
import { redirect } from "next/navigation";
import { autoparksV2Perms } from "@/lib/iriss-autoparks-v2-access";
import { autoparksV2StaffEnabled, shouldRedirectToAutoparksV2 } from "@/lib/iriss-autoparks-v2-flag";
import { requireLogisticsPage } from "@/lib/staff-auth";

export const metadata = {
  title: "Autoparks | IRISS",
};

export const dynamic = "force-dynamic";

export default async function IrissAutoparksPage({ searchParams }: { searchParams: Promise<{ v1?: string }> }) {
  const actor = await requireLogisticsPage();
  // F9: pēc pārslēgšanas (karogs) šī saite ved uz Autoparks v2; v1 rezerve - `?v1=1`.
  const { v1 } = await searchParams;
  if (shouldRedirectToAutoparksV2({ staffEnabled: autoparksV2StaffEnabled(), canOpenV2List: autoparksV2Perms(actor).pamatdati, v1Param: v1 })) {
    redirect("/admin/iriss/autoparks-v2");
  }
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
