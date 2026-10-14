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
