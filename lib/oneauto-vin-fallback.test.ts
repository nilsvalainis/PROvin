import { describe, expect, it } from "vitest";
import { decodeVinLocal, vinDecodeParseFromLocal } from "@/lib/vin-scan/vin-decode";
import {
  ONEAUTO_VIN_FALLBACK_SOURCE,
  mergeVinDecodeFallbackPowertrain,
  oneautoPowertrainFromLocalVin,
  oneautoPowertrainFromVinScanParse,
} from "@/lib/oneauto-vin-fallback";

describe("OneAuto VIN decoder fallback", () => {
  it("WDC Mercedes VIN dod fallback rindas ar etiķeti", () => {
    const vin = "WDC2049841F820739";
    const rows = oneautoPowertrainFromLocalVin(vin);
    expect(rows.some((r) => r.label === "Avots" && r.value === ONEAUTO_VIN_FALLBACK_SOURCE)).toBe(
      true,
    );
    expect(rows.some((r) => r.label === "Marka (fallback)" && /Mercedes/i.test(r.value))).toBe(true);
    expect(rows.some((r) => r.label.endsWith("(fallback)"))).toBe(true);
    const parsed = vinDecodeParseFromLocal(decodeVinLocal(vin));
    expect(parsed.status).toBe("found");
    expect(oneautoPowertrainFromVinScanParse({ status: "none", summary: "nav" })).toEqual([]);
  });

  it("fallback rindas liek priekšā, bez dublikātiem", () => {
    const merged = mergeVinDecodeFallbackPowertrain(
      [{ label: "Marka (fallback)", value: "Mercedes-Benz" }],
      [
        { label: "Avots", value: ONEAUTO_VIN_FALLBACK_SOURCE },
        { label: "Marka (fallback)", value: "Mercedes-Benz" },
      ],
    );
    expect(merged.filter((r) => r.label === "Marka (fallback)")).toHaveLength(1);
    expect(merged[0]?.label).toBe("Avots");
  });
});
