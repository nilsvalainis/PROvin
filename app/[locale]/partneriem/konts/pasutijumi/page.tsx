import type { Metadata } from "next";
import { B2bPartnerArchive } from "@/components/b2b/B2bPartnerArchive";

export const metadata: Metadata = {
  title: "PROVIN partneriem",
  robots: { index: false, follow: false },
};

export default function PartneriemOrdersPage() {
  return <B2bPartnerArchive />;
}
