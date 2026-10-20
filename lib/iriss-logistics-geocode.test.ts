import { describe, expect, it } from "vitest";
import {
  logisticsGeocodeCacheKey,
  logisticsGeocodePrecision,
  logisticsGeocodeStatusFromPrecision,
  normalizeLogisticsGeocodeQuery,
} from "@/lib/iriss-logistics-geocode";

describe("geocode cache key", () => {
  it("normalizes address so repeated typing hits cache", () => {
    expect(normalizeLogisticsGeocodeQuery("  Musterweg  7,  21000 Lüneburg, DE ")).toBe(
      "musterweg 7, 21000 lüneburg, de",
    );
    expect(logisticsGeocodeCacheKey("Musterweg 7, 21000 Lüneburg, DE")).toBe(
      logisticsGeocodeCacheKey("musterweg 7, 21000 lüneburg, de"),
    );
  });

  it("marks city-level results as neprecizs", () => {
    expect(logisticsGeocodePrecision(["locality"])).toBe("city");
    expect(logisticsGeocodeStatusFromPrecision("city")).toBe("neprecizs");
    expect(logisticsGeocodeStatusFromPrecision("rooftop")).toBe("ok");
  });
});
