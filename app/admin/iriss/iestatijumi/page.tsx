import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { IrissTameCommissionSettingsForm } from "@/components/admin/IrissTameCommissionSettingsForm";
import { requireAdminPage } from "@/lib/admin-auth";

export const metadata = {
  title: "Iestatījumi | IRISS",
};

export const dynamic = "force-dynamic";

export default async function IrissSettingsPage() {
  await requireAdminPage();
  return (
    <div className="relative min-h-full w-full max-w-none bg-[#F8F8F9] px-3 pb-24 pt-3 sm:px-4 sm:pb-8">
      <AdminDashboardHeaderWithMenu>
        <h1 className="text-[1.35rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)] sm:text-[1.5rem]">
          Iestatījumi
        </h1>
        <p className="mt-1.5 text-[13px] text-[var(--color-provin-muted)]">
          IRISS administrēšanas likmes. Dzintarzeme Auto paliek zīmols.
        </p>
      </AdminDashboardHeaderWithMenu>
      <IrissTameCommissionSettingsForm />
    </div>
  );
}
