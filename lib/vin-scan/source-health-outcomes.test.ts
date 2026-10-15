import { describe, expect, it } from "vitest";

import {
  isVinScanHealthFailure,
  vinScanSourceHealthOutcomes,
} from "@/lib/vin-scan/source-health-outcomes";

describe("VIN SCAN avotu veselības iznākumi", () => {
  it("found/none ir ok; Cloudflare un 429 ir kļūda", () => {
    expect(isVinScanHealthFailure("found", "Copart 2025, 20 foto")).toBe(false);
    expect(isVinScanHealthFailure("none", "Nav izsoles ieraksta")).toBe(false);
    expect(isVinScanHealthFailure("unknown", "stat.vin: Cloudflare bloķē servera pārbaudi")).toBe(true);
    expect(isVinScanHealthFailure("unknown", "stat.vin: pieprasījumu limits (HTTP 429)")).toBe(true);
    expect(isVinScanHealthFailure("unknown", "Avots neatbildēja laikā")).toBe(true);
    expect(isVinScanHealthFailure("unknown", "CapSolver: invalid task data: websiteKey is required (HTTP 400)")).toBe(
      true,
    );
    expect(isVinScanHealthFailure("unknown", "mnt.ee: captcha_rejected: reCAPTCHA v3 token rejected")).toBe(true);
    expect(isVinScanHealthFailure("unknown", "Avots bloķē serveri - atver pārlūkā")).toBe(false);
    expect(isVinScanHealthFailure("unknown", "Lapa nav atpazīta")).toBe(false);
    expect(isVinScanHealthFailure("skipped", "nav konfigurēts")).toBe(false);
    expect(isVinScanHealthFailure("timeout", "Avots neatbildēja laikā")).toBe(true);
    expect(isVinScanHealthFailure("blocked", "Avots bloķē serveri - atver pārlūkā")).toBe(true);
    expect(isVinScanHealthFailure("config_missing", "vegvesen.no: nav VEGVESEN_API_KEY")).toBe(false);
    expect(isVinScanHealthFailure("browser_only", "Regitra: tikai pārlūkā")).toBe(false);
  });

  it("ieraksta tikai atbildes un bloķējumus", () => {
    const out = vinScanSourceHealthOutcomes([
      { id: "stat_vin", status: "found", summary: "Copart 2025, 20 foto" },
      { id: "bid_cars", status: "unknown", summary: "Lapa nav atpazīta" },
      { id: "auchistory", status: "unknown", summary: "Cloudflare bloķē servera pārbaudi (turnstile)" },
    ]);
    expect(out).toEqual([
      { id: "stat_vin", ok: true, msg: "Copart 2025, 20 foto" },
      { id: "auchistory", ok: false, msg: "Cloudflare bloķē servera pārbaudi (turnstile)" },
    ]);
  });
});
