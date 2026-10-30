import { describe, expect, it } from "vitest";
import {
  BUSINESS_LINK_AMOUNT_CENTS,
  BUSINESS_LINK_FULFILLMENT,
  buildBusinessLinkCheckoutSessionParams,
  buildBusinessLinkWhatsAppText,
  businessLinkAbsoluteUrl,
  businessLinkHashFromStripeMetadata,
  businessLinkPublicView,
  isBusinessLinkPath,
  isBusinessLinkUsable,
  newBusinessLinkRecord,
  normalizeBusinessLinkAdminInput,
  parseBusinessLinkRecord,
  validateBusinessLinkSubmission,
  type BusinessLinkSubmitFields,
} from "@/lib/business-link";
import { clientLinkHashFromStripeMetadata, isClientLinkPath } from "@/lib/client-link";
import { getCheckoutLineFromSession } from "@/lib/stripe-session";
import { paidProductLabel } from "@/lib/admin-customer-identity";
import type Stripe from "stripe";

const HASH = "a".repeat(64);
const VIN = "WBAFF41030L065449";
const NOW = Date.parse("2026-10-26T10:00:00.000Z");

const emptyFields: BusinessLinkSubmitFields = {
  email: "",
  vin: "",
  listingUrl: "",
  phone: "",
  companyName: "",
  companyReg: "",
  companyAddress: "",
};

function record(over: Partial<ReturnType<typeof newBusinessLinkRecord>> = {}) {
  return { ...newBusinessLinkRecord(HASH, { recipientChannel: "email", recipient: "", prefillVin: "", validityHours: 48 }, NOW), ...over };
}

describe("business link price", () => {
  it("is fixed at 69,99 €", () => {
    expect(BUSINESS_LINK_AMOUNT_CENTS).toBe(6999);
  });

  it("admin input never carries an amount", () => {
    const input = normalizeBusinessLinkAdminInput({ amountCents: 1, validityHours: 48 } as never);
    expect(input).not.toHaveProperty("amountCents");
    const rec = newBusinessLinkRecord(HASH, input as never, NOW);
    expect(rec).not.toHaveProperty("amountCents");
    expect(businessLinkPublicView(rec).amountCents).toBe(6999);
  });

  it("checkout session always charges 6999 cents with business line metadata", () => {
    const validated = validateBusinessLinkSubmission(record(), { ...emptyFields, email: "a@b.lv", vin: VIN }, true);
    if (!validated.ok) throw new Error(validated.error);
    const p = buildBusinessLinkCheckoutSessionParams({ origin: "https://www.provin.lv/", token: "tok_".padEnd(24, "x"), tokenHash: HASH, resolved: validated.resolved });
    expect(p.line_items[0].price_data.unit_amount).toBe(6999);
    expect(p.line_items[0].quantity).toBe(1);
    expect(p.line_items[0].price_data.product_data.name).toBe("PROVIN BUSINESS");
    expect(p.customer_email).toBe("a@b.lv");
    expect(p.metadata).toMatchObject({
      checkout_line: "business",
      fulfillment: BUSINESS_LINK_FULFILLMENT,
      business_link_hash: HASH,
      vin: VIN,
      report_delivery: "email",
      withdrawal_waiver_ack: "true",
      authorization_ack: "true",
    });
    expect(p.metadata).not.toHaveProperty("client_link_hash");
    expect(p.cancel_url).toBe(`https://www.provin.lv/b/${"tok_".padEnd(24, "x")}`);
    expect(p.success_url).toBe("https://www.provin.lv/lv/paldies?session_id={CHECKOUT_SESSION_ID}");
  });

  it("paid session is treated as PROVIN BUSINESS by existing admin logic", () => {
    const metadata = buildBusinessLinkCheckoutSessionParams({ origin: "https://x.lv", token: "t".repeat(24), tokenHash: HASH, resolved: { ...emptyFields, email: "a@b.lv", vin: VIN } }).metadata;
    expect(getCheckoutLineFromSession({ metadata } as unknown as Stripe.Checkout.Session)).toBe("business");
    expect(paidProductLabel({ checkoutLine: metadata.checkout_line, amountTotalCents: 6999 })).toBe("PROVIN BUSINESS");
  });

  it("adds invoice buyer fields only when given", () => {
    const base = buildBusinessLinkCheckoutSessionParams({ origin: "https://x.lv", token: "t".repeat(24), tokenHash: HASH, resolved: { ...emptyFields, email: "a@b.lv", vin: VIN } }).metadata;
    expect(base).not.toHaveProperty("company_name");
    const withCo = buildBusinessLinkCheckoutSessionParams({
      origin: "https://x.lv",
      token: "t".repeat(24),
      tokenHash: HASH,
      resolved: { ...emptyFields, email: "a@b.lv", vin: VIN, companyName: "SIA Auto", companyReg: "40000000000" },
    }).metadata;
    expect(withCo.company_name).toBe("SIA Auto");
    expect(withCo.company_reg).toBe("40000000000");
  });
});

describe("business link paths", () => {
  it("is /b/[token] and does not overlap /s/ or /blogs", () => {
    expect(businessLinkAbsoluteUrl("https://www.provin.lv/", "abc")).toBe("https://www.provin.lv/b/abc");
    expect(isBusinessLinkPath("/b/abc")).toBe(true);
    expect(isBusinessLinkPath("/blogs")).toBe(false);
    expect(isBusinessLinkPath("/s/abc")).toBe(false);
    expect(isClientLinkPath("/b/abc")).toBe(false);
  });
});

describe("business link metadata routing", () => {
  it("only matches business_link fulfillment", () => {
    expect(businessLinkHashFromStripeMetadata({ fulfillment: "business_link", business_link_hash: HASH.toUpperCase() })).toBe(HASH);
    expect(businessLinkHashFromStripeMetadata({ fulfillment: "client_link", business_link_hash: HASH })).toBeNull();
    expect(businessLinkHashFromStripeMetadata({ fulfillment: "business_link", business_link_hash: "x" })).toBeNull();
    expect(clientLinkHashFromStripeMetadata({ fulfillment: "business_link", business_link_hash: HASH })).toBeNull();
  });
});

describe("business link validity", () => {
  it("is usable only while open and before expiry", () => {
    const rec = record();
    expect(isBusinessLinkUsable(rec, NOW + 1000)).toBe(true);
    expect(isBusinessLinkUsable(rec, NOW + 48 * 3600 * 1000)).toBe(false);
    expect(isBusinessLinkUsable({ ...rec, status: "paid" }, NOW + 1000)).toBe(false);
  });

  it("rejects bad admin input", () => {
    expect(normalizeBusinessLinkAdminInput({ validityHours: 5 })).toEqual({ error: "invalid_validity" });
    expect(normalizeBusinessLinkAdminInput({ prefillVin: "!!" })).toEqual({ error: "invalid_vin" });
  });

  it("parses stored records and drops garbage", () => {
    const rec = record({ status: "paid", paidStripeSessionId: "cs_1" });
    expect(parseBusinessLinkRecord(JSON.parse(JSON.stringify(rec)))).toEqual(rec);
    expect(parseBusinessLinkRecord({ ...rec, tokenHash: "nope" })).toBeNull();
    expect(parseBusinessLinkRecord({ ...rec, status: "weird" })).toBeNull();
  });
});

describe("business link submission", () => {
  it("requires consent, email and VIN", () => {
    expect(validateBusinessLinkSubmission(record(), { ...emptyFields, email: "a@b.lv", vin: VIN }, false)).toEqual({ ok: false, error: "consent" });
    expect(validateBusinessLinkSubmission(record(), { ...emptyFields, vin: VIN }, true)).toEqual({ ok: false, error: "email" });
    expect(validateBusinessLinkSubmission(record(), { ...emptyFields, email: "a@b.lv" }, true)).toEqual({ ok: false, error: "vin" });
    expect(validateBusinessLinkSubmission(record(), { ...emptyFields, email: "a@b.lv", vin: "WBAFF41030L06" }, true)).toEqual({ ok: false, error: "vin_length" });
  });

  it("falls back to prefilled VIN and recipient email", () => {
    const rec = record({ prefillVin: VIN, recipient: "k@b.lv" });
    const r = validateBusinessLinkSubmission(rec, emptyFields, true);
    expect(r).toMatchObject({ ok: true, resolved: { email: "k@b.lv", vin: VIN } });
  });

  it("validates optional listing and phone", () => {
    const base = { ...emptyFields, email: "a@b.lv", vin: VIN };
    expect(validateBusinessLinkSubmission(record(), { ...base, listingUrl: "nav saite" }, true)).toEqual({ ok: false, error: "listing" });
    expect(validateBusinessLinkSubmission(record(), { ...base, phone: "12" }, true)).toEqual({ ok: false, error: "phone" });
  });

  it("public view prefills only matching channel", () => {
    const email = businessLinkPublicView(record({ recipient: "k@b.lv" }));
    expect(email.prefillEmail).toBe("k@b.lv");
    expect(email.prefillPhone).toBe("");
    const wa = businessLinkPublicView(record({ recipientChannel: "whatsapp", recipient: "+37120000000" }));
    expect(wa.prefillEmail).toBe("");
    expect(wa.prefillPhone).toBe("+37120000000");
  });
});

describe("business link WhatsApp text", () => {
  it("names product and fixed price, uses short dash only", () => {
    const t = buildBusinessLinkWhatsAppText({ url: "https://www.provin.lv/b/x", expiresAt: "2026-10-28T10:00:00.000Z" });
    expect(t).toContain("PROVIN BUSINESS");
    expect(t).toContain("69,99 €");
    expect(t).toContain("https://www.provin.lv/b/x");
    expect(t).not.toMatch(/[\u2013\u2014]/);
  });
});
