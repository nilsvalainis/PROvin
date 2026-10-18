import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { IrissGoogleContactsBackfillButton } from "@/components/admin/IrissGoogleContactsBackfillButton";
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
      <AdminDashboardHeaderWithMenu mobileTitle="Iestatījumi">
        <h1 className="text-[1.35rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)] sm:text-[1.5rem]">
          Iestatījumi
        </h1>
        <p className="mt-1.5 text-[13px] text-[var(--color-provin-muted)]">
          IRISS administrēšanas likmes. Dzintarzeme Auto paliek zīmols.
        </p>
      </AdminDashboardHeaderWithMenu>
      <IrissTameCommissionSettingsForm />
      <section className="mt-4 max-w-xl rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-[15px] font-semibold text-[var(--color-apple-text)]">Google Contacts</h2>
        <p className="mt-1 text-[13px] leading-snug text-[var(--color-provin-muted)]">
          Piesaista IRISS pasūtījumu klientus kontam info@provin.lv. Esošos kontaktus nepārraksta.
        </p>
        <div className="mt-3">
          <IrissGoogleContactsBackfillButton />
        </div>
      </section>
    </div>
  );
}
