import "@/components/iriss-piedavajumi/piedavajumi.css";
import { PiedavajumiList } from "@/components/admin/iriss-piedavajumi/PiedavajumiList";
import { irissPdRowsForDisplay } from "@/lib/iriss-piedavajumi-list-rows";
import { irissPdRowsForViewer, irissPdViewerFromActor } from "@/lib/iriss-piedavajumi-staff";
import { isIrissPdStoreEnabled, listIrissPdRows, readIrissPd, refreshIrissPdExpiries } from "@/lib/iriss-piedavajumi-store";
import { requireIrissSectionPage } from "@/lib/staff-auth";

export const metadata = { title: "Piedāvājumi | IRISS" };
export const dynamic = "force-dynamic";

/** P4 (Nils 20.11): arī darbiniekam ar Pasūtījumiem - «Mani» pēc noklusējuma, «Visi» tikai skatīšanai, bez avota. */
export default async function IrissPiedavajumiPage() {
  const viewer = irissPdViewerFromActor(await requireIrissSectionPage("pasutijumi"));
  const enabled = isIrissPdStoreEnabled();
  let rows = [] as Awaited<ReturnType<typeof listIrissPdRows>>;
  let loadError = "";
  if (enabled) {
    try {
      await refreshIrissPdExpiries(Date.now());
      rows = irissPdRowsForViewer(await irissPdRowsForDisplay(await listIrissPdRows(), readIrissPd), viewer);
    } catch (e) {
      loadError = e instanceof Error ? e.message : "Neizdevās ielādēt piedāvājumus.";
    }
  }
  return (
    <PiedavajumiList
      rows={rows}
      nowMs={Date.now()}
      storeEnabled={enabled}
      loadError={loadError}
      viewer={viewer.kind === "admin" ? { kind: "admin", id: viewer.id } : { kind: "staff", id: viewer.id }}
    />
  );
}
