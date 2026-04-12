import { Faq } from "@/components/Faq";
import { FinalCta } from "@/components/FinalCta";
import { AutoWireframeBackground } from "@/components/home/AutoWireframeBackground";
import { HomeScrollSurface } from "@/components/home/HomeScrollSurface";
import { MarketingHero } from "@/components/home/MarketingHero";
import { HowItWorks } from "@/components/HowItWorks";
import { IrissSection } from "@/components/IrissSection";
import { PricingIncluded } from "@/components/PricingIncluded";
import { Footer } from "@/components/Footer";
import "./demo/design-direction/demo-design-direction.css";

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
        <MarketingHero homeOrbitPreset="s20" />

        <div className="home-below-hero home-body-ink demo-design-dir min-w-0">
          <div className="demo-design-dir__section demo-design-dir__section--band-a">
            <HowItWorks tone="dark" />
          </div>

          <div className="demo-design-dir__shell home-body-ink h-px bg-white/[0.07]" aria-hidden />

          <div className="demo-design-dir__section demo-design-dir__section--band-b">
            <div
              id="site-content"
              className="home-body-ink relative scroll-mt-14 border-0 bg-transparent"
            >
              <div className="relative z-10 bg-transparent pt-10 sm:pt-14 md:pt-16">
                <FinalCta cancelled={cancelled} />
              </div>
              <PricingIncluded />
              <IrissSection />
            </div>
          </div>
          <div className="demo-design-dir__section demo-design-dir__section--band-c">
            <Faq />
          </div>
          <Footer />
        </div>
      </div>
    </HomeScrollSurface>
  );
}
