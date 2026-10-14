import { describe, expect, it } from "vitest";
import { detectIrissListingPlatform } from "@/lib/iriss-listings-platform";
import { buildIrissListingSources, groupIrissListingSources } from "@/lib/iriss-listings-sources";
import type { IrissPasutijumsListStatus } from "@/lib/iriss-pasutijumi-types";

function row(
  id: string,
  listStatus: IrissPasutijumsListStatus,
  links: Partial<Record<"autobid" | "openline" | "auto1" | "ecarstrade" | "mobile", string | string[]>> = {},
  other: string[] = [],
) {
  return {
    id,
    brandModel: `Car ${id}`,
    listStatus,
    listingLinkMobile: links.mobile ?? "",
    listingLinkAutobid: links.autobid ?? "",
    listingLinkOpenline: links.openline ?? "",
    listingLinkAuto1: links.auto1 ?? "",
    listingLinkEcarstrade: links.ecarstrade ?? "",
    listingLinksOther: other,
  };
}

describe("detectIrissListingPlatform", () => {
  it("maps hosts and ignores mobile.de", () => {
    expect(detectIrissListingPlatform("https://autobid.de/en/search-results?x=1")).toBe("autobid");
    expect(detectIrissListingPlatform("https://www.openlane.eu/ru/findcar?y=2")).toBe("openline");
    expect(detectIrissListingPlatform("https://www.auto1.com/en/app/merchant/cars")).toBe("auto1");
    expect(detectIrissListingPlatform("https://ecarstrade.com/search?mark[]=68")).toBe("ecarstrade");
    expect(detectIrissListingPlatform("https://www.ecarstrade.com/search")).toBe("ecarstrade");
    expect(detectIrissListingPlatform("https://suchen.mobile.de/fahrzeuge/search.html")).toBeNull();
    expect(detectIrissListingPlatform("not a url")).toBeNull();
  });
});

describe("buildIrissListingSources", () => {
  it("takes working orders and only the four auctions", () => {
    const sources = buildIrissListingSources([
      row("a", "active", { mobile: "https://suchen.mobile.de/x", autobid: "https://autobid.de/en/search-results?q=1", openline: "https://www.openlane.eu/en/findcar", auto1: "https://www.auto1.com/en/app/merchant/cars", ecarstrade: "https://ecarstrade.com/search?mark[]=68" }),
      row("s", "searching", { autobid: "https://autobid.de/en/search-results?q=4" }),
      row("o", "offered", { autobid: "https://autobid.de/en/search-results?q=5" }),
      row("r", "reserved", { autobid: "https://autobid.de/en/search-results?q=6" }),
      row("b", "completed", { autobid: "https://autobid.de/en/search-results?q=2" }),
      row("c", "inactive", { autobid: "https://autobid.de/en/search-results?q=3" }),
    ]);
    expect(sources.map((s) => `${s.orderId}:${s.platform}`)).toEqual([
      "a:autobid",
      "a:openline",
      "a:auto1",
      "a:ecarstrade",
      "s:autobid",
      "o:autobid",
      "r:autobid",
    ]);
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

  it("reads every link of each source and still stores mobile.de without fetching it", () => {
    const shared = "https://autobid.de/en/search-results?q=shared";
    const extra = "https://autobid.de/en/search-results?q=extra";
    const sources = buildIrissListingSources([
      row(
        "a",
        "active",
        {
          mobile: ["https://suchen.mobile.de/a", "https://suchen.mobile.de/b"],
          autobid: [shared, extra],
          auto1: ["https://www.auto1.com/en/app/merchant/cars?c=1", "https://www.auto1.com/en/app/merchant/cars?c=2"],
        },
      ),
      row("b", "active", { autobid: [shared] }),
    ]);
    expect(sources.some((s) => /mobile\.de/i.test(s.sourceUrl))).toBe(false);
    expect(sources.filter((s) => s.platform === "autobid")).toHaveLength(3);
    expect(sources.filter((s) => s.platform === "auto1")).toHaveLength(2);
    const groups = groupIrissListingSources(sources);
    const autobid = groups.filter((g) => g.platform === "autobid");
    expect(autobid).toHaveLength(2);
    const sharedGroup = autobid.find((g) => g.orders.length === 2)!;
    expect(sharedGroup.orders.map((o) => o.orderId).sort()).toEqual(["a", "b"]);
    expect(autobid.find((g) => g.orders.length === 1)!.orders[0]!.orderId).toBe("a");
  });

  it("tightens unbounded Auto1/Openlane/Autobid URLs from brandModel so they do not share one all-stock fetch", () => {
    const sources = buildIrissListingSources([
      {
        ...row("a", "active", {
          auto1: "https://www.auto1.com/en/app/merchant/cars?channel=24h",
          openline: "https://www.openlane.eu/en/findcar",
          autobid: "https://autobid.de/en/search-results",
        }),
        brandModel: "LEXUS/TOYOTA",
      },
      {
        ...row("b", "active", {
          auto1: "https://www.auto1.com/en/app/merchant/cars?channel=24h",
        }),
        brandModel: "Audi/VW/Porsche 176kw",
      },
    ]);
    const auto1 = sources.filter((s) => s.platform === "auto1");
    expect(auto1).toHaveLength(2);
    expect(auto1[0]!.sourceUrl).toMatch(/manufacturer=LEXUS/i);
    expect(auto1[1]!.sourceUrl).toMatch(/manufacturer=AUDI/i);
    expect(sources.find((s) => s.platform === "openline")!.sourceUrl).toMatch(/makes=lexus/i);
    expect(sources.find((s) => s.platform === "autobid")!.sourceUrl).toMatch(/name-brand=LEXUS|name-brand=TOYOTA/i);
    expect(groupIrissListingSources(auto1)).toHaveLength(2);
  });

  it("skips Openlane auctionId single-car links that time out in ingest", () => {
    const sources = buildIrissListingSources([
      row("a", "active", {
        openline: [
          "https://www.openlane.eu/en/findcar?auctionId=11689710",
          "https://www.openlane.eu/en/findcar?makes=volvo&models=xc60",
        ],
      }),
    ]);
    expect(sources).toHaveLength(1);
    expect(sources[0]!.platform).toBe("openline");
    expect(sources[0]!.sourceUrl).toMatch(/makes=volvo/i);
    expect(sources.some((s) => /auctionId=/i.test(s.sourceUrl))).toBe(false);
  });
});
