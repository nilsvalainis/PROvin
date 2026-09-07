import type { Metadata } from "next";
import { B2bPartnerReportsInfo } from "@/components/b2b/B2bPartnerReportsInfo";

export const metadata: Metadata = {
  title: "PROVIN partneriem",
  robots: { index: false, follow: false },
};

export default function PartneriemPacksPage() {
  return <B2bPartnerReportsInfo />;
}
