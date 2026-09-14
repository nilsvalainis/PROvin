import type { Metadata } from "next";
import { B2bPartnerHome } from "@/components/b2b/B2bPartnerHome";
import { emptyB2bPartnerPrices } from "@/lib/b2b-partner-account";
import { emptyB2bCreditRemaining } from "@/lib/b2b-partner-credits";
import { loadB2bAccountDashboard } from "@/lib/b2b-partner-dashboard";

export const metadata: Metadata = {
  title: "PROVIN partneriem",
  robots: { index: false, follow: false },
};

export default async function PartneriemAccountHomePage() {
  const dashboard = await loadB2bAccountDashboard();
  return (
    <B2bPartnerHome
      initialCredits={dashboard?.credits ?? emptyB2bCreditRemaining()}
      initialDealerEnabled={dashboard?.dealerEnabled === true}
      initialPrices={dashboard?.prices ?? emptyB2bPartnerPrices()}
    />
  );
}
