import { IrissPavadzimesListClient } from "@/components/admin/IrissPavadzimesListClient";
import { loadIrissPavadzimesPageData } from "@/lib/iriss-pavadzimes-list";
import { requireIrissSectionPage } from "@/lib/staff-auth";

export const metadata = { title: "Pavadzīmes" };
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export default async function IrissPavadzimesPage() {
  await requireIrissSectionPage("pavadzimes");
  let data: Awaited<ReturnType<typeof loadIrissPavadzimesPageData>>;
  try {
    data = await loadIrissPavadzimesPageData();
  } catch {
    data = { rows: [], pendingParse: 0, dropboxConfigured: false, dropboxError: "Neizdevās ielādēt" };
  }

  return (
    <div className="relative min-h-full w-full max-w-none pb-24 sm:pb-8">
      <IrissPavadzimesListClient initial={data} />
    </div>
  );
}
