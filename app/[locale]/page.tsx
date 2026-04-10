import { Faq } from "@/components/Faq";
import { FinalCta } from "@/components/FinalCta";
import { AutoWireframeBackground } from "@/components/home/AutoWireframeBackground";
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
    <div className="relative min-w-0 bg-[#050505]">
      <AutoWireframeBackground />
      <div className="relative z-10 min-w-0">
        <HomeProcessRail />
        <MarketingHero />
        <InvestigationLabSection />
        <HowItWorks tone="dark" />

        <div
          id="site-content"
          className="relative scroll-mt-14 border-t border-white/10 bg-transparent text-white"
        >
          <div className="relative z-10 pt-10 sm:pt-14 md:pt-16">
            <FinalCta cancelled={cancelled} />
          </div>
          <PricingIncluded />
          <IrissSection />
        </div>
        <Faq />
        <Footer />
      </div>
    </div>
  );
}
