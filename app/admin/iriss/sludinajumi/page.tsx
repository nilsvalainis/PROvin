import { Suspense } from "react";
import { IrissSludinajumiListClient } from "@/components/admin/IrissSludinajumiListClient";
import { irissListingMatchKey } from "@/lib/iriss-listing-match";
import { loadIrissSludinajumiPageData, splitGoneListingVehicles } from "@/lib/iriss-sludinajumi-page-data";
import { requireIrissSectionPage } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

export default async function IrissSludinajumiPage() {
  await requireIrissSectionPage("sludinajumi");
  const { storage, view: fullView, dismissed, orders, scanOrders, initialOrderOv, match, matchOrderIds } =
    await loadIrissSludinajumiPageData();
  // Pazudušos (~85% no 6,7 MB) nesūtām lapā; cilne „Pazuduši” tos ielādē pēc pieprasījuma.
  const split = splitGoneListingVehicles(fullView?.vehicles ?? [], { orderOv: initialOrderOv, matchOrderIds });
  const view = fullView ? { ...fullView, vehicles: split.active } : null;

  return (
    <div className="relative min-h-full w-full max-w-none pb-24 sm:pb-8">
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
          <IrissSludinajumiListClient
            latest={view}
            goneCounts={split.goneCounts}
            orders={orders}
            scanOrders={scanOrders}
            dismissed={dismissed}
            initialOrderOv={initialOrderOv}
            matchNotices={match?.notices ?? []}
            matchOrderIds={matchOrderIds}
            matchStatus={Object.fromEntries((match?.state.entries ?? []).map((e) => [irissListingMatchKey(e.orderId, e.listingId), e.status]))}
            duplicatesByListing={match?.duplicatesByListing ?? {}}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
