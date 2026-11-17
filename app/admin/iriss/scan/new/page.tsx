import { redirect } from "next/navigation";
import { IrissScanListClient } from "@/components/admin/IrissScanListClient";
import { loadIrissScanPageData } from "@/lib/iriss-scan-page-data";
import { isIrissScanStoreEnabled } from "@/lib/iriss-scan-store";
import { emptyIrissScanRecord } from "@/lib/iriss-scan-types";
import { irissScanVinFromQuery } from "@/lib/iriss-scan-vin";
import { requireIrissSectionPage } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

export default async function IrissScanNewPage({
  searchParams,
}: {
  searchParams?: Promise<{ vin?: string }>;
}) {
  await requireIrissSectionPage("radars");
  if (!isIrissScanStoreEnabled()) {
    redirect("/admin/iriss/scan");
  }
  const sp = (await searchParams) ?? {};
  const rec = emptyIrissScanRecord(crypto.randomUUID(), new Date().toISOString());
  rec.vin = irissScanVinFromQuery(sp.vin);
  const data = await loadIrissScanPageData();
  return (
    <div className="relative min-h-full w-full max-w-none pb-24 sm:pb-8">
      <IrissScanListClient
        rows={data.rows}
        initialListOrder={data.initialListOrder}
        newHitsByScan={data.newHitsByScan}
        finds={data.finds}
        lastReadAt={data.lastReadAt}
        selectedRecord={rec}
        unsavedDraft
        mode="edit"
      />
    </div>
  );
}
