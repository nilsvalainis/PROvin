import { redirect } from "next/navigation";
import { IrissPavadzimesListClient } from "@/components/admin/IrissPavadzimesListClient";
import { IrissVpnControl } from "@/components/admin/IrissVpnControl";
import { canSeeWaybillOrders, loadIrissPavadzimesPageData } from "@/lib/iriss-pavadzimes-list";
import { requireIrissSectionPage } from "@/lib/staff-auth";
import { isWaybillOnlyStaff } from "@/lib/staff-roles";

export const metadata = { title: "Pavadzīmes" };
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export default async function IrissPavadzimesPage() {
  const actor = await requireIrissSectionPage("pavadzimes");
  // Partneris (tikai Pavadzīmes): vienīgais ekrāns ir IRISS sākums ar pavadzīmju logrīku.
  if (actor.kind === "staff" && isWaybillOnlyStaff(actor.user.sections)) redirect("/admin/iriss");
  const isAdmin = actor.kind === "admin";
  let data: Awaited<ReturnType<typeof loadIrissPavadzimesPageData>>;
  try {
    data = await loadIrissPavadzimesPageData(new Date(), { withOrders: canSeeWaybillOrders(actor), sync: false });
  } catch {
    data = { rows: [], pendingParse: 0, dropboxConfigured: false, dropboxError: "Neizdevās ielādēt" };
  }

  return (
    <div className="relative min-h-full w-full max-w-none pb-24 sm:pb-8">
      {/* Datorā VPN paliek augšā; telefonā tas ir lapas apakšā kā liela kartīte (IrissPavadzimesListClient). Tikai administratoram. */}
      {isAdmin ? (
        <div className="mb-2 max-md:hidden">
          <IrissVpnControl />
        </div>
      ) : null}
      <IrissPavadzimesListClient initial={data} isAdmin={isAdmin} />
    </div>
  );
}
