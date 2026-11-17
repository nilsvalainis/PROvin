import { AdminAuctionArchiveClient } from "@/components/admin/AdminAuctionArchiveClient";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { requireAdminPage } from "@/lib/admin-auth";
import { normalizeVin } from "@/lib/order-field-validation";
import { thecarapiAdminStatus } from "@/lib/thecarapi-cc-vin";

export const metadata = {
  title: "Izsoļu portālu arhīvs",
};

export const dynamic = "force-dynamic";

export default async function AdminAuctionArchivePage({
  searchParams,
}: {
  searchParams?: Promise<{ vin?: string }>;
}) {
  await requireAdminPage();
  const sp = searchParams ? await searchParams : undefined;
  const initialVin = normalizeVin(sp?.vin ?? "");
  const thecarapi = initialVin ? await thecarapiAdminStatus(initialVin).catch(() => null) : null;
  return (
    <div className="w-full max-w-none">
      <AdminDashboardHeaderWithMenu mobileTitle="Izsoļu portālu arhīvs">
        <h1 className="text-[1.35rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)] sm:text-[1.5rem]">
          Izsoļu portālu arhīvs
        </h1>
      </AdminDashboardHeaderWithMenu>
      <AdminAuctionArchiveClient
        initialVin={initialVin}
        thecarapi={
          thecarapi
            ? {
                enabled: thecarapi.enabled,
                used: thecarapi.used,
                cap: thecarapi.cap,
                cachedSummary: thecarapi.cache?.summary ?? "",
                cacheHasDetail: thecarapi.cacheHasDetail,
                records: thecarapi.records,
              }
            : null
        }
      />
    </div>
  );
}
