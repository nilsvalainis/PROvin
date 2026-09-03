import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { buildPublicPageMetadata } from "@/lib/seo-public-metadata";
import { Footer } from "@/components/Footer";
import { HomeFeatureBreakdown } from "@/components/home/HomeFeatureBreakdown";
import productHeroStyles from "@/app/[locale]/demo/page.module.css";
import tp5Styles from "@/components/test-pricing-5/test-pricing-5.module.css";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  return buildPublicPageMetadata({
    locale,
    path: "/pakalpojumi",
    title: t("servicesTitle"),
    description: t("servicesDescription"),
  });
}

export default async function PakalpojumiPage() {
  return (
    <div className={`home-page-canvas-root ${productHeroStyles.demoRoot} ${tp5Styles.homePageCanvas}`}>
      <div className="demo-design-dir flex min-h-0 min-w-0 flex-col bg-transparent text-zinc-100">
        <HomeFeatureBreakdown showHeading />

        <div id="site-content" className="min-w-0 bg-transparent pb-0 text-white home-body-ink">
          <section className="demo-design-dir__section bg-transparent pb-0">
            <Footer />
          </section>
        </div>
      </div>
    </div>
  );
}
