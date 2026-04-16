import { getTranslations } from "next-intl/server";
import { Footer } from "@/components/Footer";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";
import { renderProvinText } from "@/lib/provin-wordmark";
import { AutoWireframeBackground } from "@/components/home/AutoWireframeBackground";
import { HomeFaqSection } from "@/components/home/HomeFaqSection";
import { HomeScrollSurface } from "@/components/home/HomeScrollSurface";
import { MarketingHero } from "@/components/home/MarketingHero";
import { IrissSection } from "@/components/IrissSection";
import { PricingIncluded } from "@/components/PricingIncluded";

export default async function HomePage() {
  const tMeta = await getTranslations("Meta");

  return (
    <HomeScrollSurface wireframe={<AutoWireframeBackground />}>
      <div className="relative z-10 min-w-0 bg-transparent">
        <div className="demo-design-dir min-w-0 pb-0 text-white">
          <div className="home-hero-intro-surface">
            <MarketingHero homeOrbitPreset="s12" designDirection />

            <section id="home-intro" className="relative z-[1] min-w-0 pb-10 pt-5 sm:pb-14 sm:pt-8">
              <div className="demo-design-dir__shell">
                <div className="mx-auto mt-2 w-full max-w-[min(100%,52rem)] sm:mt-3">
                  <div className="text-center">
                    <h2 className="demo-design-dir__title mx-auto mb-0 max-w-[min(100%,48rem)] text-balance">
                      KAS IR{" "}
                      <span className="inline whitespace-nowrap">
                        <span className="text-white">PRO</span>
                        <span className="text-provin-accent">VIN</span>
                      </span>
                      ?
                    </h2>
                    <div className="mx-auto mt-3 w-full max-w-[min(100%,42rem)] px-1 sm:px-2">
                      <DiagnosticScanLine variant="rail" motion="alongPingPong" className="w-full" />
                    </div>
                  </div>
                </div>
                <p className="demo-design-dir__body demo-design-dir__body--home-intro mx-auto mt-6 max-w-[min(100%,46rem)] text-balance text-center">
                  {renderProvinText(tMeta("homeIntroBody"))}
                </p>
              </div>
            </section>
          </div>

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
