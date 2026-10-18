import type { Metadata } from "next";
import { B2bPartnerWalletHome } from "@/components/b2b/B2bPartnerWalletHome";
import { emptyB2bWallet, emptyB2bWalletPrices } from "@/lib/b2b-wallet";
import { buildB2bWalletView } from "@/lib/b2b-wallet-view";
import { loadB2bAccountDashboard } from "@/lib/b2b-partner-dashboard";

export const metadata: Metadata = {
  title: "PROVIN partneriem",
  robots: { index: false, follow: false },
};

export default async function PartneriemAccountHomePage() {
  const dashboard = await loadB2bAccountDashboard();
  return (
    <B2bPartnerWalletHome
      initialWallet={dashboard?.wallet ?? buildB2bWalletView(emptyB2bWallet(), emptyB2bWalletPrices())}
      legacy={
        dashboard
          ? { credits: dashboard.credits, dealerEnabled: dashboard.dealerEnabled, prices: dashboard.prices }
          : null
      }
    />
  );
}
