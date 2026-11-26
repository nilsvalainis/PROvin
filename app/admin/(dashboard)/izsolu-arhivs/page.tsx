import { AdminMobileIcon } from "@/components/admin/mobile/AdminMobileIcon";
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
    <div className="amx amx-pg amx-pg--arhivs w-full max-w-none">
      <AdminDashboardHeaderWithMenu
        mobileTitle="Izsoļu arhīvs"
        mobileTrailing={
          // Telefonā meklēšana - ikona galvenē (22.11 makets v2): aizved uz VIN meklēšanu lapā.
          <a href="#izsolu-meklesana" aria-label="Meklēt VIN" className="am-press grid h-11 w-11 place-items-center rounded-full bg-[var(--fill-secondary)] text-[var(--label)]">
            <AdminMobileIcon name="meklet" className="h-[18px] w-[18px]" />
          </a>
        }
      >
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
                cachedStatus: thecarapi.cache?.status ?? "",
                cachedAt: thecarapi.cache?.cachedAt ?? "",
                cacheHasDetail: thecarapi.cacheHasDetail,
                records: thecarapi.records,
              }
            : null
        }
      />
    </div>
  );
}
