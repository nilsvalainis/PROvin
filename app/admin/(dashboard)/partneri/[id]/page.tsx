import { notFound } from "next/navigation";
import { AdminB2bCompanyVerifyPanel } from "@/components/admin/AdminB2bCompanyVerifyPanel";
import { AdminB2bPartnerBackLink } from "@/components/admin/AdminB2bPartnerBackLink";
import { AdminB2bPartnerEditForm } from "@/components/admin/AdminB2bPartnerEditForm";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { isSafeB2bPartnerId, toPublicPartner } from "@/lib/b2b-partner-account";
import { getB2bPartnerById, markB2bPartnerAdminSeen } from "@/lib/b2b-partner-store";
import { requireAdminPage } from "@/lib/admin-auth";
import { AdminB2bPartnerWallet } from "@/components/admin/AdminB2bPartnerWallet";
import { readB2bWallet } from "@/lib/b2b-wallet-store";
import { buildB2bWalletView } from "@/lib/b2b-wallet-view";
import { loadCreditsForPartners } from "@/lib/b2b-partner-dashboard";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  await requireAdminPage();
  const { id } = await params;
  const partner = isSafeB2bPartnerId(id) ? await getB2bPartnerById(id) : null;
  return { title: partner ? partner.companyName : "Partneris" };
}

export default async function AdminPartnerDetailPage({ params }: Props) {
  await requireAdminPage();
  const { id } = await params;
  if (!isSafeB2bPartnerId(id)) notFound();
  const record = await getB2bPartnerById(id);
  if (!record) notFound();
  if (!record.adminSeenAt) {
    await markB2bPartnerAdminSeen(id);
  }
  const partner = toPublicPartner(record);
  const [wallet, legacyById] = await Promise.all([
    readB2bWallet(id),
    loadCreditsForPartners([{ id, dealerEnabled: true }]),
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
      <AdminB2bPartnerEditForm partner={partner} legacyCredits={legacyCredits} />
    </div>
  );
}
