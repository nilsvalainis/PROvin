import { Faq } from "@/components/Faq";
import { FinalCta } from "@/components/FinalCta";
import { HomePageMotionShell } from "@/components/home/HomePageMotionShell";
import { MarketingHero } from "@/components/home/MarketingHero";
import { InvestigationLabSection } from "@/components/home/investigation-lab/InvestigationLabSection";
import { HeroVisual } from "@/components/HeroVisual";
import { HowItWorks } from "@/components/HowItWorks";
import { homeFlowModuleGradientTerminalClass } from "@/lib/home-layout";
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
    <HomePageMotionShell>
      <MarketingHero />
      <InvestigationLabSection />
      <HowItWorks tone="dark" />

      <div
        id="site-content"
        className="relative overflow-hidden scroll-mt-14 border-t border-white/10 bg-[#050505] text-white"
      >
        <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.2]">
          <HeroVisual />
        </div>
        <div className="pointer-events-none absolute inset-0 z-[1] provin-noise opacity-[0.18]" aria-hidden />
        <div
          className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(to_bottom,#050505,#0a1020,#050505)] opacity-[0.9]"
          aria-hidden
        />

        <div className="relative z-10">
          <div className="relative">
            <div
              className={`pointer-events-none absolute inset-0 z-0 ${homeFlowModuleGradientTerminalClass}`}
              aria-hidden
            />
            <div className="relative z-10 pt-10 sm:pt-14 md:pt-16">
              <FinalCta cancelled={cancelled} />
            </div>
          </div>
          <PricingIncluded />
          <IrissSection />
        </div>
      </div>
      <Faq />
      <Footer />
    </HomePageMotionShell>
  );
}
