import { Footer } from "@/components/Footer";
import { FinalCta } from "@/components/FinalCta";
import { AutoWireframeBackground } from "@/components/home/AutoWireframeBackground";
import { HomeFaqSection } from "@/components/home/HomeFaqSection";
import { HomeMetaIntroSection } from "@/components/home/HomeMetaIntroSection";
import { HomeScrollSurface } from "@/components/home/HomeScrollSurface";
import { MarketingHero } from "@/components/home/MarketingHero";
import { IrissSection } from "@/components/IrissSection";
import { PricingIncluded } from "@/components/PricingIncluded";

export default async function HomePage({
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ atcelts?: string }>;
}) {
  const sp = await searchParams;
  const cancelled = sp.atcelts === "1";
  return (
    <HomeScrollSurface wireframe={<AutoWireframeBackground />}>
      <div className="relative z-10 min-w-0 bg-transparent">
        <div className="demo-design-dir min-w-0 pb-24 text-white">
          <MarketingHero homeOrbitPreset="s12" designDirection />
          <HomeMetaIntroSection />

          <div id="site-content" className="home-body-ink scroll-mt-14">
            <section className="demo-design-dir__section demo-design-dir__section--band-b py-16 sm:py-20">
              <div className="demo-design-dir__shell">
                <FinalCta cancelled={cancelled} orderEmbedded />
              </div>
            </section>

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

          <section className="demo-design-dir__section border-t border-white/[0.06] py-14">
            <div className="demo-design-dir__shell">
              <Footer />
            </div>
          </section>
        </div>
      </div>
    </HomeScrollSurface>
  );
}
