import { Faq } from "@/components/Faq";
import { FinalCta } from "@/components/FinalCta";
import { HomePageMotionShell } from "@/components/home/HomePageMotionShell";
import { CinematicHomeShell } from "@/components/home/CinematicHomeShell";
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
      <CinematicHomeShell>
        <MarketingHero />
        <InvestigationLabSection />
        <HowItWorks tone="dark" />

        <div
          id="site-content"
          className="relative overflow-hidden scroll-mt-14 border-t border-white/10 bg-transparent text-white"
        >
          <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.18]">
            <HeroVisual />
          </div>
          <div className="pointer-events-none absolute inset-0 z-[1] provin-noise opacity-[0.16]" aria-hidden />
          <div
            className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(to_bottom,#050505,#0a1020,#050505)] opacity-[0.85]"
            aria-hidden
          />

          <div className="relative z-10">
            <div className="relative overflow-hidden rounded-t-[1.75rem] border border-white/10 border-b-0 bg-[#0a0a0a]/80 shadow-[0_-24px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
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
        </div>
        <Faq />
        <Footer />
      </CinematicHomeShell>
    </HomePageMotionShell>
  );
}
