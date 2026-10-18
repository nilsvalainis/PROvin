import { describe, expect, it } from "vitest";
import { shouldRequestListingVinOcr } from "@/lib/iriss-listings-vin-ocr-gate";

describe("shouldRequestListingVinOcr", () => {
  it("neiesaista citas platformas un jau zināmu VIN", () => {
    expect(shouldRequestListingVinOcr({ platform: "openline", imageUrl: "https://x/a.jpg" })).toBe(false);
    expect(
      shouldRequestListingVinOcr({
        platform: "auto1",
        vin: "WBA3A5C51EF123456",
        vinSource: "source",
        imageUrl: "https://x/a.jpg",
      }),
    ).toBe(false);
  });

  it("iesaista Auto1 bez VIN, ja ir bildes", () => {
    expect(shouldRequestListingVinOcr({ platform: "auto1", imageUrl: "https://x/a.jpg" })).toBe(true);
    expect(shouldRequestListingVinOcr({ platform: "auto1" })).toBe(false);
  });
});
