import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { CONSENT_STORAGE_KEY } from "./cookie-consent";
import {
  GTAG_CONSENT_DEFAULT_SNIPPET,
  GTAG_CONSENT_DENIED,
  GTAG_CONSENT_GRANTED,
  gtagConsentSignals,
} from "./google-consent";

describe("Consent Mode v2 ADVANCED", () => {
  it("defaults every ads and analytics signal to denied before gtag.js", () => {
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
    expect(GTAG_CONSENT_DEFAULT_SNIPPET).toContain("wait_for_update:500");
    expect(GTAG_CONSENT_DEFAULT_SNIPPET).toContain("gtag('set','ads_data_redaction',true)");
    expect(GTAG_CONSENT_DEFAULT_SNIPPET).toContain("gtag('set','url_passthrough',true)");
    expect(GTAG_CONSENT_DEFAULT_SNIPPET).not.toContain("gtag/js");
  });

  function runSnippet(saved: string | null): unknown[][] {
    const dataLayer: unknown[][] = [];
    const sandbox = {
      window: { dataLayer } as { dataLayer: unknown[] },
      dataLayer,
      localStorage: { getItem: () => saved },
    };
    sandbox.window.dataLayer = dataLayer;
    runInNewContext(GTAG_CONSENT_DEFAULT_SNIPPET, sandbox);
    return dataLayer.map((args) => Array.from(args as ArrayLike<unknown>));
  }

  it("restores a saved banner choice via consent update", () => {
    const calls = runSnippet(JSON.stringify({ analytics: true, updatedAt: "2026-10-28T00:00:00Z" }));
    expect(calls.find((c) => c[0] === "consent" && c[1] === "update")?.[2]).toEqual({
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
      analytics_storage: "granted",
    });
  });

  it("restores separate analytics and ads choices", () => {
    const calls = runSnippet(JSON.stringify({ analytics: true, ads: false, updatedAt: "2026-10-28T00:00:00Z" }));
    expect(calls.find((c) => c[0] === "consent" && c[1] === "update")?.[2]).toEqual({
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "granted",
    });
  });

  it("without a saved choice only sets the denied default", () => {
    const calls = runSnippet(null);
    expect(calls.some((c) => c[0] === "consent" && c[1] === "update")).toBe(false);
    expect(calls.find((c) => c[0] === "consent" && c[1] === "default")?.[2]).toMatchObject({ analytics_storage: "denied", ad_storage: "denied" });
  });

  it("gtagConsentSignals splits analytics and ads", () => {
    expect(gtagConsentSignals(false, true)).toEqual({
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
      analytics_storage: "denied",
    });
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
