import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { B2bPartnerProfile } from "@/components/b2b/B2bPartnerProfile";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Partner");
  return {
    title: t("metaAccountTitle"),
    robots: { index: false, follow: false },
  };
}

export default function PartneriemProfilePage() {
  return <B2bPartnerProfile />;
}
