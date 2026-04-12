import { getTranslations } from "next-intl/server";
import { Footer } from "@/components/Footer";
import { FinalCta } from "@/components/FinalCta";
import { AutoWireframeBackground } from "@/components/home/AutoWireframeBackground";
import { HomeFaqSection } from "@/components/home/HomeFaqSection";
import { HomeMetaIntroSection } from "@/components/home/HomeMetaIntroSection";
import { HomeScrollSurface } from "@/components/home/HomeScrollSurface";
import { HowItWorksSignalGrid } from "@/components/home/HowItWorksSignalGrid";
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
  const tHero = await getTranslations("Hero");

  return (
    <HomeScrollSurface wireframe={<AutoWireframeBackground />}>
      <div className="relative z-10 min-w-0 bg-transparent">
        <MarketingHero homeOrbitPreset="s20" />

        <div className="demo-design-dir min-w-0 pb-24 pt-4 text-white sm:pt-8">
          <HomeMetaIntroSection />

          <div id="site-content" className="home-body-ink scroll-mt-14">
            <section className="demo-design-dir__section demo-design-dir__section--band-b py-16 sm:py-20">
              <div className="demo-design-dir__shell">
                <p className="demo-design-dir__body max-w-[40rem]">{tHero("trustHeadline")}</p>
                <div className="relative mt-10 rounded-2xl border border-white/[0.07] bg-black/25 py-12">
                  <div className="demo-design-dir__axis-line opacity-100" aria-hidden />
                </div>
                <div className="mt-10">
                  <FinalCta cancelled={cancelled} orderEmbedded />
                </div>
              </div>
            </section>

            <section className="demo-design-dir__section demo-design-dir__section--band-c py-16 sm:py-20">
              <HowItWorksSignalGrid />
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
