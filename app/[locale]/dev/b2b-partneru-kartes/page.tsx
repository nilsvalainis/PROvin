import type { Metadata } from "next";
import { notFound } from "next/navigation";
import productHeroStyles from "@/app/[locale]/demo/page.module.css";
import { B2bPartnerAccountShell } from "@/components/b2b/B2bPartnerAccountShell";
import { B2bPartnerWalletHome } from "@/components/b2b/B2bPartnerWalletHome";
import tp5Styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { emptyB2bWallet, emptyB2bWalletPrices } from "@/lib/b2b-wallet";
import { buildB2bWalletView } from "@/lib/b2b-wallet-view";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Lokāls PR ekrānuzņēmumu skats: īstās partneru kartes ar 50 € atlikumu bez pieteikšanās. Produkcijā 404. */
export default function B2bPartnerCardsDevPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const wallet = { ...emptyB2bWallet(), balanceCents: 5000, topupTotalCents: 5000 };
  return (
    <div className={`home-page-canvas-root ${productHeroStyles.demoRoot} ${tp5Styles.homePageCanvas}`}>
      <div className="home-hero-pricing-unified demo-design-dir flex min-h-0 min-w-0 flex-col bg-transparent text-zinc-100">
        <B2bPartnerAccountShell>
          <B2bPartnerWalletHome initialWallet={buildB2bWalletView(wallet, emptyB2bWalletPrices())} legacy={null} />
        </B2bPartnerAccountShell>
      </div>
    </div>
  );
}
