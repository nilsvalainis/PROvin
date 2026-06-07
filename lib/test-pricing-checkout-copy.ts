import type { TestPricingPlanId } from "@/lib/test-pricing-plans";

export type TestPricingCheckoutFormCopy = {
  title: string;
  lead: string;
};

const CHECKOUT_FORM_COPY: Record<TestPricingPlanId, TestPricingCheckoutFormCopy> = {
  mini: {
    title: "Pabeidz pasūtījumu — PROVIN MINI",
    lead: "Ievadi sludinājuma saiti un VIN kodu.",
  },
  plus: {
    title: "Pabeidz pasūtījumu — PROVIN PLUS",
    lead: "Ievadi sludinājuma saiti un VIN kodu.",
  },
  premium: {
    title: "Pabeidz pasūtījumu — PROVIN AUDITS",
    lead: "Ievadi sludinājuma saiti un VIN kodu.",
  },
};

export function getTestPricingCheckoutFormCopy(
  planId: TestPricingPlanId,
): TestPricingCheckoutFormCopy {
  return CHECKOUT_FORM_COPY[planId];
}
