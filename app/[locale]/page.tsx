import { getTranslations } from "next-intl/server";
import { Footer } from "@/components/Footer";
import { renderProvinText } from "@/lib/provin-wordmark";
import { AutoWireframeBackground } from "@/components/home/AutoWireframeBackground";
import { HomeFaqSection } from "@/components/home/HomeFaqSection";
import { HomeScrollSurface } from "@/components/home/HomeScrollSurface";
import { HomeProductHero } from "@/components/home/HomeProductHero";
import { IrissSection } from "@/components/IrissSection";
import { PricingIncluded } from "@/components/PricingIncluded";
import productHeroStyles from "@/app/[locale]/demo/page.module.css";

export default async function HomePage() {
  const tMeta = await getTranslations("Meta");
  const introBody = renderProvinText(tMeta("homeIntroBody"), {
    proAndSuffixClassName: productHeroStyles.heroGlassPro,
  });

  return (
    <HomeScrollSurface wireframe={<AutoWireframeBackground />}>
      <div className="relative z-10 min-w-0 bg-transparent">
        <div className="demo-design-dir min-w-0 pb-0 text-white">
          <HomeProductHero introBody={introBody} />

          <div id="site-content" className="home-body-ink scroll-mt-14">
            <section className="demo-design-dir__section demo-design-dir__section--band-a py-16 sm:py-20">
              <div className="demo-design-dir__shell">
                <PricingIncluded embedded />
              </div>
            </section>

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
    </HomeScrollSurface>
  );
}
