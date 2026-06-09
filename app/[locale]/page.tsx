import { Suspense } from "react";
import dynamic from "next/dynamic";
import { Footer } from "@/components/Footer";
import { HomeFeatureBreakdown } from "@/components/home/HomeFeatureBreakdown";
import { HomeFaqSection } from "@/components/home/HomeFaqSection";
import { HomeServiceComparisonSelect } from "@/components/home/HomeServiceComparison";
import { IrissSection } from "@/components/IrissSection";
import { isProvinSelectPublic } from "@/lib/provin-select-flags";
import productHeroStyles from "@/app/[locale]/demo/page.module.css";
import tp5Styles from "@/app/test-pricing-5/test-pricing-5.module.css";

const HomePricingHero = dynamic(() => import("@/components/home/HomePricingHero"), {
  loading: () => (
    <div
      className={`home-hero-pricing-unified demo-design-dir home-hero-intro-surface ${productHeroStyles.heroIntroSurface} ${productHeroStyles.heroHomeLoadingShell}`}
      aria-busy="true"
      aria-label="Ielādē…"
    />
  ),
});

export default function HomePage() {
  return (
    <div className={`home-page-canvas-root ${productHeroStyles.demoRoot} ${tp5Styles.homePageCanvas}`}>
      <div className="home-hero-pricing-unified demo-design-dir flex min-h-0 min-w-0 flex-col bg-transparent text-zinc-100">
        <Suspense fallback={null}>
          <HomePricingHero />
        </Suspense>

        <HomeFeatureBreakdown />

        <div id="site-content" className="min-w-0 bg-transparent pb-0 text-white home-body-ink scroll-mt-14">
          {isProvinSelectPublic() ? (
            <section className="demo-design-dir__section bg-transparent pt-16 pb-12 sm:pt-20 sm:pb-16 md:pt-24 md:pb-20">
              <div className="demo-design-dir__shell">
                <HomeServiceComparisonSelect />
              </div>
            </section>
          ) : null}

          <section className="demo-design-dir__section bg-transparent pt-16 pb-12 sm:pt-20 sm:pb-16 md:pt-24 md:pb-20">
            <div className="demo-design-dir__shell">
              <IrissSection editorialColumn />
            </div>
          </section>
          <HomeFaqSection />

          <section className="demo-design-dir__section bg-transparent pb-0">
            <Footer />
          </section>
        </div>
      </div>
    </div>
  );
}
