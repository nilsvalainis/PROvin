import { Faq } from "@/components/Faq";
import { FinalCta } from "@/components/FinalCta";
import { AutoWireframeBackground } from "@/components/home/AutoWireframeBackground";
import { HomeScrollSurface } from "@/components/home/HomeScrollSurface";
import { HomeProcessRail } from "@/components/home/HomeProcessRail";
import { MarketingHero } from "@/components/home/MarketingHero";
import { InvestigationLabSection } from "@/components/home/investigation-lab/InvestigationLabSection";
import { HowItWorks } from "@/components/HowItWorks";
import { IrissSection } from "@/components/IrissSection";
import { PricingIncluded } from "@/components/PricingIncluded";
import { Footer } from "@/components/Footer";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ atcelts?: string }>;
}) {
  const sp = await searchParams;
  const cancelled = sp.atcelts === "1";

  return (
    <HomeScrollSurface wireframe={<AutoWireframeBackground />}>
      <div className="relative z-10 min-w-0 bg-transparent">
        <HomeProcessRail />
        <MarketingHero />

        <div className="home-below-hero home-body-ink bg-transparent">
          <InvestigationLabSection />
          <HowItWorks tone="light" variant="silver" />

          <div
            id="site-content"
            className="home-site-rule home-body-ink relative scroll-mt-14 border-t border-transparent bg-transparent"
          >
            <div className="relative z-10 bg-transparent pt-10 sm:pt-14 md:pt-16">
              <FinalCta cancelled={cancelled} />
            </div>
            <PricingIncluded />
            <IrissSection />
          </div>
          <Faq tone="silver" />
          <Footer />
        </div>
      </div>
    </HomeScrollSurface>
  );
}
