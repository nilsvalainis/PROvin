import { IrissPavadzimesListClient } from "@/components/admin/IrissPavadzimesListClient";
import { IrissVpnControl } from "@/components/admin/IrissVpnControl";
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
      {/* Datorā VPN paliek augšā; telefonā tas ir lapas apakšā kā liela kartīte (IrissPavadzimesListClient). */}
      <div className="mb-2 max-md:hidden">
        <IrissVpnControl />
      </div>
      <IrissPavadzimesListClient initial={data} />
    </div>
  );
}
