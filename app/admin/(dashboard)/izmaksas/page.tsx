import { AdminCostsView } from "@/components/admin/AdminCostsView";
import { requireAdminPage } from "@/lib/admin-auth";
import { resolveCostMonth } from "@/lib/admin-costs";
import { loadCostDashboard } from "@/lib/admin-costs-load";

export const metadata = {
  title: "Izmaksas",
};

export const dynamic = "force-dynamic";

export default async function AdminIzmaksasPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  await requireAdminPage();
  const q = await searchParams;
  const month = resolveCostMonth(q.m);
  const { dashboard } = await loadCostDashboard(month);
  return <AdminCostsView dashboard={dashboard} workspace="pro" />;
}
