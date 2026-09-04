import type { Metadata } from "next";
import { B2bPartnerHome } from "@/components/b2b/B2bPartnerHome";

export const metadata: Metadata = {
  title: "PROVIN partneriem",
  robots: { index: false, follow: false },
};

export default function PartneriemAccountHomePage() {
  return <B2bPartnerHome />;
}
