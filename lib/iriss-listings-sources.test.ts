import { describe, expect, it } from "vitest";
import { detectIrissListingPlatform } from "@/lib/iriss-listings-platform";
import { buildIrissListingSources, groupIrissListingSources } from "@/lib/iriss-listings-sources";
import type { IrissPasutijumsListStatus } from "@/lib/iriss-pasutijumi-types";

function row(id: string, listStatus: IrissPasutijumsListStatus, links: Partial<Record<"autobid" | "openline" | "auto1" | "mobile", string>> = {}, other: string[] = []) {
  return {
    id,
    brandModel: `Car ${id}`,
    listStatus,
    listingLinkMobile: links.mobile ?? "",
    listingLinkAutobid: links.autobid ?? "",
    listingLinkOpenline: links.openline ?? "",
    listingLinkAuto1: links.auto1 ?? "",
    listingLinksOther: other,
  };
}

describe("detectIrissListingPlatform", () => {
  it("maps hosts and ignores mobile.de", () => {
    expect(detectIrissListingPlatform("https://autobid.de/en/search-results?x=1")).toBe("autobid");
    expect(detectIrissListingPlatform("https://www.openlane.eu/ru/findcar?y=2")).toBe("openline");
    expect(detectIrissListingPlatform("https://www.auto1.com/en/app/merchant/cars")).toBe("auto1");
    expect(detectIrissListingPlatform("https://suchen.mobile.de/fahrzeuge/search.html")).toBeNull();
    expect(detectIrissListingPlatform("not a url")).toBeNull();
  });
});

describe("buildIrissListingSources", () => {
  it("takes only active orders and only the three auctions", () => {
    const sources = buildIrissListingSources([
      row("a", "active", { mobile: "https://suchen.mobile.de/x", autobid: "https://autobid.de/en/search-results?q=1", openline: "https://www.openlane.eu/en/findcar", auto1: "https://www.auto1.com/en/app/merchant/cars" }),
      row("b", "completed", { autobid: "https://autobid.de/en/search-results?q=2" }),
      row("c", "inactive", { autobid: "https://autobid.de/en/search-results?q=3" }),
    ]);
    expect(sources.map((s) => `${s.orderId}:${s.platform}`)).toEqual(["a:autobid", "a:openline", "a:auto1"]);
  });

  it("uses other links only when the host is an auction, dedupes, trusts host over field", () => {
    const sources = buildIrissListingSources([
      row("a", "active", { openline: "https://autobid.de/en/search-results?q=1" }, [
        "https://autobid.de/en/search-results?q=1",
        "https://www.auto1.com/en/app/merchant/cars?c=1",
        "https://suchen.mobile.de/fahrzeuge/search.html",
        "",
        "ftp://autobid.de/x",
      ]),
    ]);
    expect(sources.map((s) => s.platform)).toEqual(["autobid", "auto1"]);
    expect(sources[0]!.id).toHaveLength(20);
  });

  it("reads one search URL once and keeps every order on that URL", () => {
    const same = "https://autobid.de/en/search-results?b=2&a=1";
    const reordered = "https://autobid.de/en/search-results/?a=1&b=2";
    const other = "https://autobid.de/en/search-results?a=9";
    const sources = buildIrissListingSources([
      row("a", "active", { autobid: same, openline: "https://www.openlane.eu/en/findcar" }),
      row("b", "active", { autobid: reordered }),
      row("c", "active", { autobid: other }),
    ]);
    const groups = groupIrissListingSources(sources);
    const autobid = groups.filter((g) => g.platform === "autobid");
    expect(autobid).toHaveLength(2);
    const shared = autobid.find((g) => g.orders.length === 2)!;
    expect(shared.orders.map((o) => o.orderId).sort()).toEqual(["a", "b"]);
    expect(autobid.find((g) => g.orders.length === 1)!.orders[0]!.orderId).toBe("c");
    expect(groups.find((g) => g.platform === "openline")!.orders).toHaveLength(1);
  });
});
