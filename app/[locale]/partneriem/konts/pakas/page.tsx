import type { Metadata } from "next";
import { B2bPartnerCatalog } from "@/components/b2b/B2bPartnerCatalog";

export const metadata: Metadata = {
  title: "PROVIN partneriem",
  robots: { index: false, follow: false },
};

export default function PartneriemPacksPage() {
  return <B2bPartnerCatalog showCta />;
}
