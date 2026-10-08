import { describe, expect, it } from "vitest";
import { listingDetailUrlBuilt, resolveListingDetailUrl } from "@/lib/iriss-listings-detail-url";

describe("resolveListingDetailUrl", () => {
  it("keeps a real Auto1 / Openlane / Autobid detail URL", () => {
    expect(
      resolveListingDetailUrl({
        platform: "auto1",
        detailUrl: "https://www.auto1.com/en/app/merchant/car/BW03512",
        stockNumber: "OTHER",
      }),
    ).toBe("https://www.auto1.com/en/app/merchant/car/BW03512");
    expect(resolveListingDetailUrl({ platform: "openline", detailUrl: "https://www.openlane.eu/en/car/A1", auctionId: "Z" })).toBe(
      "https://www.openlane.eu/en/car/A1",
    );
    expect(resolveListingDetailUrl({ platform: "autobid", detailUrl: "https://autobid.de/en/item/volvo-xc60-3587391", externalId: "1" })).toBe(
      "https://autobid.de/en/item/volvo-xc60-3587391",
    );
  });

  it("builds Auto1 from stockNumber, not the numeric id, and ignores a search URL", () => {
    expect(listingDetailUrlBuilt({ platform: "auto1", stockNumber: "BW03512", externalId: "987654" })).toBe(
      "https://www.auto1.com/en/app/merchant/car/BW03512",
    );
    expect(
      resolveListingDetailUrl({
        platform: "auto1",
        detailUrl: "https://www.auto1.com/en/app/merchant/cars?channel=24h&page=1",
        stockNumber: "BW03512",
        externalId: "987654",
      }),
    ).toBe("https://www.auto1.com/en/app/merchant/car/BW03512");
  });

  it("builds Openlane from auctionId and Autobid from externalId", () => {
    expect(resolveListingDetailUrl({ platform: "openline", auctionId: "A99", externalId: "car-1" })).toBe("https://www.openlane.eu/en/car/A99");
    expect(
      resolveListingDetailUrl({
        platform: "openline",
        detailUrl: "https://www.openlane.eu/en/findcar?makes=volvo",
        auctionId: "A99",
      }),
    ).toBe("https://www.openlane.eu/en/car/A99");
    expect(resolveListingDetailUrl({ platform: "autobid", externalId: "3587391" })).toBe("https://autobid.de/en/item/3587391");
    expect(
      resolveListingDetailUrl({
        platform: "autobid",
        detailUrl: "https://autobid.de/en/search-results?q=1",
        externalId: "3587391",
      }),
    ).toBe("https://autobid.de/en/item/3587391");
  });

  it("returns empty when there is nothing to open", () => {
    expect(resolveListingDetailUrl({ platform: "auto1" })).toBe("");
    expect(resolveListingDetailUrl({ platform: "openline", detailUrl: "ftp://x" })).toBe("");
    expect(resolveListingDetailUrl({ platform: "autobid", detailUrl: "not a url" })).toBe("");
  });
});
