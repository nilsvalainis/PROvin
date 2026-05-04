import dynamic from "next/dynamic";
import { Footer } from "@/components/Footer";
import { HomeFaqSection } from "@/components/home/HomeFaqSection";
import { HomeServiceComparison } from "@/components/home/HomeServiceComparison";
import { ProvinSelectSection } from "@/components/home/ProvinSelectSection";
import { IrissSection } from "@/components/IrissSection";
import { isProvinSelectPublic } from "@/lib/provin-select-flags";
import { PricingIncluded } from "@/components/PricingIncluded";
import productHeroStyles from "@/app/[locale]/demo/page.module.css";

const HomeProductHero = dynamic(() => import("@/components/home/HomeProductHero"), {
  loading: () => (
    <div
      className={`home-hero-pricing-unified demo-design-dir home-hero-intro-surface ${productHeroStyles.heroIntroSurface}`}
      aria-busy="true"
      aria-label="Ielādē…"
    />
  ),
});

export default async function HomePage() {
  return (
    <div className={productHeroStyles.demoRoot}>
      <div className="home-hero-pricing-unified demo-design-dir min-w-0 text-white">
        <HomeProductHero showProvinSelect={isProvinSelectPublic()} />

        <section className="demo-design-dir__section demo-design-dir__section--unified-pricing-tail py-16 sm:py-20 md:py-24">
          <div className="demo-design-dir__shell">
            {isProvinSelectPublic() ? (
              <HomeServiceComparison />
            ) : (
              <PricingIncluded embedded />
            )}
          </div>
        </section>
      </div>

      {isProvinSelectPublic() ? (
        <div className="demo-design-dir home-below-hero-continuum min-w-0 text-white">
          <ProvinSelectSection formOnly />
        </div>
      ) : null}

      <div id="site-content" className="demo-design-dir min-w-0 text-white home-body-ink scroll-mt-14">
        <section className="demo-design-dir__section demo-design-dir__section--band-b py-16 sm:py-20 md:py-24">
          <div className="demo-design-dir__shell">
            <IrissSection editorialColumn />
          </div>
        </section>
      </div>

      <div className="demo-design-dir min-w-0 pb-0 text-white">
        <HomeFaqSection />

        <section className="demo-design-dir__section border-t border-white/[0.06] pb-0">
          <Footer />
        </section>
      </div>
    </div>
  );
}
