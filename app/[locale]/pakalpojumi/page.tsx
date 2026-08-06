import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { HomeFeatureBreakdown } from "@/components/home/HomeFeatureBreakdown";
import productHeroStyles from "@/app/[locale]/demo/page.module.css";
import tp5Styles from "@/app/test-pricing-5/test-pricing-5.module.css";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  return {
    title: t("servicesTitle"),
    description: t("servicesDescription"),
  };
}

export default async function PakalpojumiPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Misc" });

  return (
    <div className={`home-page-canvas-root ${productHeroStyles.demoRoot} ${tp5Styles.homePageCanvas}`}>
      <div className="demo-design-dir flex min-h-0 min-w-0 flex-col bg-transparent text-zinc-100">
        <div className="border-b border-white/[0.08] px-4 py-4 sm:px-6">
          <div className="mx-auto max-w-[min(75rem,calc(100vw-2rem))]">
            <Link
              href="/"
              className="provin-lift-subtle inline-flex items-center gap-1 rounded-lg border border-transparent px-1 py-1 text-[14px] font-normal text-[#60a5fa] transition hover:underline"
            >
              {t("faqBack")}
            </Link>
          </div>
        </div>
        <HomeFeatureBreakdown showHeading />
      </div>
    </div>
  );
}
