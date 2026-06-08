import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ProvinSelectSection } from "@/components/home/ProvinSelectSection";
import { isProvinSelectPublic } from "@/lib/provin-select-flags";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!isProvinSelectPublic()) {
    return { title: "PROVIN.LV", robots: { index: false, follow: false } };
  }
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ProvinSelect" });
  return {
    title: t("formTitle"),
    description: t("formIntro"),
  };
}

export default function ProvinSelectPieteikumsPage() {
  if (!isProvinSelectPublic()) {
    notFound();
  }

  return (
    <div className="demo-design-dir min-w-0 text-white">
      <ProvinSelectSection variant="standalone" />
    </div>
  );
}
