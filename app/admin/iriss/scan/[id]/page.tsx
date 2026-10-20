import { notFound, redirect } from "next/navigation";
import { IrissScanListClient } from "@/components/admin/IrissScanListClient";
import { loadIrissScanPageData } from "@/lib/iriss-scan-page-data";
import { isIrissScanStoreEnabled, isSafeIrissScanId, readIrissScanWithRetry } from "@/lib/iriss-scan-store";
import { requireIrissSectionPage } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function IrissScanDetailPage({ params }: Props) {
  await requireIrissSectionPage("radars");
  if (!isIrissScanStoreEnabled()) {
    redirect("/admin/iriss/scan");
  }
  const { id } = await params;
  if (!isSafeIrissScanId(id)) notFound();
  const rec = await readIrissScanWithRetry(id);
  if (!rec) notFound();
  const data = await loadIrissScanPageData();
  return (
    <div className="relative min-h-full w-full max-w-none pb-24 sm:pb-8">
      <IrissScanListClient
        rows={data.rows}
        initialListOrder={data.initialListOrder}
        newHitsByScan={data.newHitsByScan}
        finds={data.finds}
        selectedRecord={rec}
        mode="edit"
      />
    </div>
  );
}
