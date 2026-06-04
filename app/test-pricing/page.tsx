import { Suspense } from "react";
import { TestPricingPage } from "@/components/test-pricing/TestPricingPage";

export const metadata = {
  title: "PROVIN — testa cenas",
  robots: { index: false, follow: false },
};

export default function TestPricingRoutePage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#121418]" aria-busy="true" />}>
      <TestPricingPage />
    </Suspense>
  );
}
