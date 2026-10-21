import { AdminB2bDemoTenantsPanel } from "@/components/admin/AdminB2bDemoTenantsPanel";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { requireAdminPage } from "@/lib/admin-auth";

export const metadata = {
  title: "Demo dīleri",
};

export const dynamic = "force-dynamic";

export default async function AdminB2bDemoTenantsPage() {
  await requireAdminPage();
  return (
    <div className="w-full max-w-none max-md:px-4">
      <AdminDashboardHeaderWithMenu>
        <p className="hidden text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)] md:block">
          B2B
        </p>
        <h1 className="mt-1 text-[1.35rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)] sm:text-[1.5rem]">
          Demo dīleri
        </h1>
        <p className="mt-2 w-full max-w-none text-[13px] leading-relaxed text-[var(--color-provin-muted)]">
          IRISS B2B demo tenanti (demo.provin.lv). Nav PROVIN atskaišu un nav ĪRISS noklusējuma komisijas.
        </p>
      </AdminDashboardHeaderWithMenu>
      <AdminB2bDemoTenantsPanel />
    </div>
  );
}
