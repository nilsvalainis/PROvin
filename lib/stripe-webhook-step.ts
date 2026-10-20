import "server-only";

import {
  completeStripeEvent,
  releaseStripeEvent,
  tryBeginStripeEvent,
} from "@/lib/stripe-webhook-dedupe-store";

export type StripeFulfillmentStep = "notify" | "downstream" | "customer-email";

export function stripeFulfillmentStepKey(step: StripeFulfillmentStep, sessionId: string): string {
  return `fulfill-${step}:${sessionId}`;
}

/**
 * Viens izpildes solis vienai apmaksātai sesijai. Ja Stripe atkārto webhook pēc vēlāka soļa
 * kļūdas, jau pabeigtie soļi (admin paziņojums, klienta e-pasts, ielase) netiek atkārtoti.
 * Kļūdas gadījumā solis tiek atbrīvots, lai nākamais atkārtojums to izpildītu.
 */
export async function runStripeFulfillmentStepOnce(
  step: StripeFulfillmentStep,
  sessionId: string,
  fn: () => Promise<void>,
): Promise<"ran" | "skipped"> {
  const key = stripeFulfillmentStepKey(step, sessionId);
  if (!(await tryBeginStripeEvent(key))) return "skipped";
  try {
    await fn();
  } catch (e) {
    await releaseStripeEvent(key);
    throw e;
  }
  await completeStripeEvent(key);
  return "ran";
}
