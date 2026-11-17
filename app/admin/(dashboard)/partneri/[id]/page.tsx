import { notFound } from "next/navigation";
import { AdminB2bCompanyVerifyPanel } from "@/components/admin/AdminB2bCompanyVerifyPanel";
import { AdminB2bPartnerBackLink } from "@/components/admin/AdminB2bPartnerBackLink";
import { AdminB2bPartnerEditForm } from "@/components/admin/AdminB2bPartnerEditForm";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { isSafeB2bPartnerId, toPublicPartner } from "@/lib/b2b-partner-account";
import { getB2bPartnerById, markB2bPartnerAdminSeen } from "@/lib/b2b-partner-store";
import { requireAdminPage } from "@/lib/admin-auth";
import { AdminB2bPartnerWallet } from "@/components/admin/AdminB2bPartnerWallet";
import { AdminB2bPartnerEmbed } from "@/components/admin/AdminB2bPartnerEmbed";
import { AdminBusinessPogaCard } from "@/components/admin/AdminBusinessPogaCard";
import { parseBusinessPogaPeriod } from "@/lib/business-poga-period";
import { loadBusinessPogaStats } from "@/lib/business-poga-stats-load";
import { rigaDate } from "@/lib/vin-check-stats";
import { listPartnerBusinessSales } from "@/lib/business-partner-sales";
import { readB2bWallet } from "@/lib/b2b-wallet-store";
import { buildB2bWalletView } from "@/lib/b2b-wallet-view";
import { loadCreditsForPartners } from "@/lib/b2b-partner-dashboard";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props) {
  await requireAdminPage();
  const { id } = await params;
  const partner = isSafeB2bPartnerId(id) ? await getB2bPartnerById(id) : null;
  return { title: partner ? partner.companyName : "Partneris" };
}

export default async function AdminPartnerDetailPage({ params, searchParams }: Props) {
  await requireAdminPage();
  const { id } = await params;
  if (!isSafeB2bPartnerId(id)) notFound();
  const record = await getB2bPartnerById(id);
  if (!record) notFound();
  if (!record.adminSeenAt) {
    await markB2bPartnerAdminSeen(id);
  }
  const partner = toPublicPartner(record);
  const pogaPeriod = parseBusinessPogaPeriod((await searchParams) ?? {}, rigaDate());
  const pogaStats = record.businessEmbed.enabled ? await loadBusinessPogaStats(pogaPeriod, id) : null;
  const [wallet, legacyById, businessSales] = await Promise.all([
    readB2bWallet(id),
    loadCreditsForPartners([{ id, dealerEnabled: true }]),
    record.businessEmbed.enabled ? listPartnerBusinessSales(id) : Promise.resolve([]),
  ]);
  const legacyCredits = legacyById[id] ?? { business: 0, dealer: 0 };

  return (
    <div className="w-full max-w-none">
      <AdminDashboardHeaderWithMenu>
        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">
          B2B
        </p>
        <div className="mt-2">
          <AdminB2bPartnerBackLink />
        </div>
        <h1 className="mt-2 text-[1.35rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)] sm:text-[1.5rem]">
          {partner.companyName}
        </h1>
        <p className="mt-2 w-full max-w-none text-[13px] leading-relaxed text-[var(--color-provin-muted)]">
          {partner.email}
          {" · "}
          {partner.status === "active" ? "Aktīvs" : "Bloķēts"}
        </p>
      </AdminDashboardHeaderWithMenu>
      <AdminB2bCompanyVerifyPanel kind="partner" id={partner.id} />
      <AdminB2bPartnerWallet
        partnerId={partner.id}
        initialWallet={buildB2bWalletView(wallet, record.walletPrices, 200, record.walletHiddenProducts)}
        initialOverrides={record.walletPrices}
        initialHidden={record.walletHiddenProducts}
      />
      {pogaStats ? (
        <div className="mt-6">
          <AdminBusinessPogaCard
            view={pogaStats}
            period={pogaPeriod}
            basePath={`/admin/partneri/${partner.id}`}
            partnerLabel={record.businessEmbed.domains[0] ?? partner.companyName}
          />
        </div>
      ) : null}
      <AdminB2bPartnerEmbed partnerId={partner.id} initial={record.businessEmbed} sales={businessSales} />
      <AdminB2bPartnerEditForm partner={partner} legacyCredits={legacyCredits} />
    </div>
  );
}
