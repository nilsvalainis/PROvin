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
});
