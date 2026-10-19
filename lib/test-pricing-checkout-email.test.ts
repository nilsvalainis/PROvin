import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CHECKOUT_EMAIL_METADATA_KEY,
  parseOptionalCheckoutEmail,
  stripeCheckoutEmailFields,
} from "@/lib/test-pricing-checkout-email";

const ROOT = join(import.meta.dirname, "..");

describe("parseOptionalCheckoutEmail", () => {
  it("allows empty and whitespace", () => {
    expect(parseOptionalCheckoutEmail(null)).toEqual({ ok: true, email: null });
    expect(parseOptionalCheckoutEmail(undefined)).toEqual({ ok: true, email: null });
    expect(parseOptionalCheckoutEmail("")).toEqual({ ok: true, email: null });
    expect(parseOptionalCheckoutEmail("   ")).toEqual({ ok: true, email: null });
  });

  it("accepts a basic valid email", () => {
    expect(parseOptionalCheckoutEmail(" Klients@example.lv ")).toEqual({
      ok: true,
      email: "Klients@example.lv",
    });
  });

  it("rejects filled but invalid values", () => {
    const bad = parseOptionalCheckoutEmail("nav-epasts");
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.error).toBe("Ievadi derīgu e-pastu vai atstāj tukšu.");
      expect(bad.error).not.toMatch(/[\u2013\u2014]/);
    }
    expect(parseOptionalCheckoutEmail("a@b").ok).toBe(false);
    expect(parseOptionalCheckoutEmail(12).ok).toBe(false);
  });
});

describe("stripeCheckoutEmailFields", () => {
  it("omits customer_email when empty", () => {
    expect(stripeCheckoutEmailFields(null)).toEqual({ metadata: {} });
  });

  it("sets Checkout customer_email and metadata together", () => {
    expect(stripeCheckoutEmailFields("a@b.lv")).toEqual({
      customer_email: "a@b.lv",
      metadata: { [CHECKOUT_EMAIL_METADATA_KEY]: "a@b.lv" },
    });
  });
});

describe("homepage test-pricing checkout wiring", () => {
  it("test-pricing route accepts optional email; legacy /api/checkout is untouched", () => {
    const tp = readFileSync(join(ROOT, "app/api/checkout/test-pricing/route.ts"), "utf8");
    const legacy = readFileSync(join(ROOT, "app/api/checkout/route.ts"), "utf8");
    expect(tp).toContain("parseOptionalCheckoutEmail");
    expect(tp).toContain("stripeCheckoutEmailFields");
    expect(tp).toContain("customer_email");
    expect(tp).toContain("customerEmail");
    expect(legacy).not.toContain("parseOptionalCheckoutEmail");
  });

  it("MINI modal contains the email field; other packs use a matching small modal", () => {
    const mini = readFileSync(join(ROOT, "components/test-pricing-5/Tp5MiniConfirmModal.tsx"), "utf8");
    const hero = readFileSync(join(ROOT, "components/pricing/ProvinPricingHero.tsx"), "utf8");
    expect(mini).toContain("emailLabel");
    expect(mini).toContain('type="email"');
    expect(mini).toContain("Tp5CheckoutEmailModal");
    expect(hero).toContain("Tp5CheckoutEmailModal");
    expect(hero).toContain("customerEmail");
    expect(hero).toContain("Tp5MiniConfirmModal");
  });
});
