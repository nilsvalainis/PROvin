import "server-only";

import { createJsonDocStore } from "@/lib/b2b-json-doc-store";
import {
  emptyStripePaymentAdjustmentsDoc,
  parseStripePaymentAdjustmentsDoc,
  type StripePaymentAdjustment,
  type StripePaymentAdjustmentsDoc,
} from "@/lib/stripe-payment-adjustments";

/** Viens dokuments (atmaksas un strīdi ir reti), atomāri ar `ifMatch`. */
const DOC_KEY = "index";

const store = createJsonDocStore<StripePaymentAdjustmentsDoc>({
  blobPrefix: "stripe-payment-adjustments/",
  dirName: "stripe-payment-adjustments",
  isSafeKey: (key) => key === DOC_KEY,
  parse: parseStripePaymentAdjustmentsDoc,
  empty: emptyStripePaymentAdjustmentsDoc,
});

export async function readStripePaymentAdjustments(): Promise<StripePaymentAdjustmentsDoc> {
  return store.read(DOC_KEY);
}

/** Atomāra viena ieraksta mutācija. `next` nav = nekas netiek rakstīts. */
export function updateStripePaymentAdjustment<R>(
  sessionId: string,
  mutate: (
    current: StripePaymentAdjustment | undefined,
  ) => { value: R; next?: StripePaymentAdjustment },
): Promise<R> {
  return store.update(DOC_KEY, (doc) => {
    const r = mutate(doc.bySession[sessionId]);
    if (!r.next) return { value: r.value };
    return {
      value: r.value,
      next: { ...doc, bySession: { ...doc.bySession, [sessionId]: r.next } },
    };
  });
}
