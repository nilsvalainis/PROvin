import { Suspense } from "react";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { AdminDealerCheckPage } from "@/components/admin/AdminDealerCheckPage";
import { requireAdminPage } from "@/lib/admin-auth";
import { parseDealerCheckSearchVin } from "@/lib/dealer-check";

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
  const initialVin = parseDealerCheckSearchVin(sp?.vin ?? "");
  const initialPlate = (sp?.vn ?? "").trim();
  const fromAutoparks = sp?.no === "autoparks";
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
        <AdminDealerCheckPage initialVin={initialVin} initialPlate={initialPlate} fromAutoparks={fromAutoparks} />
      </Suspense>
    </div>
  );
}
