import { describe, expect, it } from "vitest";
import {
  findListingForAuctionLink,
  irissAuctionLinkPlatformHint,
  irissAuctionLinkSupported,
  parseIrissAuctionLink,
} from "@/lib/iriss-auction-link";

describe("parseIrissAuctionLink", () => {
  it("Auto1 merchant car link -> stockNumber", () => {
    expect(parseIrissAuctionLink("https://www.auto1.com/en/app/merchant/car/de48213")).toEqual({
      platform: "auto1",
      key: "DE48213",
      url: "https://www.auto1.com/en/app/merchant/car/de48213",
    });
    expect(parseIrissAuctionLink("auto1.com/en/app/merchant/car/BS72345?tab=condition#x")?.key).toBe("BS72345");
  });

  it("Openlane /car/<id> and car/info?auctionId=", () => {
    expect(parseIrissAuctionLink("https://www.openlane.eu/en/car/7654321")?.key).toBe("7654321");
    const info = parseIrissAuctionLink("https://www.openlane.eu/lv/car/info?auctionId=8123456");
    expect(info?.platform).toBe("openline");
    expect(info?.key).toBe("8123456");
  });

  it("Autobid is recognised but not supported", () => {
    const l = parseIrissAuctionLink("https://autobid.de/en/item/bmw-320d-3051234");
    expect(l?.platform).toBe("autobid");
    expect(l?.key).toBe("3051234");
    expect(irissAuctionLinkSupported("autobid")).toBe(false);
    expect(irissAuctionLinkSupported("auto1")).toBe(true);
  });

  it("rejects search pages and foreign hosts", () => {
    expect(parseIrissAuctionLink("https://www.auto1.com/en/app/merchant/cars?channel=24h")).toBeNull();
    expect(parseIrissAuctionLink("https://www.openlane.eu/en/findcarv6/?q=bmw")).toBeNull();
    expect(parseIrissAuctionLink("https://evil.example/car/DE48213")).toBeNull();
    expect(parseIrissAuctionLink("javascript:alert(1)")).toBeNull();
    expect(parseIrissAuctionLink("")).toBeNull();
  });

  it("platform hint while typing", () => {
    expect(irissAuctionLinkPlatformHint("https://www.auto1.com/en")).toBe("auto1");
    expect(irissAuctionLinkPlatformHint("openlane.eu/en/car")).toBe("openline");
    expect(irissAuctionLinkPlatformHint("nav saite")).toBeNull();
  });
});

describe("findListingForAuctionLink", () => {
  const rows = [
    { id: "a", platform: "auto1" as const, externalId: "991", detailUrl: "https://www.auto1.com/en/app/merchant/car/DE11111", stockNumber: "DE11111" },
    { id: "b", platform: "openline" as const, externalId: "8123456", detailUrl: "", auctionId: "8123456" },
    { id: "c", platform: "auto1" as const, externalId: "992", detailUrl: "https://www.auto1.com/en/app/merchant/car/DE48213" },
  ];

  it("matches by stockNumber / auctionId / detailUrl, same platform only", () => {
    expect(findListingForAuctionLink(rows, parseIrissAuctionLink("https://www.auto1.com/en/app/merchant/car/de11111")!)?.id).toBe("a");
    expect(findListingForAuctionLink(rows, parseIrissAuctionLink("https://www.openlane.eu/en/car/info?auctionId=8123456")!)?.id).toBe("b");
    expect(findListingForAuctionLink(rows, parseIrissAuctionLink("https://www.auto1.com/en/app/merchant/car/DE48213")!)?.id).toBe("c");
    expect(findListingForAuctionLink(rows, parseIrissAuctionLink("https://www.auto1.com/en/app/merchant/car/DE00000")!)).toBeNull();
  });
});
