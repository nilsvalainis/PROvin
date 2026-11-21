import { describe, expect, it } from "vitest";

import { resolveDealerNoDataAlertContext } from "@/lib/dealer-data-alert-no-data";

const WALLET_NOTES =
  "B2B dealer · partner_id=ptr_0123456789abcdef · wallet_txn=wtx_1_1_abc · wallet_product=dealer_raw · wallet_cents=1999";

describe("resolveDealerNoDataAlertContext", () => {
  it("parasts pasūtījums: 24,99 €, jāatmaksā manuāli", () => {
    expect(resolveDealerNoDataAlertContext({ notes: "" })).toEqual({
      send: true,
      amountLabel: "24,99 €",
      wallet: false,
    });
  });

  it("Stripe jau atmaksāts - nesūta", () => {
    expect(resolveDealerNoDataAlertContext({ notes: "", stripeRefundedCents: 2499 })).toEqual({
      send: false,
      reason: "stripe_refunded",
    });
    expect(resolveDealerNoDataAlertContext({ notes: "", stripeRefundedCents: 0 }).send).toBe(true);
  });

  it("B2B maks (automātiskā atmaksa neizdevās): maka summa un norāde «makā»", () => {
    expect(resolveDealerNoDataAlertContext({ notes: WALLET_NOTES })).toEqual({
      send: true,
      amountLabel: "19,99 €",
      wallet: true,
    });
  });

  it("B2B maks bez summas: produkta noklusētā cena", () => {
    const notes = "B2B dealer · wallet_txn=wtx_2 · wallet_product=dealer_pro";
    expect(resolveDealerNoDataAlertContext({ notes })).toMatchObject({ amountLabel: "24,99 €", wallet: true });
  });
});
