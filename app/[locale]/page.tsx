import { Faq } from "@/components/Faq";
import { FinalCta } from "@/components/FinalCta";
import { HomePageMotionShell } from "@/components/home/HomePageMotionShell";
import { MarketingHero } from "@/components/home/MarketingHero";
import { InvestigationLabSection } from "@/components/home/investigation-lab/InvestigationLabSection";
import { HeroVisual } from "@/components/HeroVisual";
import { HowItWorks } from "@/components/HowItWorks";
import { homeFlowModuleGradientClass } from "@/lib/home-layout";
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
        className="relative overflow-hidden scroll-mt-14 border-t border-white/10 bg-[#08080a] text-[var(--color-apple-text)]"
      >
        <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.22]">
          <HeroVisual />
        </div>
        <div className="pointer-events-none absolute inset-0 z-[1] provin-noise opacity-[0.2]" aria-hidden />
        <div
          className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(to_bottom,#0a1020,#08080a,#0c1424)] opacity-[0.88]"
          aria-hidden
        />

        <div className="relative z-10">
          <div className="relative rounded-t-[1.75rem] bg-[#fafafa] shadow-[0_-24px_80px_rgba(0,0,0,0.45)]">
            <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(to_bottom,#ffffff,#f9fafb,#ffffff)] opacity-95" aria-hidden />

            <div className="relative">
              <div
                className={`pointer-events-none absolute inset-0 z-0 ${homeFlowModuleGradientClass}`}
                aria-hidden
              />
              <div className="relative z-10 pt-10 sm:pt-14 md:pt-16">
                <FinalCta cancelled={cancelled} />
              </div>
            </div>
            <PricingIncluded />
          </div>
          <IrissSection />
        </div>
      </div>
      <Faq />
      <Footer />
    </HomePageMotionShell>
  );
}
