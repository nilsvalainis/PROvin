import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { B2bPartnerRequisites } from "@/components/b2b/B2bPartnerRequisites";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Partner");
  return {
    title: t("metaAccountTitle"),
    robots: { index: false, follow: false },
  };
}

export default function PartneriemRequisitesPage() {
  return <B2bPartnerRequisites section="company" />;
}
