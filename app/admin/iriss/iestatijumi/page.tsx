import Link from "next/link";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { IrissGoogleContactsBackfillButton } from "@/components/admin/IrissGoogleContactsBackfillButton";
import { IrissLogistikaAuctionSourcesPanel } from "@/components/admin/iriss-logistika/IrissLogistikaAuctionSourcesPanel";
import { IrissLogistikaMapsUsagePanel } from "@/components/admin/IrissLogistikaMapsUsagePanel";
import { IrissMarketplaceLimitsCard } from "@/components/admin/IrissMarketplaceLimitsCard";
import { IrissTameCommissionSettingsForm } from "@/components/admin/IrissTameCommissionSettingsForm";
import { requireAdminPage } from "@/lib/admin-auth";
import { loadIrissSettingsLimits } from "@/lib/iriss-iestatijumi-load";
import { getIrissLogisticsStorageState, listLogisticsAuctionSources } from "@/lib/iriss-logistics-store";

export const metadata = {
  title: "Iestatījumi | IRISS",
};

export const dynamic = "force-dynamic";

export default async function IrissSettingsPage() {
  await requireAdminPage();
  const storage = getIrissLogisticsStorageState();
  const sources = storage.enabled ? await listLogisticsAuctionSources() : [];
  const limits = await loadIrissSettingsLimits();
  return (
    <div className="iriss-iestatijumi-view relative min-h-full w-full max-w-none px-3 pb-28 pt-3 sm:px-4 sm:pb-10">
      <AdminDashboardHeaderWithMenu mobileTitle="Iestatījumi">
        <h1 className="text-[1.35rem] font-semibold leading-tight tracking-tight text-[var(--ink)] sm:text-[1.5rem]">
          Iestatījumi
        </h1>
        <p className="mt-1.5 text-[13px] text-[var(--ink2)]">
          IRISS administrēšanas likmes. Dzintarzeme Auto paliek zīmols.
        </p>
      </AdminDashboardHeaderWithMenu>

      <IrissTameCommissionSettingsForm />

      <section className="mt-5 max-w-xl">
        <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--ink3)]">
          Google Contacts
        </p>
        <div className="flex items-center justify-between gap-3 rounded-[22px] bg-[var(--s1)] px-4 py-3 shadow-[var(--sh)]">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium text-[var(--ink)]">info@provin.lv</p>
            <p className="mt-0.5 text-[12px] leading-snug text-[var(--ink2)]">
              Piesaista IRISS pasūtījumu klientus. Esošos kontaktus nepārraksta.
            </p>
          </div>
          <IrissGoogleContactsBackfillButton settingsRow />
        </div>
      </section>

      <IrissMarketplaceLimitsCard limits={limits} />

      <IrissLogistikaMapsUsagePanel />
      <section className="mt-5 max-w-xl rounded-[22px] bg-[var(--s1)] p-4 shadow-[var(--sh)] sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--ink3)]">Loģistika</p>
        <IrissLogistikaAuctionSourcesPanel initialSources={sources} compact />
      </section>
      <section className="mt-5 max-w-xl rounded-[22px] bg-[var(--s1)] p-4 shadow-[var(--sh)] sm:p-5">
        <h2 className="text-[15px] font-semibold text-[var(--ink)]">Lietotāji un pieeja</h2>
        <p className="mt-1 text-[13px] leading-snug text-[var(--ink2)]">
          Nils uzaicina, piešķir un atsauc IRISS lomas. Katra pieteikšanās un pieeja paliek žurnālā.
        </p>
        <Link
          href="/admin/iriss/iestatijumi/lietotaji"
          className="mt-3 inline-flex rounded-full bg-[var(--chip-active-bg)] px-4 py-2 text-[13px] font-medium text-[var(--chip-active-fg)]"
        >
          Atvērt lietotājus
        </Link>
      </section>
    </div>
  );
}
