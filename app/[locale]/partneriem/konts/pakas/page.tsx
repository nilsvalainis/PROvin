import type { Metadata } from "next";
import { B2bPartnerReportsInfo } from "@/components/b2b/B2bPartnerReportsInfo";
import { loadB2bAccountDashboard } from "@/lib/b2b-partner-dashboard";

export const metadata: Metadata = {
  title: "PROVIN partneriem",
  robots: { index: false, follow: false },
};

export default async function PartneriemPacksPage() {
  const dashboard = await loadB2bAccountDashboard();
  return <B2bPartnerReportsInfo dealerEnabled={dashboard?.dealerEnabled === true} />;
}
