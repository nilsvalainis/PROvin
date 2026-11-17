import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Partner");
  return {
    title: t("metaAccountTitle"),
    robots: { index: false, follow: false },
  };
}

type Props = { params: Promise<{ locale: string }> };

export default async function PartneriemPacksRedirectPage({ params }: Props) {
  const { locale } = await params;
  redirect(`/${locale}/partneriem/konts`);
}
