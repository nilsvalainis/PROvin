import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyManualOrderStripePayment,
  attachManualOrderCheckoutFields,
  buildManualOrderCheckoutSessionParams,
  buildManualOrderPaymentDraft,
  buildManualOrderStripeMetadata,
  canReuseManualOrderCheckout,
  ensureManualOrderPayUrlInText,
  isManualOrderPaymentFulfillment,
  isManualOrderStripePaid,
  MANUAL_ORDER_PAYMENT_FULFILLMENT,
  manualOrderIdFromStripeMetadata,
  parseManualOrderPayAmountToCents,
  parseManualOrderPaymentInput,
  suggestManualOrderServiceName,
} from "@/lib/manual-order-payment";
import { CLIENT_LINK_FULFILLMENT } from "@/lib/client-link";

const ROOT = process.cwd();
const MANUAL_ID = "manual_order_1700000000000_ab12";

function rec(partial: Partial<{ id: string; amountTotal: number | null; paidAt?: string; paidStripeSessionId?: string }> = {}) {
  return {
    id: MANUAL_ID,
    amountTotal: 0,
    ...partial,
  };
}

describe("manual order payment input", () => {
  it("accepts custom EUR amount and service name for the existing manual order", () => {
    const parsed = parseManualOrderPaymentInput({
      amountCents: 12550,
      serviceName: "PROVIN AUDITS - Audi A3",
    });
    expect(parsed).toEqual({
      ok: true,
      amountCents: 12550,
      serviceName: "PROVIN AUDITS - Audi A3",
    });
    expect(parseManualOrderPayAmountToCents("125,50")).toBe(12550);
    expect(parseManualOrderPayAmountToCents("125.50 €")).toBe(12550);
  });

  it("rejects missing amount or name", () => {
    expect(parseManualOrderPaymentInput({ serviceName: "PROVIN AUDITS" })).toEqual({
      ok: false,
      error: "missing_amount",
    });
    expect(parseManualOrderPaymentInput({ amountCents: 9999, serviceName: "   " })).toEqual({
      ok: false,
      error: "missing_name",
    });
    expect(parseManualOrderPaymentInput({ amountEur: "0", serviceName: "PROVIN AUDITS" })).toEqual({
      ok: false,
      error: "invalid_amount",
    });
    expect(parseManualOrderPaymentInput({ amountCents: 50, serviceName: "PROVIN AUDITS" })).toEqual({
      ok: false,
      error: "invalid_amount",
    });
    expect(parseManualOrderPaymentInput({ amountCents: 600_000, serviceName: "PROVIN AUDITS" })).toEqual({
      ok: false,
      error: "invalid_amount",
    });
  });
});

describe("manual order Stripe checkout", () => {
  it("creates checkout params with custom amount and name tied to the same manual_order id", () => {
    const params = buildManualOrderCheckoutSessionParams({
      manualOrderId: MANUAL_ID,
      amountCents: 12550,
      serviceName: "PROVIN AUDITS - Audi A3",
      email: "anna@example.com",
      vin: "WAUZZZ8V0KA000001",
      origin: "https://www.provin.lv",
    });
    expect(params.mode).toBe("payment");
    expect(params.customer_email).toBe("anna@example.com");
    expect(params.line_items[0]?.price_data.unit_amount).toBe(12550);
    expect(params.line_items[0]?.price_data.product_data.name).toBe("PROVIN AUDITS - Audi A3");
    expect(params.metadata).toEqual(
      buildManualOrderStripeMetadata({
        manualOrderId: MANUAL_ID,
        vin: "WAUZZZ8V0KA000001",
        serviceName: "PROVIN AUDITS - Audi A3",
      }),
    );
    expect(params.metadata.fulfillment).toBe(MANUAL_ORDER_PAYMENT_FULFILLMENT);
    expect(params.metadata.fulfillment).not.toBe(CLIENT_LINK_FULFILLMENT);
    expect(params.metadata.manual_order_id).toBe(MANUAL_ID);
    expect(params.metadata.order_id).toBe(MANUAL_ID);
    expect(params.success_url).toContain("/lv/paldies?session_id={CHECKOUT_SESSION_ID}");
  });

  it("reuses an open checkout only when amount and name match", () => {
    const attached = attachManualOrderCheckoutFields(rec({ amountTotal: null }), {
      amountCents: 9999,
      serviceName: "PROVIN AUDITS",
      stripeCheckoutSessionId: "cs_test_open",
      stripeCheckoutUrl: "https://checkout.stripe.com/c/pay/cs_test_open",
    });
    expect(attached.id).toBe(MANUAL_ID);
    expect(canReuseManualOrderCheckout(attached, 9999, "PROVIN AUDITS")).toBe(true);
    expect(canReuseManualOrderCheckout(attached, 5000, "PROVIN AUDITS")).toBe(false);
    expect(canReuseManualOrderCheckout(attached, 9999, "Cits")).toBe(false);
  });
});

describe("manual order payment fulfillment", () => {
  it("marks the same manual_order id paid and does not invent a second order id", () => {
    const first = applyManualOrderStripePayment(
      rec({ amountTotal: 12550 }),
      { stripeSessionId: "cs_pay_1", amountCents: 12550 },
      "2026-11-02T12:00:00.000Z",
    );
    expect(first.action).toBe("apply");
    expect(first.next.id).toBe(MANUAL_ID);
    expect(first.next.paidStripeSessionId).toBe("cs_pay_1");
    expect(first.next.paidAt).toBe("2026-11-02T12:00:00.000Z");
    expect(first.next.amountTotal).toBe(12550);
    expect(isManualOrderStripePaid(first.next)).toBe(true);

    const retry = applyManualOrderStripePayment(
      first.next,
      { stripeSessionId: "cs_pay_1", amountCents: 12550 },
      "2026-11-02T12:05:00.000Z",
    );
    expect(retry.action).toBe("idempotent");
    expect(retry.next.id).toBe(MANUAL_ID);
    expect(retry.next.paidAt).toBe("2026-11-02T12:00:00.000Z");

    const extra = applyManualOrderStripePayment(
      first.next,
      { stripeSessionId: "cs_pay_2", amountCents: 5000 },
      "2026-11-02T13:00:00.000Z",
    );
    expect(extra.action).toBe("extra");
    expect(extra.next.id).toBe(MANUAL_ID);
    expect(extra.next.paidStripeSessionId).toBe("cs_pay_1");
    expect(extra.next.amountTotal).toBe(12550);
  });

  it("reads only the existing manual order from Stripe metadata", () => {
    expect(
      manualOrderIdFromStripeMetadata({
        fulfillment: MANUAL_ORDER_PAYMENT_FULFILLMENT,
        manual_order_id: MANUAL_ID,
        order_id: MANUAL_ID,
      }),
    ).toBe(MANUAL_ID);
    expect(
      manualOrderIdFromStripeMetadata({
        fulfillment: CLIENT_LINK_FULFILLMENT,
        order_id: MANUAL_ID,
      }),
    ).toBeNull();
    expect(isManualOrderPaymentFulfillment(MANUAL_ORDER_PAYMENT_FULFILLMENT)).toBe(true);
    expect(isManualOrderPaymentFulfillment("client_link")).toBe(false);
    expect(isManualOrderPaymentFulfillment("order_upsell")).toBe(false);
  });
});

describe("manual order payment copy", () => {
  it("builds a pay request without unicode dashes or a new-order promise", () => {
    const draft = buildManualOrderPaymentDraft({
      serviceName: "PROVIN AUDITS - Audi A3",
      amountCents: 12550,
      url: "https://checkout.stripe.com/c/pay/cs_test_x",
      customerName: "Anna Kalniņa",
    });
    expect(draft.subject).toContain("PROVIN AUDITS - Audi A3");
    expect(draft.emailText).toContain("Labdien, Anna!");
    expect(draft.emailText).toContain("125,50 €");
    expect(draft.emailText).toContain("https://checkout.stripe.com/c/pay/cs_test_x");
    expect(draft.emailText).not.toMatch(/[\u2013\u2014]/);
    expect(draft.whatsappText).not.toMatch(/[\u2013\u2014]/);
    expect(ensureManualOrderPayUrlInText("Sveiki", "https://checkout.stripe.com/c/pay/cs_test_x")).toContain(
      "Apmaksāt: https://checkout.stripe.com/c/pay/cs_test_x",
    );
  });

  it("suggests a service name from the car without an em dash", () => {
    expect(suggestManualOrderServiceName({ car: "Audi A3", vin: "WAUZZZ8V0KA000001" })).toBe(
      "PROVIN AUDITS - Audi A3",
    );
    expect(suggestManualOrderServiceName({})).toBe("PROVIN AUDITS");
  });
});

describe("manual order payment call sites", () => {
  it("webhook fulfills the existing id and never upserts a second paid row", () => {
    const webhook = readFileSync(path.join(ROOT, "app/api/webhooks/stripe/route.ts"), "utf8");
    const fulfill = webhook.indexOf("if (isManualOrderPaymentFulfillment");
    const upsert = webhook.indexOf("await upsertPaidCheckoutSessionFromStripe");
    expect(fulfill).toBeGreaterThan(-1);
    expect(upsert).toBeGreaterThan(-1);
    expect(fulfill).toBeLessThan(upsert);
    expect(webhook).toContain("fulfillManualOrderPayment");
  });

  it("admin order list hides the Stripe checkout session so a second row is not created", () => {
    const adminOrders = readFileSync(path.join(ROOT, "lib/admin-orders.ts"), "utf8");
    expect(adminOrders).toContain("isManualOrderPaymentFulfillment");
    expect(adminOrders).toContain("MANUAL_ORDER_PAYMENT_FULFILLMENT");
  });
});
