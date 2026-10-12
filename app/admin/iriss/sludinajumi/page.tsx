import { Suspense } from "react";
import { IrissSludinajumiListClient } from "@/components/admin/IrissSludinajumiListClient";
import {
  getIrissListingsStorageState,
  readIrissListingsDismissed,
  readIrissListingsLatestView,
} from "@/lib/iriss-listings-aggregate-store";
import { emptyIrissListingsDismissed } from "@/lib/iriss-listings-dismiss";
import { irissListingOrderBrief } from "@/lib/iriss-listings-orders";
import { listIrissPasutijumi } from "@/lib/iriss-pasutijumi-store";
import { irissScanOrderBrief } from "@/lib/iriss-scan-listings";
import { listIrissScan } from "@/lib/iriss-scan-store";

export const dynamic = "force-dynamic";

export default async function IrissSludinajumiPage() {
  const storage = getIrissListingsStorageState();
  // Abi datu kopumi (klientu pasūtījumi + SCAN) ielādējas paralēli; kļūda vienā neaptur otru.
  const [latest, dismissedView, orders, scanOrders] = await Promise.all([
    storage.enabled ? readIrissListingsLatestView() : Promise.resolve(null),
    storage.enabled ? readIrissListingsDismissed() : Promise.resolve(emptyIrissListingsDismissed()),
    listIrissPasutijumi().then((rows) => rows.map(irissListingOrderBrief)).catch(() => []),
    listIrissScan().then((rows) => rows.map(irissScanOrderBrief)).catch(() => []),
  ]);
  const dismissed = dismissedView.entries;

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

      {storage.enabled ? (
        <Suspense fallback={null}>
          <IrissSludinajumiListClient latest={latest} orders={orders} scanOrders={scanOrders} dismissed={dismissed} />
        </Suspense>
      ) : null}
    </div>
  );
}
