import { describe, expect, it } from "vitest";
import {
  adminB2bInvitePriceError,
  b2bInviteHasCustomPricing,
  b2bInvitePriceSummary,
  b2bInviteRegisterPath,
  emptyB2bInvitePricing,
  isB2bInviteOpen,
  isSafeB2bInviteToken,
  newB2bInviteToken,
  parseB2bInviteRecord,
  partnerPricingFromInvite,
  toAdminB2bInviteJson,
  validateB2bInvitePricingInput,
} from "@/lib/b2b-partner-invite";

const TOKEN = "inv_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function openInvite(extra: Record<string, unknown> = {}) {
  return parseB2bInviteRecord({
    token: TOKEN,
    createdAt: "2026-09-01T00:00:00.000Z",
    expiresAt: "2026-09-20T00:00:00.000Z",
    usedAt: null,
    usedPartnerId: null,
    ...extra,
  });
}

describe("B2B partner invites", () => {
  it("issues a safe token and public register path without prices", () => {
    const token = newB2bInviteToken();
    expect(isSafeB2bInviteToken(token)).toBe(true);
    const path = b2bInviteRegisterPath(token);
    expect(path).toBe(`/partneriem/registracija?token=${token}`);
    expect(path).not.toMatch(/walletPrices|prices|business|dealer/);
  });

  it("rejects used or expired invites", () => {
    const open = openInvite();
    expect(open && isB2bInviteOpen(open, Date.parse("2026-09-10T00:00:00.000Z"))).toBe(true);
    expect(
      open && isB2bInviteOpen({ ...open, usedAt: "2026-09-02T00:00:00.000Z" }, Date.parse("2026-09-10T00:00:00.000Z")),
    ).toBe(false);
    expect(open && isB2bInviteOpen(open, Date.parse("2026-09-21T00:00:00.000Z"))).toBe(false);
  });

  it("keeps old invites without price fields as catalog defaults", () => {
    const legacy = openInvite();
    expect(legacy).not.toBeNull();
    expect(legacy?.walletPrices).toEqual({ business: null, dealer_raw: null, dealer_pro: null });
    expect(legacy?.prices).toEqual({ business1: null, business10: null, dealer1: null, dealer10: null });
    expect(b2bInviteHasCustomPricing(legacy!)).toBe(false);
  });

  it("persists custom wallet and pack prices on the invite record", () => {
    const invite = openInvite({
      walletPrices: { business: 6999, dealer_raw: null, dealer_pro: 1999 },
      prices: { business1: 5000, business10: null, dealer1: 1500, dealer10: null },
    });
    expect(invite?.walletPrices.business).toBe(6999);
    expect(invite?.walletPrices.dealer_raw).toBeNull();
    expect(invite?.walletPrices.dealer_pro).toBe(1999);
    expect(invite?.prices.business1).toBe(5000);
    expect(invite?.prices.dealer1).toBe(1500);
    expect(b2bInviteHasCustomPricing(invite!)).toBe(true);
  });
});

describe("B2B invite pricing validation", () => {
  it("treats empty input as catalog defaults", () => {
    expect(validateB2bInvitePricingInput(undefined)).toEqual({ ok: true, pricing: emptyB2bInvitePricing() });
    expect(validateB2bInvitePricingInput({})).toEqual({ ok: true, pricing: emptyB2bInvitePricing() });
    expect(validateB2bInvitePricingInput({ walletPrices: {}, prices: {} })).toEqual({
      ok: true,
      pricing: emptyB2bInvitePricing(),
    });
  });

  it("accepts custom euro text and leaves blank fields unset", () => {
    const result = validateB2bInvitePricingInput({
      walletPrices: { business: "69,99", dealer_raw: "", dealer_pro: "19.99 €" },
      prices: { business1: "50", business10: "", dealer1: "15,00", dealer10: null },
    });
    expect(result).toEqual({
      ok: true,
      pricing: {
        walletPrices: { business: 6999, dealer_raw: null, dealer_pro: 1999 },
        prices: { business1: 5000, business10: null, dealer1: 1500, dealer10: null },
      },
    });
  });

  it("rejects zero, below-min and invalid wallet prices with the same rules as partner pricing", () => {
    expect(validateB2bInvitePricingInput({ walletPrices: { business: "0" } })).toMatchObject({
      ok: false,
      field: "business",
      reason: "invalid",
    });
    expect(validateB2bInvitePricingInput({ walletPrices: { business: 0 } })).toMatchObject({
      ok: false,
      field: "business",
      reason: "invalid",
    });
    expect(validateB2bInvitePricingInput({ walletPrices: { business: "69,98" } })).toMatchObject({
      ok: false,
      field: "business",
      reason: "below_min",
      minCents: 6999,
    });
    expect(validateB2bInvitePricingInput({ walletPrices: { dealer_raw: "abc" } })).toMatchObject({
      ok: false,
      field: "dealer_raw",
      reason: "invalid",
    });
    const below = validateB2bInvitePricingInput({ walletPrices: { dealer_pro: "14,98" } });
    expect(below.ok).toBe(false);
    if (!below.ok) {
      expect(adminB2bInvitePriceError(below)).toContain("Dīlera dati (PRO)");
      expect(adminB2bInvitePriceError(below)).toContain("14,99 €");
    }
  });

  it("rejects invalid legacy pack prices without treating zero as unset", () => {
    expect(validateB2bInvitePricingInput({ prices: { business1: "0" } })).toMatchObject({
      ok: false,
      field: "business1",
      reason: "invalid",
    });
    expect(validateB2bInvitePricingInput({ prices: { dealer10: "nē" } })).toMatchObject({
      ok: false,
      field: "dealer10",
      reason: "invalid",
    });
  });
});

describe("B2B invite price security", () => {
  it("applies stored invite prices and ignores public registration body prices", () => {
    const invite = openInvite({
      walletPrices: { business: 6999, dealer_raw: null, dealer_pro: 1999 },
      prices: { business1: 5000, business10: null, dealer1: null, dealer10: null },
    });
    expect(invite).not.toBeNull();
    const fromBody = partnerPricingFromInvite(invite!, {
      walletPrices: { business: 1, dealer_raw: 1, dealer_pro: 1 },
      prices: { business1: 1, business10: 1, dealer1: 1, dealer10: 1 },
      business: "1,00",
    });
    expect(fromBody).toEqual({
      walletPrices: { business: 6999, dealer_raw: null, dealer_pro: 1999 },
      prices: { business1: 5000, business10: null, dealer1: null, dealer10: null },
    });
  });

  it("keeps prices off the public path even when the admin payload includes them", () => {
    const invite = openInvite({
      walletPrices: { business: 6999, dealer_raw: 1199, dealer_pro: 1499 },
      prices: { business1: 5000, business10: 4500, dealer1: 1500, dealer10: 1200 },
    });
    const json = toAdminB2bInviteJson(invite!);
    expect(json.path).toBe(`/partneriem/registracija?token=${TOKEN}`);
    expect(json.path).not.toContain("6999");
    expect(json.path).not.toContain("walletPrices");
    expect(json.walletPrices.business).toBe(6999);
    expect(json.prices.business1).toBe(5000);
  });

  it("summarizes custom vs default prices for the admin invite workflow", () => {
    const lines = b2bInvitePriceSummary({
      walletPrices: { business: 6999, dealer_raw: null, dealer_pro: null },
      prices: emptyB2bInvitePricing().prices,
    });
    expect(lines.find((line) => line.id === "business")?.display).toBe("69,99 €");
    expect(lines.find((line) => line.id === "dealer_raw")?.display).toBe("noklusējums (19,99 €)");
    expect(lines.find((line) => line.id === "business1")?.display).toBe("noklusējums (79,99 €)");
  });
});
