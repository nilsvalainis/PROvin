import { IrissScanListClient } from "@/components/admin/IrissScanListClient";
import { IrissScanNewFab } from "@/components/admin/IrissScanNewFab";
import { isIrissScanStoreEnabled, listIrissScan, readIrissScanListOrder } from "@/lib/iriss-scan-store";

export const dynamic = "force-dynamic";

export default async function IrissScanListPage() {
  const storeEnabled = isIrissScanStoreEnabled();
  const [rows, initialListOrder] = storeEnabled ? await Promise.all([listIrissScan(), readIrissScanListOrder()]) : [[], null];

  return (
    <div className="relative min-h-full w-full max-w-none bg-[#F8F8F9] pb-24 sm:pb-8">
      {storeEnabled && rows.length > 0 ? <IrissScanListClient rows={rows} initialListOrder={initialListOrder} /> : null}
      {storeEnabled && rows.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-[#E5E7EB] bg-white px-6 py-12 text-center shadow-sm">
          <p className="font-medium text-black">Nav SCAN ierakstu</p>
          <p className="mt-2 text-sm text-black">Lai izveidotu pirmo ierakstu, spied pogu zemāk vai peldošo „+” apakšējā labajā stūrī.</p>
          <IrissScanNewFab withEmptyCardProminence />
        </div>
      ) : null}
      {!storeEnabled ? (
        <div className="mt-3 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3.5 text-sm text-black shadow-sm">
          <p className="font-semibold">SCAN melnraksts ir izslēgts</p>
          <p className="mt-1.5 text-amber-900/90">Iestatiet `ADMIN_IRISS_SCAN_DIR` vai noņemiet atspējošanu.</p>
        </div>
      ) : null}
    </div>
  );
}
