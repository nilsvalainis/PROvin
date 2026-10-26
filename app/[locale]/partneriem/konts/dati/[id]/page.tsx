import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { B2bPartnerRawData } from "@/components/b2b/B2bPartnerRawData";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Partner");
  return {
    title: t("metaAccountTitle"),
    robots: { index: false, follow: false },
  };
}

type Props = { params: Promise<{ id: string }> };

export default async function PartneriemRawDataPage({ params }: Props) {
  const { id } = await params;
  return <B2bPartnerRawData orderId={id} />;
}
