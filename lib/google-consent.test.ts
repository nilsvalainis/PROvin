import { describe, expect, it } from "vitest";
import {
  GTAG_CONSENT_DEFAULT_SNIPPET,
  GTAG_CONSENT_DENIED,
  GTAG_CONSENT_GRANTED,
} from "./google-consent";

describe("Consent Mode v2", () => {
  it("defaults every ads and analytics signal to denied", () => {
    expect(GTAG_CONSENT_DENIED).toEqual({
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
    });
    expect(GTAG_CONSENT_DEFAULT_SNIPPET).toContain("consent','default'");
    expect(GTAG_CONSENT_DEFAULT_SNIPPET).toContain("ad_storage:'denied'");
    expect(GTAG_CONSENT_DEFAULT_SNIPPET).toContain("ad_user_data:'denied'");
    expect(GTAG_CONSENT_DEFAULT_SNIPPET).toContain("ad_personalization:'denied'");
    expect(GTAG_CONSENT_DEFAULT_SNIPPET).toContain("analytics_storage:'denied'");
    expect(GTAG_CONSENT_DEFAULT_SNIPPET).not.toContain("gtag/js");
  });

  it("grants the same four signals after marketing/analytics accept", () => {
    expect(GTAG_CONSENT_GRANTED).toEqual({
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
      analytics_storage: "granted",
    });
  });
});
