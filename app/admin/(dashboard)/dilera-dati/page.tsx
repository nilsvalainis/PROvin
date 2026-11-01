import { Suspense } from "react";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { AdminDealerCheckPage } from "@/components/admin/AdminDealerCheckPage";
import { requireAdminPage } from "@/lib/admin-auth";
import { parseDealerCheckSearchPlate, parseDealerCheckSearchVin } from "@/lib/dealer-check";
import { prefetchDealerCheckCsdd } from "@/lib/dealer-check-csdd-prefetch";

export const metadata = {
  title: "Dīlera datu pārbaude",
};

export const dynamic = "force-dynamic";

export default async function AdminDealerCheckRoute({
  searchParams,
}: {
  searchParams?: Promise<{ vin?: string; no?: string; vn?: string }>;
}) {
  await requireAdminPage();
  const sp = searchParams ? await searchParams : undefined;
  const searchVin = parseDealerCheckSearchVin(sp?.vin ?? "");
  const searchPlate = parseDealerCheckSearchPlate(sp?.vn ?? "");
  const fromAutoparks = sp?.no === "autoparks";
  const prefetched = await prefetchDealerCheckCsdd({ vin: searchVin, plate: searchPlate });
  return (
    <div className="w-full max-w-none">
      <AdminDashboardHeaderWithMenu
        hideOnPhone
        mobileTitle="Dīlera datu pārbaude"
        mobileSubtitle="Iekšējā · bez klienta pasūtījuma · ADMIN"
      >
        {null}
      </AdminDashboardHeaderWithMenu>
      <Suspense fallback={<p className="text-[12px] text-[#86868b]">Ielādē…</p>}>
        <AdminDealerCheckPage
          initialVin={prefetched.vin || searchVin}
          initialPlate={prefetched.plate || searchPlate}
          initialCsdd={prefetched.csdd}
          initialCsddMessage={prefetched.message}
          fromAutoparks={fromAutoparks}
        />
      </Suspense>
    </div>
  );
}
