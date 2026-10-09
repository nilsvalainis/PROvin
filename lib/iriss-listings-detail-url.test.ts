import { describe, expect, it } from "vitest";
import { listingAppUrl, listingCopyId, listingDetailUrlBuilt, resolveListingDetailUrl } from "@/lib/iriss-listings-detail-url";

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

  it("uppercases a canonical Auto1 stockNumber and keeps other web URLs", () => {
    expect(resolveListingDetailUrl({ platform: "auto1", stockNumber: "bw03512" })).toBe("https://www.auto1.com/en/app/merchant/car/BW03512");
    expect(
      resolveListingDetailUrl({
        platform: "auto1",
        detailUrl: "https://www.auto1.com/en/app/merchant/car/legacy-id",
        stockNumber: "not-a-stock",
      }),
    ).toBe("https://www.auto1.com/en/app/merchant/car/legacy-id");
  });

  it("builds Openlane app URLs for numeric auctionId and leaves Auto1 empty", () => {
    const openlane = { platform: "openline" as const, auctionId: "1234567", detailUrl: "https://www.openlane.eu/en/car/1234567" };
    expect(listingAppUrl(openlane, "ios")).toBe("buyermobile://mybids/active/auctions/1234567");
    expect(listingAppUrl(openlane, "android")).toBe(
      "intent://mybids/active/auctions/1234567#Intent;scheme=buyermobile;package=com.carsontheweb;S.browser_fallback_url=https%3A%2F%2Fwww.openlane.eu%2Fen%2Fcar%2F1234567;end",
    );
    expect(listingAppUrl({ platform: "openline", auctionId: "A99" }, "ios")).toBe("");
    expect(listingAppUrl({ platform: "auto1", stockNumber: "BW03512" }, "ios")).toBe("");
    expect(listingAppUrl(openlane, null)).toBe("");
    expect(listingCopyId({ platform: "auto1", stockNumber: "BW03512", externalId: "9" })).toBe("BW03512");
    expect(listingCopyId({ platform: "openline", auctionId: "1234567" })).toBe("1234567");
    expect(listingCopyId({ platform: "autobid", externalId: "3587391" })).toBe("3587391");
  });
});
