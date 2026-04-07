import { Faq } from "@/components/Faq";
import { FinalCta } from "@/components/FinalCta";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
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
      <Hero />
      <section className="bg-gradient-to-b from-white via-[#f8fafc] to-[#f0f4f8]">
        <HowItWorks />
      </section>

      <section className="bg-gradient-to-b from-[#f0f4f8] to-[#eef3f8]">
        <PricingIncluded />
      </section>

      <section className="bg-white px-4 pt-8 sm:px-6 md:pt-12">
        <div className="mx-auto w-full max-w-[1200px]">
          <PricingTransitionAndComparison />
        </div>
      </section>

      <section className="bg-white">
        <IrissSection />
      </section>

      <section className="border-b border-black/[0.06] bg-white">
        <div className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(to_bottom,#ffffff,#f0f4f8,#ffffff)] opacity-85"
            aria-hidden
          />
          <div className="relative z-10">
            <FinalCta cancelled={cancelled} />
          </div>
        </div>
      </section>
      <Faq />
      <Footer />
    </>
  );
}
