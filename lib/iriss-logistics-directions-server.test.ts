import { describe, expect, it } from "vitest";
import { decodeGooglePolyline, logisticsDirectionsNotice } from "@/lib/iriss-logistics-directions-server";

describe("maršruta API kļūdas", () => {
  it("explains a disabled Google API in Latvian without leaking details", () => {
    const legacy = "You're calling a legacy API, which is not enabled for your project.";
    expect(logisticsDirectionsNotice(legacy, "REQUEST_DENIED")).toContain("ieslēdz Routes API");
    expect(logisticsDirectionsNotice("Routes API has not been used in project 123", "PERMISSION_DENIED")).toContain("Routes API");
    expect(logisticsDirectionsNotice("", "ZERO_RESULTS")).toBe("Starp šiem punktiem Google neatrada braucamu maršrutu.");
    expect(logisticsDirectionsNotice("weird")).toBe("Maršrutu neizdevās sastādīt.");
  });

  it("decodes Google encoded polylines", () => {
    // Google dokumentācijas piemērs.
    expect(decodeGooglePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toEqual([
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ]);
  });
});
