import type { TestPricingPlanId } from "@/lib/test-pricing-plans";

/** Capsule tab display labels on `/test-pricing-5`. */
export const TP5_TAB_LABEL = {
  mini: "19,99 €",
  plus: "39,99 €",
  premium: "PRO",
} as const;

/** Dynamic baseline CTA copy on `/test-pricing-5`. */
export const TP5_CTA_LABEL = {
  mini: "PASŪTĪT AUDITU — 19,99 €",
  plus: "PASŪTĪT AUDITU — 39,99 €",
  premium: "PASŪTĪT PRO AUDITU — 99,99 €",
} as const;

/** Hard-coded `plan` query values for `/test-checkout`. */
export const TP5_CHECKOUT_PLAN_QUERY = {
  mini: "19.99",
  plus: "39.99",
  premium: "PRO",
} as const;

export const TP5_CHECKOUT_SOURCE = "test-checkout" as const;

export function getTp5CheckoutHref(planId: TestPricingPlanId): string {
  return `/test-checkout?plan=${TP5_CHECKOUT_PLAN_QUERY[planId]}`;
}

export function resolveTp5PlanFromCheckoutQuery(
  param: string | null | undefined,
): TestPricingPlanId | null {
  if (!param) return null;
  const normalized = param.trim();
  if (normalized === "19.99") return "mini";
  if (normalized === "39.99") return "plus";
  if (normalized.toUpperCase() === "PRO") return "premium";
  return null;
}
