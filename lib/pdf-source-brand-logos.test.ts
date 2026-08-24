import { describe, expect, it } from "vitest";
import {
  pdfDealerBrandFileKey,
  pdfDealerLogoDataUri,
  pdfListingPortalLogoId,
} from "@/lib/pdf-source-brand-logos";

describe("pdfDealerBrandFileKey", () => {
  it("maps CSDD-style make/model to hero dealer logo files", () => {
    expect(pdfDealerBrandFileKey("AUDI A6 AVANT")).toBe("audi");
    expect(pdfDealerBrandFileKey("VW Golf")).toBe("volkswagen");
    expect(pdfDealerBrandFileKey("Volkswagen Passat")).toBe("volkswagen");
    expect(pdfDealerBrandFileKey("Mercedes-Benz E220")).toBe("mercedes");
    expect(pdfDealerBrandFileKey("LAND ROVER DISCOVERY")).toBe("land-rover");
    expect(pdfDealerBrandFileKey("Škoda Octavia")).toBe("skoda");
  });

  it("returns a file key for unmapped makes so a logo can be generated", () => {
    expect(pdfDealerBrandFileKey("TOYOTA YARIS")).toBe("toyota");
    expect(pdfDealerBrandFileKey("")).toBeNull();
  });

  it("falls back to an auto-generated mark when the brand SVG is missing", () => {
    const uri = pdfDealerLogoDataUri("TOYOTA YARIS");
    expect(uri).toBeTruthy();
    expect(uri).toMatch(/^data:image\/svg\+xml/);
    expect(pdfDealerLogoDataUri("AUDI A6")).toBeTruthy();
  });
});

describe("pdfListingPortalLogoId", () => {
  it("uses ss.lv / m.ss.lv, auto24.ee, and mobile.de from the listing URL", () => {
    expect(pdfListingPortalLogoId("https://www.ss.lv/msg/lv/transport/cars/audi/a6/x.html")).toBe("sslv");
    expect(pdfListingPortalLogoId("https://m.ss.lv/msg/lv/transport/cars/bmw/x.html")).toBe("sslv");
    expect(pdfListingPortalLogoId("https://www.auto24.ee/used/123")).toBe("auto24");
    expect(pdfListingPortalLogoId("https://suchen.mobile.de/fahrzeuge/details.html?id=1")).toBe("mobilede");
  });

  it("returns null for other hosts or an empty link", () => {
    expect(pdfListingPortalLogoId(null)).toBeNull();
    expect(pdfListingPortalLogoId("")).toBeNull();
    expect(pdfListingPortalLogoId("https://www.ss.com/msg/lv/x")).toBeNull();
    expect(pdfListingPortalLogoId("https://www.andelemandele.lv/item/1")).toBeNull();
  });
});
