import { Suspense } from "react";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { AdminDealerCheckPage } from "@/components/admin/AdminDealerCheckPage";
import { requireAdminPage } from "@/lib/admin-auth";
import { currentDealerCheckCreatorId } from "@/lib/dealer-check-actor";
import {
  isSafeDealerCheckId,
  parseDealerCheckSearchPlate,
  parseDealerCheckSearchVin,
  type DealerCheckRecord,
} from "@/lib/dealer-check";
import { prefetchDealerCheckCsdd } from "@/lib/dealer-check-csdd-prefetch";
import type { DealerCheckHistoryEntry } from "@/lib/dealer-check-history";
import { listDealerCheckEntries, readOwnedDealerCheck } from "@/lib/dealer-check-store";

export const metadata = {
  title: "Dīlera datu pārbaude",
};

export const dynamic = "force-dynamic";

export default async function AdminDealerCheckRoute({
  searchParams,
}: {
  searchParams?: Promise<{ vin?: string; no?: string; vn?: string; id?: string }>;
}) {
  await requireAdminPage();
  const sp = searchParams ? await searchParams : undefined;
  const initialId = isSafeDealerCheckId(sp?.id ?? "") ? (sp?.id ?? "") : "";
  let saved: DealerCheckRecord | null = null;
  let initialEntries: DealerCheckHistoryEntry[] = [];
  try {
    const creator = await currentDealerCheckCreatorId();
    initialEntries = await listDealerCheckEntries(creator);
    if (initialId) saved = await readOwnedDealerCheck(initialId, creator);
  } catch {
    saved = null;
    initialEntries = [];
  }
  const searchVin = saved?.vin || parseDealerCheckSearchVin(sp?.vin ?? "");
  const searchPlate = saved?.plate || parseDealerCheckSearchPlate(sp?.vn ?? "");
  const fromAutoparks = !saved && sp?.no === "autoparks";
  const prefetched = saved?.csddSnapshot
    ? { vin: searchVin, plate: searchPlate, csdd: saved.csddSnapshot, message: "" }
    : await prefetchDealerCheckCsdd({ vin: searchVin, plate: searchPlate });
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
          initialRecord={saved}
          initialEntries={initialEntries}
        />
      </Suspense>
    </div>
  );
}
