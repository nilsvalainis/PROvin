import type { Metadata } from "next";
import { B2bPartnerArchive } from "@/components/b2b/B2bPartnerArchive";
import { B2bPartnerWalletLedger } from "@/components/b2b/B2bPartnerWalletLedger";

export const metadata: Metadata = {
  title: "PROVIN partneriem",
  robots: { index: false, follow: false },
};

export default function PartneriemOrdersPage() {
  return (
    <div className="flex flex-col gap-12 sm:gap-14">
      <B2bPartnerArchive />
      <B2bPartnerWalletLedger />
    </div>
  );
}
