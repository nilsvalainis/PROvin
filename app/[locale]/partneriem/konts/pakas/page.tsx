import type { Metadata } from "next";
import { B2bPartnerPackPicker } from "@/components/b2b/B2bPartnerPackPicker";

export const metadata: Metadata = {
  title: "PROVIN partneriem",
  robots: { index: false, follow: false },
};

export default function PartneriemPacksPage() {
  return <B2bPartnerPackPicker />;
}
