import "@/components/iriss-piedavajumi/piedavajumi.css";
import { PiedavajumsNew } from "@/components/admin/iriss-piedavajumi/PiedavajumsNew";
import { readAutoparksState } from "@/lib/iriss-autoparks-store";
import { irissPdCarPicks } from "@/lib/iriss-piedavajumi";
import { requireAdminPage } from "@/lib/admin-auth";
import { listIrissPdRows } from "@/lib/iriss-piedavajumi-store";

export const metadata = { title: "Jauns piedāvājums | IRISS" };
export const dynamic = "force-dynamic";

export default async function IrissPiedavajumsNewPage() {
  await requireAdminPage();
  const [state, rows] = await Promise.all([readAutoparksState().catch(() => null), listIrissPdRows().catch(() => [])]);
  return <PiedavajumsNew cars={state ? irissPdCarPicks(state.cars, rows) : []} carsError={state ? "" : "Autoparku neizdevās ielādēt."} />;
}
