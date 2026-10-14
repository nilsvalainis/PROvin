import { redirect } from "next/navigation";
import { IrissScanListClient } from "@/components/admin/IrissScanListClient";
import { IrissScanNewFab } from "@/components/admin/IrissScanNewFab";
import { getIrissScanStorageState, listIrissScan, readIrissScanListOrder } from "@/lib/iriss-scan-store";
import { irissScanVinFromQuery } from "@/lib/iriss-scan-vin";

export const dynamic = "force-dynamic";

export default async function IrissScanListPage({
  searchParams,
}: {
  searchParams?: Promise<{ vin?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const vin = irissScanVinFromQuery(sp.vin);
  if (vin) {
    redirect(`/admin/iriss/scan/new?vin=${encodeURIComponent(vin)}`);
  }
  const storage = getIrissScanStorageState();
  const storeEnabled = storage.enabled;
  const [rows, initialListOrder] = storeEnabled ? await Promise.all([listIrissScan(), readIrissScanListOrder()]) : [[], null];

  return (
    <div className="relative min-h-full w-full max-w-none bg-[#F8F8F9] pb-24 sm:pb-8">
      {storeEnabled && rows.length > 0 ? <IrissScanListClient rows={rows} initialListOrder={initialListOrder} /> : null}
      {storeEnabled && rows.length === 0 ? (
        <div className="mx-auto mt-10 max-w-sm px-6 text-center">
          <p className="text-[17px] font-semibold text-[var(--color-apple-text)]">Nav radara ierakstu</p>
          <p className="mt-1 text-[13px] text-[#8e8e93]">Spied „+”, lai izveidotu pirmo ierakstu.</p>
        </div>
      ) : null}
      {storeEnabled && rows.length === 0 ? <IrissScanNewFab /> : null}
      {!storeEnabled ? (
        <div className="mt-3 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3.5 text-sm text-black shadow-sm">
          <p className="font-semibold">Radara melnraksts ir izslēgts</p>
          {storage.reason === "vercel_blob_token_missing" ? (
            <p className="mt-1.5 text-amber-900/90">
              Vercel vidē JSON tiek glabāti <span className="font-semibold">Vercel Blob</span>. Pievienojiet projektam mainīgo{" "}
              <code className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-xs">BLOB_READ_WRITE_TOKEN</code> (Storage → Blob → savienot ar
              projektu) vai norādiet rakstāmu ceļu ar{" "}
              <code className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-xs">ADMIN_IRISS_SCAN_DIR</code>{" "}
              <span className="text-black/80">(tikai ceļš zem `os.tmpdir()` deploy vidē, ja nav Blob).</span>
            </p>
          ) : (
            <p className="mt-1.5 text-amber-900/90">
              Iestatiet <code className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-xs">ADMIN_IRISS_SCAN_DIR</code> vai noņemiet atspējošanu
              (vērtība <span className="font-mono">0</span> / <span className="font-mono">off</span>).
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
