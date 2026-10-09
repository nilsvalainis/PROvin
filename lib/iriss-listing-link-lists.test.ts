import { describe, expect, it } from "vitest";
import { buildListingPlatformChips } from "@/lib/iriss-listing-links";
import {
  addIrissListingLinkRow,
  coerceIrissListingLinkList,
  IRISS_LISTING_LINKS_PER_SOURCE_MAX,
  irissListingLinkUrlError,
  labelIrissListingLinkRows,
  parseIrissPasutijumsListingLinks,
  removeIrissListingLinkRow,
  setIrissListingLinkRow,
} from "@/lib/iriss-listing-link-lists";

describe("coerceIrissListingLinkList", () => {
  it("reads an old single string as a one-item list", () => {
    expect(coerceIrissListingLinkList("https://autobid.de/a")).toEqual(["https://autobid.de/a"]);
    expect(coerceIrissListingLinkList("")).toEqual([""]);
  });

  it("keeps array order and pads a missing value with one empty row", () => {
    expect(coerceIrissListingLinkList(["https://a.example/1", "https://a.example/2"])).toEqual([
      "https://a.example/1",
      "https://a.example/2",
    ]);
    expect(coerceIrissListingLinkList([])).toEqual([""]);
    expect(coerceIrissListingLinkList(undefined)).toEqual([""]);
    expect(coerceIrissListingLinkList({ href: "nope" })).toEqual([""]);
  });
});

describe("parseIrissPasutijumsListingLinks", () => {
  it("parses an old-format order with one string per named source", () => {
    const parsed = parseIrissPasutijumsListingLinks({
      id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      listingLinkMobile: "https://suchen.mobile.de/a",
      listingLinkAutobid: "https://autobid.de/en/search-results?q=1",
      listingLinkOpenline: "https://www.openlane.eu/en/findcar",
      listingLinkAuto1: "https://www.auto1.com/en/app/merchant/cars",
      listingLinksOther: ["https://example.com/x", ""],
    });
    expect(parsed.listingLinkMobile).toEqual(["https://suchen.mobile.de/a"]);
    expect(parsed.listingLinkAutobid).toEqual(["https://autobid.de/en/search-results?q=1"]);
    expect(parsed.listingLinkOpenline).toEqual(["https://www.openlane.eu/en/findcar"]);
    expect(parsed.listingLinkAuto1).toEqual(["https://www.auto1.com/en/app/merchant/cars"]);
    expect(parsed.listingLinksOther).toEqual(["https://example.com/x", ""]);
  });

  it("keeps multiple links per source when already stored as arrays", () => {
    const parsed = parseIrissPasutijumsListingLinks({
      listingLinkMobile: ["https://suchen.mobile.de/a", "https://suchen.mobile.de/b"],
      listingLinkAutobid: ["https://autobid.de/1", "https://autobid.de/2"],
      listingLinkOpenline: ["https://www.openlane.eu/1"],
      listingLinkAuto1: ["https://www.auto1.com/1", "https://www.auto1.com/2", "https://www.auto1.com/3"],
      listingLinksOther: ["https://citi.example/1"],
    });
    expect(parsed.listingLinkMobile).toHaveLength(2);
    expect(parsed.listingLinkAutobid).toEqual(["https://autobid.de/1", "https://autobid.de/2"]);
    expect(parsed.listingLinkAuto1).toHaveLength(3);
  });
});

describe("listing link row add/remove", () => {
  it("appends an empty row and removes by index without reordering the rest", () => {
    const start = ["https://autobid.de/1", "https://autobid.de/2"];
    const added = addIrissListingLinkRow(start);
    expect(added).toEqual(["https://autobid.de/1", "https://autobid.de/2", ""]);
    expect(setIrissListingLinkRow(added, 2, "https://autobid.de/3")).toEqual([
      "https://autobid.de/1",
      "https://autobid.de/2",
      "https://autobid.de/3",
    ]);
    expect(removeIrissListingLinkRow(["https://a", "https://b", "https://c"], 1)).toEqual(["https://a", "https://c"]);
  });

  it("resets the last row to empty instead of dropping the list", () => {
    expect(removeIrissListingLinkRow(["https://only.example"], 0)).toEqual([""]);
    expect(removeIrissListingLinkRow([""], 0)).toEqual([""]);
  });

  it("does not grow past the per-source cap", () => {
    const full = Array.from({ length: IRISS_LISTING_LINKS_PER_SOURCE_MAX }, (_, i) => `https://ex.example/${i}`);
    expect(addIrissListingLinkRow(full)).toHaveLength(IRISS_LISTING_LINKS_PER_SOURCE_MAX);
  });
});

describe("URL validation", () => {
  it("accepts empty and http(s), rejects other schemes", () => {
    expect(irissListingLinkUrlError("")).toBeNull();
    expect(irissListingLinkUrlError("  ")).toBeNull();
    expect(irissListingLinkUrlError("https://autobid.de/en/search-results")).toBeNull();
    expect(irissListingLinkUrlError("http://openlane.eu/x")).toBeNull();
    expect(irissListingLinkUrlError("ftp://autobid.de/x")).toBeTruthy();
    expect(irissListingLinkUrlError("not a url")).toBeTruthy();
  });
});

describe("preview labels and chips", () => {
  it("numbers a source only when it has more than one link and keeps mobile.de visible", () => {
    const labeled = labelIrissListingLinkRows([
      { label: "Mobile", hrefs: ["https://suchen.mobile.de/a", "https://suchen.mobile.de/b"] },
      { label: "Autobid", hrefs: ["https://autobid.de/1"] },
    ]);
    expect(labeled.map((x) => x.label)).toEqual(["Mobile 1", "Mobile 2", "Autobid"]);
  });

  it("builds a chip per http(s) URL including several mobile.de links", () => {
    const chips = buildListingPlatformChips({
      listingLinkMobile: ["https://suchen.mobile.de/a", "https://suchen.mobile.de/b"],
      listingLinkAutobid: "https://autobid.de/en/search-results?q=1",
      listingLinkOpenline: ["https://www.openlane.eu/en/findcar", "https://www.openlane.eu/en/findcar?x=2"],
      listingLinkAuto1: ["https://www.auto1.com/en/app/merchant/cars"],
      listingLinksOther: ["https://example.com/citi"],
    });
    expect(chips.filter((c) => c.letter === "M")).toHaveLength(2);
    expect(chips.filter((c) => c.letter === "OL")).toHaveLength(2);
    expect(chips.map((c) => c.letter)).toEqual(["M", "M", "AB", "OL", "OL", "A1", "C"]);
  });
});
