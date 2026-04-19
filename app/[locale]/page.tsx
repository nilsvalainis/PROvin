import dynamic from "next/dynamic";
import { getTranslations } from "next-intl/server";
import { Footer } from "@/components/Footer";
import { HomeFaqSection } from "@/components/home/HomeFaqSection";
import { ProvinSelectSection } from "@/components/home/ProvinSelectSection";
import { IrissSection } from "@/components/IrissSection";
import { isProvinSelectPublic } from "@/lib/provin-select-flags";
import { PricingIncluded } from "@/components/PricingIncluded";
import productHeroStyles from "@/app/[locale]/demo/page.module.css";

const HomeProductHero = dynamic(() => import("@/components/home/HomeProductHero"), {
  loading: () => (
    <div
      className={`home-hero-intro-surface ${productHeroStyles.heroIntroSurface}`}
      aria-busy="true"
      aria-label="Ielādē…"
    />
  ),
});

export default async function HomePage() {
  const tMeta = await getTranslations("Meta");

  return (
    <div className={productHeroStyles.demoRoot}>
      <HomeProductHero introBodyText={tMeta("homeIntroBody")} showProvinSelect={isProvinSelectPublic()} />

      <div className="demo-design-dir min-w-0 pb-0 text-white">
        <div id="site-content" className="home-body-ink scroll-mt-14">
          <section className="demo-design-dir__section demo-design-dir__section--band-a py-16 sm:py-20">
            <div className="demo-design-dir__shell">
              <PricingIncluded embedded />
            </div>
          </section>

          {isProvinSelectPublic() ? <ProvinSelectSection /> : null}

          <section className="demo-design-dir__section demo-design-dir__section--band-b py-16 sm:py-20">
            <div className="demo-design-dir__shell">
              <IrissSection editorialColumn />
            </div>
          </section>
        </div>

        <HomeFaqSection />

        <section className="demo-design-dir__section border-t border-white/[0.06] pb-0">
          <Footer />
        </section>
      </div>
    </div>
  );
}
