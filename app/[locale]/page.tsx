import { Faq } from "@/components/Faq";
import { FinalCta } from "@/components/FinalCta";
import { Hero } from "@/components/Hero";
import { HeroVisual } from "@/components/HeroVisual";
import { HowItWorks } from "@/components/HowItWorks";
import { homeFlowModuleGradientClass } from "@/lib/home-layout";
import { IrissSection } from "@/components/IrissSection";
import { PricingIncluded } from "@/components/PricingIncluded";
import { PricingTransitionAndComparison } from "@/components/PricingTransitionAndComparison";
import { Footer } from "@/components/Footer";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ atcelts?: string }>;
}) {
  const sp = await searchParams;
  const cancelled = sp.atcelts === "1";

  return (
    <>
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 z-0">
          <HeroVisual />
        </div>
        <div className="pointer-events-none absolute inset-0 z-[1] provin-noise opacity-[0.32]" aria-hidden />
        <div
          className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(to_bottom,#ffffff,#f9fafb,#ffffff)] opacity-90"
          aria-hidden
        />

        <div className="relative z-10">
          <div className="relative">
            <div
              className={`pointer-events-none absolute inset-0 z-0 ${homeFlowModuleGradientClass}`}
              aria-hidden
            />
            <div className="relative z-10">
              <Hero />
              <HowItWorks />
              <FinalCta cancelled={cancelled} />
            </div>
          </div>
          <PricingIncluded />
          <section id="cena" className="px-4 pt-0 sm:px-6 md:pt-8">
            <div className="mx-auto w-full max-w-[1000px]">
              <PricingTransitionAndComparison />
            </div>
          </section>
          <IrissSection />
        </div>
      </div>
      <Faq />
      <Footer />
    </>
  );
}
