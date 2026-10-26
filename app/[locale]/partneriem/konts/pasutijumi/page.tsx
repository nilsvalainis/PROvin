import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { B2bPartnerArchive } from "@/components/b2b/B2bPartnerArchive";
import { B2bPartnerWalletLedger } from "@/components/b2b/B2bPartnerWalletLedger";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Partner");
  return {
    title: t("metaAccountTitle"),
    robots: { index: false, follow: false },
  };
}

export default function PartneriemOrdersPage() {
  return (
    <div className="flex flex-col gap-12 sm:gap-14">
      <B2bPartnerArchive />
      <B2bPartnerWalletLedger />
    </div>
  );
}
