import { IrissSludinajumiListClient } from "@/components/admin/IrissSludinajumiListClient";
import { getIrissListingsStorageState, readIrissListingsLatestView } from "@/lib/iriss-listings-aggregate-store";

export const dynamic = "force-dynamic";

export default async function IrissSludinajumiPage() {
  const storage = getIrissListingsStorageState();
  const latest = storage.enabled ? await readIrissListingsLatestView() : null;

  return (
    <div className="relative min-h-full w-full max-w-none bg-[#F8F8F9] pb-24 sm:pb-8">
      {!storage.enabled ? (
        <section className="mt-3 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3.5 text-sm text-black shadow-sm">
          <p className="font-semibold">Sludinājumu agregācija ir izslēgta</p>
          {storage.reason === "vercel_blob_token_missing" ? (
            <p className="mt-1.5 text-amber-900/90">
              Vercel vidē nepieciešams <code className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-xs">BLOB_READ_WRITE_TOKEN</code>
              , vai arī iestatiet ceļu ar{" "}
              <code className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-xs">ADMIN_IRISS_LISTINGS_DIR</code>.
            </p>
          ) : (
            <p className="mt-1.5 text-amber-900/90">
              Aktivizējiet storage ar{" "}
              <code className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-xs">ADMIN_IRISS_LISTINGS_DIR</code> vai noņemiet `off`.
            </p>
          )}
        </section>
      ) : null}

      {storage.enabled ? <IrissSludinajumiListClient latest={latest} /> : null}
    </div>
  );
}
