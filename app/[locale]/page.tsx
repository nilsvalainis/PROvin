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
      <HowItWorks />
      <Faq />
      <FinalCta cancelled={cancelled} />
      <Footer />
    </>
  );
}
