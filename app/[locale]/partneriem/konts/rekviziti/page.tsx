import type { Metadata } from "next";
import { B2bPartnerRequisites } from "@/components/b2b/B2bPartnerRequisites";

export const metadata: Metadata = {
  title: "PROVIN partneriem",
  robots: { index: false, follow: false },
};

export default function PartneriemRequisitesPage() {
  return <B2bPartnerRequisites />;
}
