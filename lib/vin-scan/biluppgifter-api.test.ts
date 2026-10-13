import { describe, expect, it } from "vitest";

import { biluppgifterApiConfigured, fetchBiluppgifterApi } from "@/lib/vin-scan/biluppgifter-api";

describe("Biluppgifter API vieta", () => {
  it("bez atslēgas nav konfigurēts un neatgriež datus", async () => {
    expect(biluppgifterApiConfigured({})).toBe(false);
    expect(biluppgifterApiConfigured({ BILUPPGIFTER_API_KEY: "  " })).toBe(false);
    expect(biluppgifterApiConfigured({ BILUPPGIFTER_API_KEY: "secret" })).toBe(true);
    expect(await fetchBiluppgifterApi("YV1DZ5251B2146640")).toBeNull();
  });
});
