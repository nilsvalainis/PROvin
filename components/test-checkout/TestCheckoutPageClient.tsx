"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TestCheckoutForm } from "@/components/test-checkout/TestCheckoutForm";
import { resolveTp5PlanFromCheckoutQuery } from "@/lib/test-pricing-5-checkout-routing";

export function TestCheckoutPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = resolveTp5PlanFromCheckoutQuery(searchParams.get("plan"));

  useEffect(() => {
    if (!planId) {
      router.replace("/test-pricing-5");
    }
  }, [planId, router]);

  if (!planId) return null;

  return <TestCheckoutForm planId={planId} />;
}
