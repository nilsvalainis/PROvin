import "@/components/iriss-piedavajumi/piedavajumi.css";
import { PiedavajumiList } from "@/components/admin/iriss-piedavajumi/PiedavajumiList";
import { requireAdminPage } from "@/lib/admin-auth";
import { isIrissPdStoreEnabled, listIrissPdRows, refreshIrissPdExpiries } from "@/lib/iriss-piedavajumi-store";

export const metadata = { title: "Piedāvājumi | IRISS" };
export const dynamic = "force-dynamic";

export default async function IrissPiedavajumiPage() {
  await requireAdminPage();
  const enabled = isIrissPdStoreEnabled();
  let rows = [] as Awaited<ReturnType<typeof listIrissPdRows>>;
  let loadError = "";
  if (enabled) {
    try {
      await refreshIrissPdExpiries(Date.now());
      rows = await listIrissPdRows();
    } catch (e) {
      loadError = e instanceof Error ? e.message : "Neizdevās ielādēt piedāvājumus.";
    }
  }
  return <PiedavajumiList rows={rows} nowMs={Date.now()} storeEnabled={enabled} loadError={loadError} />;
}
