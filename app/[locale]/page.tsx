import dynamic from "next/dynamic";
import { Footer } from "@/components/Footer";
import { HomeFaqSection } from "@/components/home/HomeFaqSection";
import { HomeServiceComparisonAudit, HomeServiceComparisonSelect } from "@/components/home/HomeServiceComparison";
import { IrissSection } from "@/components/IrissSection";
import { isProvinSelectPublic } from "@/lib/provin-select-flags";
import { PricingIncluded } from "@/components/PricingIncluded";
import productHeroStyles from "@/app/[locale]/demo/page.module.css";

const HomeProductHero = dynamic(() => import("@/components/home/HomeProductHero"), {
  loading: () => (
    <div
      className={`home-hero-pricing-unified demo-design-dir home-hero-intro-surface ${productHeroStyles.heroIntroSurface} ${productHeroStyles.heroHomeLoadingShell}`}
      aria-busy="true"
      aria-label="Ielādē…"
    />
  ),
});

export default async function HomePage() {
  return (
    <div className={productHeroStyles.demoRoot}>
      <div className="home-hero-pricing-unified demo-design-dir flex min-h-0 min-w-0 flex-col text-white">
        <HomeProductHero
          showProvinSelect={isProvinSelectPublic()}
          comparisonContent={
            isProvinSelectPublic() ? <HomeServiceComparisonAudit /> : <PricingIncluded embedded />
          }
        />
      </div>

      <div id="site-content" className="demo-design-dir min-w-0 text-white home-body-ink scroll-mt-14">
        <section className="demo-design-dir__section demo-design-dir__section--band-b py-16 sm:py-20 md:py-24">
          <div className="demo-design-dir__shell">
            <IrissSection editorialColumn />
          </div>
        </section>
      </div>

      <div className="demo-design-dir min-w-0 pb-0 text-white">
        {isProvinSelectPublic() ? (
          <section className="demo-design-dir__section demo-design-dir__section--unified-pricing-tail pt-16 pb-12 sm:pt-20 sm:pb-16 md:pt-24 md:pb-20">
            <div className="demo-design-dir__shell">
              <HomeServiceComparisonSelect />
            </div>
          </section>
        ) : null}
        <HomeFaqSection />

        <section className="demo-design-dir__section border-t border-white/[0.06] pb-0">
          <Footer />
        </section>
      </div>
    </div>
  );
}
