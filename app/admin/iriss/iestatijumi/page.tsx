import Link from "next/link";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { IrissGoogleContactsBackfillButton } from "@/components/admin/IrissGoogleContactsBackfillButton";
import { IrissLogistikaAuctionSourcesPanel } from "@/components/admin/iriss-logistika/IrissLogistikaAuctionSourcesPanel";
import { IrissLogistikaMapsUsagePanel } from "@/components/admin/IrissLogistikaMapsUsagePanel";
import { IrissTameCommissionSettingsForm } from "@/components/admin/IrissTameCommissionSettingsForm";
import { requireAdminPage } from "@/lib/admin-auth";
import { getIrissLogisticsStorageState, listLogisticsAuctionSources } from "@/lib/iriss-logistics-store";

export const metadata = {
  title: "Iestatījumi | IRISS",
};

export const dynamic = "force-dynamic";

export default async function IrissSettingsPage() {
  await requireAdminPage();
  const storage = getIrissLogisticsStorageState();
  const sources = storage.enabled ? await listLogisticsAuctionSources() : [];
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
      <IrissLogistikaMapsUsagePanel />
      <section className="mt-4 max-w-xl rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8e8e93]">Loģistika</p>
        <IrissLogistikaAuctionSourcesPanel initialSources={sources} compact />
      </section>
      <section className="mt-4 max-w-xl rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-[15px] font-semibold text-[var(--color-apple-text)]">Lietotāji un pieeja</h2>
        <p className="mt-1 text-[13px] leading-snug text-[var(--color-provin-muted)]">
          Nils uzaicina, piešķir un atsauc IRISS lomas. Katra pieteikšanās un pieeja paliek žurnālā.
        </p>
        <Link
          href="/admin/iriss/iestatijumi/lietotaji"
          className="mt-3 inline-flex rounded-full bg-[#111827] px-4 py-2 text-[13px] font-medium text-white"
        >
          Atvērt lietotājus
        </Link>
      </section>
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
