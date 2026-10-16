import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GOOGLE_ADS_ID,
  buildGoogleAdsConversionParams,
  buildGtagConfigSnippet,
  checkoutAmountCentsToEur,
  fireGoogleAdsPurchaseConversion,
  getGoogleAdsPurchaseLabel,
  googleAdsPurchaseStorageKey,
  gtagScriptId,
  hasFiredGoogleAdsPurchase,
  markGoogleAdsPurchaseFired,
  shouldFireGoogleAdsPurchase,
} from "./google-ads";
import { applyGtagConsent, GTAG_CONSENT_DENIED, GTAG_CONSENT_GRANTED } from "./google-consent";

describe("getGoogleAdsPurchaseLabel", () => {
  const previous = process.env.NEXT_PUBLIC_GADS_PURCHASE_LABEL;

  afterEach(() => {
    if (previous == null) delete process.env.NEXT_PUBLIC_GADS_PURCHASE_LABEL;
    else process.env.NEXT_PUBLIC_GADS_PURCHASE_LABEL = previous;
  });

  it("returns null when unset or empty", () => {
    delete process.env.NEXT_PUBLIC_GADS_PURCHASE_LABEL;
    expect(getGoogleAdsPurchaseLabel()).toBeNull();
    expect(getGoogleAdsPurchaseLabel("")).toBeNull();
    expect(getGoogleAdsPurchaseLabel("   ")).toBeNull();
  });

  it("accepts a typical Google Ads conversion label", () => {
    expect(getGoogleAdsPurchaseLabel("AbCDefGhIjkLmNop")).toBe("AbCDefGhIjkLmNop");
  });

  it("rejects unsafe labels", () => {
    expect(getGoogleAdsPurchaseLabel("<script>")).toBeNull();
    expect(getGoogleAdsPurchaseLabel("ab")).toBeNull();
  });
});

describe("Google Ads conversion event", () => {
  it("builds send_to from AW id and purchase label", () => {
    expect(
      buildGoogleAdsConversionParams({
        label: "AbCDefGhIjkLmNop",
        value: 99.99,
        transactionId: "cs_test_order1",
      }),
    ).toEqual({
      send_to: "AW-18517313147/AbCDefGhIjkLmNop",
      value: 99.99,
      currency: "EUR",
      transaction_id: "cs_test_order1",
    });
  });

  it("fires once per session/order id", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };
    const id = "cs_test_order1";
    expect(shouldFireGoogleAdsPurchase({ label: "AbcdEfgh", transactionId: id, alreadyFired: false })).toBe(
      true,
    );
    expect(hasFiredGoogleAdsPurchase(storage, id)).toBe(false);
    markGoogleAdsPurchaseFired(storage, id);
    expect(hasFiredGoogleAdsPurchase(storage, id)).toBe(true);
    expect(
      shouldFireGoogleAdsPurchase({
        label: "AbcdEfgh",
        transactionId: id,
        alreadyFired: hasFiredGoogleAdsPurchase(storage, id),
      }),
    ).toBe(false);
    expect(googleAdsPurchaseStorageKey(id)).toBe("provin_gads_purchase_cs_test_order1");
  });

  it("skips when label or order id is missing", () => {
    expect(shouldFireGoogleAdsPurchase({ label: null, transactionId: "cs_1", alreadyFired: false })).toBe(
      false,
    );
    expect(shouldFireGoogleAdsPurchase({ label: "AbcdEfgh", transactionId: "", alreadyFired: false })).toBe(
      false,
    );
  });
});

describe("checkoutAmountCentsToEur", () => {
  it("converts Stripe cents to EUR value", () => {
    expect(checkoutAmountCentsToEur(9999)).toBe(99.99);
    expect(checkoutAmountCentsToEur(3999)).toBe(39.99);
  });
});

describe("gtag config snippet", () => {
  it("configs GA4 and Google Ads on one gtag setup", () => {
    const snippet = buildGtagConfigSnippet("G-EQ78SEVSZ8");
    expect(snippet).toContain("gtag('config','G-EQ78SEVSZ8')");
    expect(snippet).toContain(`gtag('config','${GOOGLE_ADS_ID}')`);
    expect(snippet).toContain("analytics_storage:'granted'");
    expect(snippet).toContain("ad_storage:'granted'");
    expect(snippet).not.toContain("gtag/js");
    expect(gtagScriptId("G-EQ78SEVSZ8")).toBe("G-EQ78SEVSZ8");
    expect(gtagScriptId(null)).toBe(GOOGLE_ADS_ID);
  });
});

describe("gtag consent update and purchase conversion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("updates Consent Mode v2 signals on accept and reject", () => {
    const gtag = vi.fn();
    vi.stubGlobal("window", { gtag });
    applyGtagConsent(true);
    expect(gtag).toHaveBeenCalledWith("consent", "update", GTAG_CONSENT_GRANTED);
    applyGtagConsent(false);
    expect(gtag).toHaveBeenCalledWith("consent", "update", GTAG_CONSENT_DENIED);
  });

  it("fires conversion once per order id and skips without gtag", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };
    const args = { label: "AbcdEfgh", value: 39.99, transactionId: "cs_test_order1", storage };
    expect(fireGoogleAdsPurchaseConversion(args)).toBe(false);

    const gtag = vi.fn();
    vi.stubGlobal("window", { gtag });
    expect(fireGoogleAdsPurchaseConversion(args)).toBe(true);
    expect(gtag).toHaveBeenCalledWith("event", "conversion", {
      send_to: "AW-18517313147/AbcdEfgh",
      value: 39.99,
      currency: "EUR",
      transaction_id: "cs_test_order1",
    });
    expect(fireGoogleAdsPurchaseConversion(args)).toBe(false);
    expect(gtag).toHaveBeenCalledTimes(1);
  });
});
