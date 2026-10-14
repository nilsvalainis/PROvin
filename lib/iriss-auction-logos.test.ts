import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { irissAuctionLogoSrc, listingChipLogoKey, IRISS_AUCTION_LOGO_LABEL } from "@/lib/iriss-auction-logos";

describe("iriss auction logos", () => {
  it("maps every auction chip to an in-repo mark and Citi to name fallback", () => {
    expect(irissAuctionLogoSrc("auto1")).toBe("/brand/auction/auto1.svg");
    expect(irissAuctionLogoSrc("openline")).toBe("/brand/auction/openlane.svg");
    expect(irissAuctionLogoSrc("autobid")).toBe("/brand/auction/autobid.svg");
    expect(irissAuctionLogoSrc("ecarstrade")).toBe("/brand/auction/ecarstrade.svg");
    expect(irissAuctionLogoSrc("mobile")).toBe("/brand/auction/mobile.svg");
    expect(irissAuctionLogoSrc("citi")).toBeNull();
    expect(listingChipLogoKey("A1")).toBe("auto1");
    expect(listingChipLogoKey("OL")).toBe("openline");
    expect(listingChipLogoKey("AB")).toBe("autobid");
    expect(listingChipLogoKey("ET")).toBe("ecarstrade");
    expect(listingChipLogoKey("M")).toBe("mobile");
    expect(IRISS_AUCTION_LOGO_LABEL.citi).toBe("Citi");
  });

  it("keeps official company SVG marks, not letter pills", () => {
    const files: Array<{ file: string; tokens: string[] }> = [
      { file: "auto1.svg", tokens: ["#20419A", "#F58220"] },
      { file: "openlane.svg", tokens: ["#0a1b5f", "#0061ff"] },
      { file: "autobid.svg", tokens: ["#C3003D", "#00427B"] },
      { file: "ecarstrade.svg", tokens: ["#b24040", "#d84949"] },
      { file: "mobile.svg", tokens: ["#350051", "#FA3C00"] },
    ];
    for (const { file, tokens } of files) {
      const svg = readFileSync(resolve("public/brand/auction", file), "utf8");
      expect(svg).toMatch(/<svg[\s>]/i);
      expect(svg.length).toBeGreaterThan(800);
      for (const token of tokens) expect(svg).toContain(token);
    }
  });
});
