import type { Metadata } from "next";
import { B2bPartnerProfile } from "@/components/b2b/B2bPartnerProfile";

export const metadata: Metadata = {
  title: "PROVIN partneriem",
  robots: { index: false, follow: false },
};

export default function PartneriemProfilePage() {
  return <B2bPartnerProfile />;
}
