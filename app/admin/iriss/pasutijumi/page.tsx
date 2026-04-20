import { IrissPasutijumiListClient } from "@/components/admin/IrissPasutijumiListClient";
import { IrissPasutijumiNewFab } from "@/components/admin/IrissPasutijumiNewFab";
import { getIrissPasutijumiStorageState, listIrissPasutijumi } from "@/lib/iriss-pasutijumi-store";

export const dynamic = "force-dynamic";

export default async function IrissPasutijumiListPage() {
  const storage = getIrissPasutijumiStorageState();
  const storeEnabled = storage.enabled;
  const rows = storeEnabled ? await listIrissPasutijumi() : [];

  return (
    <div className="relative w-full max-w-none pb-24 sm:pb-8">
      {!storeEnabled ? (
        <div className="mt-3 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3.5 text-sm text-black shadow-sm">
          <p className="font-semibold">Melnraksts ir izslēgts</p>
          {storage.reason === "vercel_blob_token_missing" ? (
            <p className="mt-1.5 text-amber-900/90">
              Vercel vidē JSON tiek glabāti <span className="font-semibold">Vercel Blob</span>. Pievienojiet projektam
              mainīgo{" "}
              <code className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-xs">BLOB_READ_WRITE_TOKEN</code>{" "}
              (Storage → Blob → savienot ar projektu) vai norādiet rakstāmu ceļu ar{" "}
              <code className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-xs">ADMIN_IRISS_PASUTIJUMI_DIR</code>.
            </p>
          ) : (
            <p className="mt-1.5 text-amber-900/90">
              Iestatiet mapes ceļu vai noņemiet atspējošanu:{" "}
              <code className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-xs">ADMIN_IRISS_PASUTIJUMI_DIR</code>{" "}
              (lokāli noklusējums: <span className="font-mono">.data/iriss-pasutijumi</span> projekta saknē).
            </p>
          )}
        </div>
      ) : null}

      {storeEnabled && rows.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-[#E5E7EB] bg-white px-6 py-12 text-center shadow-sm">
          <p className="font-medium text-black">Nav pasūtījumu</p>
          <p className="mt-2 text-sm text-black">Spied „+”, lai izveidotu pirmo ierakstu.</p>
        </div>
      ) : null}

      {storeEnabled && rows.length > 0 ? (
        <IrissPasutijumiListClient rows={rows} />
      ) : null}

      {storeEnabled && rows.length === 0 ? <IrissPasutijumiNewFab /> : null}
    </div>
  );
}
