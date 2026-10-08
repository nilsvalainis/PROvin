import { describe, expect, it } from "vitest";
import { listingOfferLeaks, listingOfferText } from "@/lib/iriss-listings-offer";

const v = {
  title: "Audi A6 Avant 3.0 TDI",
  year: "2015",
  mileageKm: 172080,
  fuel: "Dīzelis",
  transmission: "Automatic",
  powerKw: "230",
  location: "Mechelen",
  countryCode: "BE",
  vin: "WAUZZZ4G6FN012345",
  platform: "openline",
  detailUrl: "https://www.openlane.eu/x",
  externalId: "abc12345",
};

describe("listingOfferText", () => {
  it("is a general LV description without price, id, platform, link or damage", () => {
    const text = listingOfferText(v);
    expect(text).toContain("Audi A6 Avant");
    expect(text).toContain("Dzintarzeme Auto");
    expect(listingOfferLeaks(text, v)).toEqual([]);
    expect(listingOfferLeaks("Cena 12 700 € https://x.lv Openlane WAUZZZ4G6FN012345 Ölverlust", v)).toEqual([
      "cena",
      "saite",
      "platforma",
      "ID",
      "bojājumi",
    ]);
  });
});
