import type { Metadata } from "next";
import { notFound } from "next/navigation";
import productHeroStyles from "@/app/[locale]/demo/page.module.css";
import { BulkVinPreviewDriver } from "@/app/[locale]/dev/b2b-bulk-vin/BulkVinPreviewDriver";
import { B2bPartnerAccountShell } from "@/components/b2b/B2bPartnerAccountShell";
import { B2bPartnerWalletHome } from "@/components/b2b/B2bPartnerWalletHome";
import tp5Styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { emptyB2bWallet, emptyB2bWalletPrices } from "@/lib/b2b-wallet";
import { buildB2bWalletView } from "@/lib/b2b-wallet-view";

export const metadata: Metadata = { robots: { index: false, follow: false } };

const STEPS = ["paste", "list", "result"] as const;

/** Lokāls PR ekrānuzņēmumu skats: maka „Vairāki VIN” plūsma ar viltotu API. Produkcijā 404. */
export default async function B2bBulkVinDevPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; card?: string; balance?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { step, card, balance } = await searchParams;
  const balanceCents = Math.max(0, Math.round(Number(balance ?? "250") * 100)) || 25000;
  const wallet = { ...emptyB2bWallet(), balanceCents, topupTotalCents: balanceCents };
  return (
    <div className={`home-page-canvas-root ${productHeroStyles.demoRoot} ${tp5Styles.homePageCanvas}`}>
      <div className="home-hero-pricing-unified demo-design-dir flex min-h-0 min-w-0 flex-col bg-transparent text-zinc-100">
        <B2bPartnerAccountShell>
          <B2bPartnerWalletHome
            initialWallet={buildB2bWalletView(wallet, emptyB2bWalletPrices())}
            legacy={null}
          />
        </B2bPartnerAccountShell>
      </div>
      <BulkVinPreviewDriver
        step={STEPS.find((s) => s === step) ?? "list"}
        card={Math.min(2, Math.max(0, Number(card ?? "0") || 0))}
      />
    </div>
  );
}
