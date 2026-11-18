/**
 * `/api/checkout/test-pricing` ievades robeža: tikai publiski pārdodami plāni, avota lapa pēc
 * saraksta un atteikuma tiesību piekrišana vienmēr. Agrāk `planId=mini` + nezināms `sourcePage`
 * izveidoja 19,99 € sesiju bez VIN pārbaudes un bez piekrišanas.
 */

import { isTestPricingModalCheckoutPage } from "@/lib/test-pricing-checkout-pages";
import { isTestPricingPlanId, type TestPricingPlanId } from "@/lib/test-pricing-plans";
import {
  isTp5PublicServiceId,
  TP5_MOBILE_CHECKOUT_PLAN,
  type Tp5MobileServiceId,
} from "@/lib/test-pricing-5-mobile";

/** Plāni, kurus publiskā vietne pašlaik pārdod (paslēptie - MINI, Koreja/ASV - nē). */
export function publicTestPricingPlanIds(): TestPricingPlanId[] {
  const ids = Object.keys(TP5_MOBILE_CHECKOUT_PLAN) as Tp5MobileServiceId[];
  return [...new Set(ids.filter(isTp5PublicServiceId).map((id) => TP5_MOBILE_CHECKOUT_PLAN[id]))];
}

export type TestPricingCheckoutGuardResult =
  | { ok: true; planId: TestPricingPlanId; sourcePage: string }
  | { ok: false; status: 400 | 404; reason: "invalid_plan" | "plan_not_public" | "invalid_source" | "consent_required" };

export function guardTestPricingCheckout(raw: {
  planId?: unknown;
  sourcePage?: unknown;
  withdrawalConsent?: unknown;
}): TestPricingCheckoutGuardResult {
  const planId = typeof raw.planId === "string" ? raw.planId.trim() : "";
  if (!isTestPricingPlanId(planId)) return { ok: false, status: 400, reason: "invalid_plan" };
  if (!publicTestPricingPlanIds().includes(planId)) return { ok: false, status: 404, reason: "plan_not_public" };
  const sourcePage = typeof raw.sourcePage === "string" ? raw.sourcePage.trim() : "";
  if (!isTestPricingModalCheckoutPage(sourcePage)) return { ok: false, status: 400, reason: "invalid_source" };
  if (raw.withdrawalConsent !== true) return { ok: false, status: 400, reason: "consent_required" };
  return { ok: true, planId, sourcePage };
}
