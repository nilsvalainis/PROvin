import { describe, expect, it } from "vitest";
import { sortAdminOrdersIncompleteFirst } from "@/lib/admin-audit-deadline-complete";
import {
  MINI_TO_AUDITS_PAYMENT_LINK_PLACEHOLDER,
  MINI_TO_AUDITS_RECOMMENDATION_LABEL,
} from "@/lib/email/mini-to-audits-recommendation";
import {
  availableUpsellQuotes,
  buildOrderUpsellCheckoutSessionParams,
  buildOrderUpsellStripeMetadata,
  buildUpsellDraft,
  DEALER_TO_AUDIT_CENTS,
  ensureUpsellUrlInText,
  isStripeHostedPaymentUrl,
  MINI_CATALOG_CENTS,
  MINI_DEALER_ADDON_CENTS,
  quoteOrderUpsell,
  upsellKindButtonLabel,
  upsellListOverlay,
  type UpsellOfferSnapshot,
} from "@/lib/order-upsell";

function offer(partial: Partial<UpsellOfferSnapshot> & Pick<UpsellOfferSnapshot, "kind" | "status">): UpsellOfferSnapshot {
  return {
    chargeCents: 7500,
    priorCents: 2499,
    targetCents: 9999,
    targetLine: "audit",
    expiresAt: "2099-01-01T00:00:00.000Z",
    token: "a".repeat(32),
    ...partial,
  };
}

describe("order upsell quotes", () => {
  it("charges 75 EUR to turn dealer data into a full audit", () => {
    const q = quoteOrderUpsell("dealer_to_audit", { checkoutLine: "dealer", amountTotalCents: 2499 });
    expect(q).toMatchObject({
      chargeCents: DEALER_TO_AUDIT_CENTS,
      priorCents: 2499,
      targetCents: 9999,
      targetLine: "audit",
    });
  });

  it("does not offer a consumer 20% audit price", () => {
    const quotes = availableUpsellQuotes({ checkoutLine: "dealer", amountTotalCents: 2499 });
    expect(quotes.map((q) => q.chargeCents)).not.toContain(7999);
    const draft = buildUpsellDraft({
      kind: "dealer_to_audit",
      vin: "WAUZZZF44LA062962",
      url: "https://provin.lv/lv/papildinajums/abc",
      priorCents: 2499,
      chargeCents: 7500,
      targetCents: 9999,
    });
    expect(draft.emailText).toContain("75,00 €");
    expect(draft.emailText).toContain("24,99 €");
    expect(draft.emailText).toContain("99,99 €");
    expect(draft.emailText).not.toContain("20%");
    expect(draft.emailText).not.toContain("79,99");
    expect(draft.whatsappText).not.toMatch(/—/);
    expect(draft.emailText).not.toMatch(/–/);
  });

  it("offers MINI a dealer add-on at 19,99 and the audit remainder without a discount", () => {
    const order = { checkoutLine: "mini" as const, amountTotalCents: 3999 };
    expect(quoteOrderUpsell("mini_to_dealer", order)?.chargeCents).toBe(MINI_DEALER_ADDON_CENTS);
    const auditQuote = quoteOrderUpsell("mini_to_audit", order);
    expect(auditQuote).toMatchObject({
      chargeCents: 6000,
      priorCents: 3999,
      targetCents: 9999,
    });
    expect(upsellKindButtonLabel(auditQuote!)).toBe(MINI_TO_AUDITS_RECOMMENDATION_LABEL);
    const afterDealer = [
      offer({
        kind: "mini_to_dealer",
        status: "paid",
        chargeCents: 1999,
        priorCents: 3999,
        targetCents: 5998,
        targetLine: "mini",
        paidAt: "2026-09-01T10:00:00.000Z",
      }),
    ];
    expect(quoteOrderUpsell("mini_to_dealer", order, afterDealer)).toBeNull();
    expect(quoteOrderUpsell("mini_to_audit", order, afterDealer)?.chargeCents).toBe(4001);
  });

  it("stops offers after the order is already a full audit", () => {
    const settled = [
      offer({
        kind: "dealer_to_audit",
        status: "manual",
        paidAt: "2026-09-02T10:00:00.000Z",
      }),
    ];
    expect(availableUpsellQuotes({ checkoutLine: "dealer", amountTotalCents: 2499 }, settled)).toEqual([]);
  });

  it("overlays the list with the new total and a fresh 48h anchor", () => {
    const overlay = upsellListOverlay([
      offer({
        kind: "dealer_to_audit",
        status: "paid",
        paidAt: "2026-09-27T12:00:00.000Z",
      }),
    ]);
    expect(overlay?.targetCents).toBe(9999);
    expect(overlay?.targetLine).toBe("audit");
    expect(overlay?.badge).toContain("24,99 € + 75,00 €");
    expect(overlay?.paidAtUnix).toBe(Math.floor(Date.parse("2026-09-27T12:00:00.000Z") / 1000));
  });

  it("keeps an open offer from changing the order", () => {
    expect(
      upsellListOverlay([
        offer({ kind: "dealer_to_audit", status: "open" }),
      ]),
    ).toBeNull();
  });

  it("builds the MINI to AUDITS recommendation with name, car and difference", () => {
    const stripePay = "https://checkout.stripe.com/c/pay/cs_test_a1b2c3";
    const draft = buildUpsellDraft({
      kind: "mini_to_audit",
      customerName: "Anna Kalniņa",
      car: "VW Passat",
      vin: "WVWZZZ3CZE123456",
      url: stripePay,
      priorCents: MINI_CATALOG_CENTS,
      chargeCents: 6000,
      targetCents: 9999,
    });
    expect(draft.subject).toContain(MINI_TO_AUDITS_RECOMMENDATION_LABEL);
    expect(draft.emailText).toContain("Labdien, Anna Kalniņa!");
    expect(draft.emailText).toContain("VW Passat (VIN WVWZZZ3CZE123456)");
    expect(draft.emailText).toContain("39,99 €");
    expect(draft.emailText).toContain("60,00 €");
    expect(draft.emailText).toContain("99,99 €");
    expect(draft.emailText).toContain(`Apmaksāt: ${stripePay}`);
    expect(isStripeHostedPaymentUrl(stripePay)).toBe(true);
    expect(draft.emailText.toLowerCase()).not.toContain("ekspert");
    expect(draft.emailText).not.toMatch(/\u2014|\u2013/);
  });

  it("puts order id and VIN on the Stripe Checkout session so payment upgrades to AUDITS", () => {
    const params = buildOrderUpsellCheckoutSessionParams({
      kind: "mini_to_audit",
      chargeCents: 6000,
      parentSessionId: "cs_test_order123",
      token: "a".repeat(32),
      targetLine: "audit",
      vin: "WVWZZZ3CZE123456",
      email: "anna@example.com",
      origin: "https://www.provin.lv",
    });
    expect(params.mode).toBe("payment");
    expect(params.customer_email).toBe("anna@example.com");
    expect(params.line_items[0]?.price_data.unit_amount).toBe(6000);
    expect(params.metadata).toEqual(
      buildOrderUpsellStripeMetadata({
        parentSessionId: "cs_test_order123",
        kind: "mini_to_audit",
        token: "a".repeat(32),
        targetLine: "audit",
        vin: "WVWZZZ3CZE123456",
      }),
    );
    expect(params.metadata.fulfillment).toBe("order_upsell");
    expect(params.metadata.order_id).toBe("cs_test_order123");
    expect(params.metadata.upgrade_of).toBe("cs_test_order123");
    expect(params.metadata.upgrade_kind).toBe("mini_to_audit");
    expect(params.metadata.checkout_line).toBe("audit");
    expect(params.metadata.vin).toBe("WVWZZZ3CZE123456");
  });

  it("appends the pay link if the operator removed it", () => {
    expect(ensureUpsellUrlInText("Sveiki", "https://checkout.stripe.com/c/pay/cs_test_x")).toBe(
      "Sveiki\n\nApmaksāt: https://checkout.stripe.com/c/pay/cs_test_x",
    );
  });

  it("fills the payment-link placeholder", () => {
    expect(
      ensureUpsellUrlInText(
        `Labdien!\n\nApmaksāt: ${MINI_TO_AUDITS_PAYMENT_LINK_PLACEHOLDER}`,
        "https://checkout.stripe.com/c/pay/cs_test_x",
      ),
    ).toContain("https://checkout.stripe.com/c/pay/cs_test_x");
  });

  it("sorts a fresh upsell above older incomplete orders", () => {
    const rows = [
      { id: "newer-open", created: 500, activityUnix: 500 },
      { id: "old-upsell", created: 100, activityUnix: 900 },
    ];
    expect(sortAdminOrdersIncompleteFirst(rows).map((r) => r.id)).toEqual(["old-upsell", "newer-open"]);
  });
});
