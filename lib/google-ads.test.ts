import { describe, expect, it } from "vitest";
import {
  GOOGLE_ADS_ID,
  buildGoogleAdsConversionEvent,
  consentModeDefault,
  consentModeUpdate,
  getGoogleAdsPurchaseLabel,
  googleAdsConversionSendTo,
  gtagConfigSnippet,
  gtagConsentDefaultSnippet,
  gtagLoaderMeasurementId,
  isStripeCheckoutSessionId,
  markGoogleAdsConversionFired,
  shouldFireGoogleAdsConversion,
} from "./google-ads";

describe("Consent Mode v2", () => {
  it("defaults ad and analytics storage to denied", () => {
    const d = consentModeDefault();
    expect(d.ad_storage).toBe("denied");
    expect(d.ad_user_data).toBe("denied");
    expect(d.ad_personalization).toBe("denied");
    expect(d.analytics_storage).toBe("denied");
    const snippet = gtagConsentDefaultSnippet();
    expect(snippet).toContain("consent");
    expect(snippet).toContain("denied");
    expect(snippet).not.toContain("granted");
    expect(snippet).not.toContain("googletagmanager.com/gtag/js");
  });

  it("grants all four signals when marketing/analytics is accepted", () => {
    expect(consentModeUpdate(true)).toEqual({
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
      analytics_storage: "granted",
    });
    expect(consentModeUpdate(false)).toEqual({
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
    });
  });
});

describe("gtag config", () => {
  it("adds AW config next to GA4 without a second gtag.js URL", () => {
    const snippet = gtagConfigSnippet("G-EQ78SEVSZ8", GOOGLE_ADS_ID);
    expect(snippet).toContain("gtag('config',\"G-EQ78SEVSZ8\")");
    expect(snippet).toContain(`gtag('config',\"${GOOGLE_ADS_ID}\")`);
    expect(snippet).not.toContain("googletagmanager.com/gtag/js");
    expect(gtagLoaderMeasurementId("G-EQ78SEVSZ8", GOOGLE_ADS_ID)).toBe("G-EQ78SEVSZ8");
  });
});

describe("purchase conversion", () => {
  it("skips when purchase label env is unset or invalid", () => {
    expect(getGoogleAdsPurchaseLabel(undefined)).toBeNull();
    expect(getGoogleAdsPurchaseLabel("")).toBeNull();
    expect(getGoogleAdsPurchaseLabel("bad label")).toBeNull();
    expect(googleAdsConversionSendTo(undefined)).toBeNull();
    expect(
      buildGoogleAdsConversionEvent({ label: undefined, value: 39.99, transactionId: "cs_test_1" }),
    ).toBeNull();
  });

  it("builds conversion payload with EUR and transaction id", () => {
    const event = buildGoogleAdsConversionEvent({
      label: "AbC-dEfGhIjk",
      value: 99.99,
      transactionId: "cs_test_abc",
    });
    expect(event).toEqual({
      send_to: `${GOOGLE_ADS_ID}/AbC-dEfGhIjk`,
      value: 99.99,
      currency: "EUR",
      transaction_id: "cs_test_abc",
    });
  });

  it("accepts Stripe checkout session ids", () => {
    expect(isStripeCheckoutSessionId("cs_test_abc12345")).toBe(true);
    expect(isStripeCheckoutSessionId("not-a-session")).toBe(false);
  });

  it("fires once per session/order id", () => {
    const store: Record<string, string> = {};
    const storage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
    };
    expect(shouldFireGoogleAdsConversion(storage, "cs_1")).toBe(true);
    markGoogleAdsConversionFired(storage, "cs_1");
    expect(shouldFireGoogleAdsConversion(storage, "cs_1")).toBe(false);
    expect(shouldFireGoogleAdsConversion(storage, "cs_2")).toBe(true);
  });
});
