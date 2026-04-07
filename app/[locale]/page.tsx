import { AutoRecordsSiteFootnote } from "@/components/AutoRecordsSiteFootnote";
import { Faq } from "@/components/Faq";
import { FinalCta } from "@/components/FinalCta";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { IrissSection } from "@/components/IrissSection";
import { PricingIncluded } from "@/components/PricingIncluded";
import { WhyProvin } from "@/components/WhyProvin";
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
      <WhyProvin />
      <IrissSection />
      <section className="relative overflow-hidden bg-gradient-to-b from-white to-provin-surface-2/50">
        <div className="pointer-events-none absolute inset-0 provin-noise opacity-30" aria-hidden />
        <HowItWorks />
        <FinalCta cancelled={cancelled} />
      </section>
      <Faq />
      <AutoRecordsSiteFootnote />
      <Footer />
    </>
  );
}
