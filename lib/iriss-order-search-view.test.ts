import { describe, expect, it } from "vitest";
import { formatIrissHitSourceLine, irissHitAuctionUrl } from "@/lib/iriss-order-search-view";

describe("iriss order search view", () => {
  it("formats admin-only source and prefers detailUrl", () => {
    expect(formatIrissHitSourceLine("auto1", "DE")).toBe("Auto1 · Vācija");
    expect(formatIrissHitSourceLine("openline", "BE")).toBe("Openlane · Beļģija");
    expect(formatIrissHitSourceLine("mobilede", "")).toBe("mobile.de");
    expect(irissHitAuctionUrl({ detailUrl: "https://auto1.com/a", sourceLinks: [{ platform: "auto1", url: "https://other" }] })).toBe(
      "https://auto1.com/a",
    );
    expect(irissHitAuctionUrl({ detailUrl: "", sourceLinks: [{ platform: "auto1", url: "https://other" }] })).toBe("https://other");
  });
});
