import { requireAdminPage } from "@/lib/admin-auth";
import { AdminDealerCheckServerPage, type DealerCheckSearchParams } from "@/components/admin/AdminDealerCheckServerPage";
import { DEALER_CHECK_IRISS_PAGE_PATH } from "@/lib/dealer-check";

export const metadata = {
  title: "Dīlera dati | IRISS",
};

export const dynamic = "force-dynamic";

/** Tā pati «Dīlera dati» lapa IRISS izvēlnē - tikai adminiem. */
export default async function IrissDealerCheckRoute({ searchParams }: { searchParams?: Promise<DealerCheckSearchParams> }) {
  await requireAdminPage();
  return <AdminDealerCheckServerPage searchParams={searchParams} basePath={DEALER_CHECK_IRISS_PAGE_PATH} />;
}
