import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Footer } from "@/components/Footer";
import { IrissSection } from "@/components/IrissSection";
import productHeroStyles from "@/app/[locale]/demo/page.module.css";
import tp5Styles from "@/app/test-pricing-5/test-pricing-5.module.css";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  return {
    title: t("aboutTitle"),
    description: t("aboutDescription"),
  };
}

/** Par PROVIN — hero-stila chrome (header no layout) + kājene. Bez kājenes paliek tikai Blogs. */
export default async function ParMumsPage() {
  return (
    <div className={`home-page-canvas-root ${productHeroStyles.demoRoot} ${tp5Styles.homePageCanvas}`}>
      <div className="demo-design-dir flex min-h-0 min-w-0 flex-col bg-transparent text-zinc-100">
        <section className="demo-design-dir__section bg-transparent pb-12 pt-6 sm:pb-16 sm:pt-8 md:pb-20">
          <div className="demo-design-dir__shell">
            <IrissSection editorialColumn />
          </div>
        </section>

        <div id="site-content" className="min-w-0 bg-transparent pb-0 text-white home-body-ink">
          <section className="demo-design-dir__section bg-transparent pb-0">
            <Footer />
          </section>
        </div>
      </div>
    </div>
  );
}
