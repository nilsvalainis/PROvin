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
  // Telefonā stikla stils (22.11 makets v2); IRISS izmaksu lapa (/admin/iriss/izmaksas) nemainās.
  return (
    <div className="amx amx-pg amx-pg--izmaksas">
      <AdminCostsView dashboard={dashboard} workspace="pro" />
    </div>
  );
}
