import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ProvinSelectSection } from "@/components/home/ProvinSelectSection";
import { isProvinSelectPublic } from "@/lib/provin-select-flags";
import productHeroStyles from "@/app/[locale]/demo/page.module.css";
import tp5Styles from "@/components/test-pricing-5/test-pricing-5.module.css";

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
    <div className={`home-page-canvas-root ${productHeroStyles.demoRoot} ${tp5Styles.homePageCanvas}`}>
      <div className="demo-design-dir min-w-0 text-white">
        <ProvinSelectSection variant="standalone" />
      </div>
    </div>
  );
}
