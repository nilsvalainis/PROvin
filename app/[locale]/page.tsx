import { Faq } from "@/components/Faq";
import { FinalCta } from "@/components/FinalCta";
import { Hero } from "@/components/Hero";
import { HeroVisual } from "@/components/HeroVisual";
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
    <>
      <Hero />
      <PricingIncluded />
      <IrissSection />
      <section className="border-b border-black/[0.06]">
        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 z-0">
            <HeroVisual />
          </div>
          <div
            className="pointer-events-none absolute inset-0 z-[1] provin-noise opacity-[0.38]"
            aria-hidden
          />
          <HowItWorks />
          <FinalCta cancelled={cancelled} />
        </div>
      </section>
      <Faq />
      <Footer />
    </>
  );
}
