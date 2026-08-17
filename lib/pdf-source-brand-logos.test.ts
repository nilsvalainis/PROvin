import { describe, expect, it } from "vitest";
import {
  pdfDealerBrandFileKey,
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

  it("returns null when the make is not in the hero dealer set", () => {
    expect(pdfDealerBrandFileKey("TOYOTA YARIS")).toBeNull();
    expect(pdfDealerBrandFileKey("")).toBeNull();
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
