import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  pdfDealerBrandFileKey,
  pdfDealerBrandFileKeyFromVin,
  pdfDealerLogoDataUri,
  pdfDealerLogoDataUriFromVin,
  pdfDealerLogoIsMonogram,
  pdfListingPortalLogoId,
} from "@/lib/pdf-source-brand-logos";

describe("pdfDealerBrandFileKey", () => {
  it("maps CSDD-style make/model to hero dealer logo files", () => {
    expect(pdfDealerBrandFileKey("AUDI A6 AVANT")).toBe("audi");
    expect(pdfDealerBrandFileKey("VW Golf")).toBe("volkswagen");
    expect(pdfDealerBrandFileKey("Volkswagen Passat")).toBe("volkswagen");
    expect(pdfDealerBrandFileKey("Mercedes-Benz E220")).toBe("mercedes");
    expect(pdfDealerBrandFileKey("Rolls-Royce Ghost")).toBe("rolls-royce");
    expect(pdfDealerBrandFileKey("ROLLS ROYCE PHANTOM")).toBe("rolls-royce");
    expect(pdfDealerBrandFileKey("LAND ROVER DISCOVERY")).toBe("land-rover");
    expect(pdfDealerBrandFileKey("Škoda Octavia")).toBe("skoda");
    expect(pdfDealerBrandFileKey("Subaru Forester")).toBe("subaru");
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
    expect(pdfDealerLogoDataUri("Rolls-Royce Ghost")).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(pdfDealerLogoDataUri("Subaru Forester")).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it("recognizes the generated monogram tile (percent-encoded SVG, not base64)", () => {
    // pdfDealerLogoDataUri encodes unknown-brand monograms via encodeURIComponent,
    // so the literal font-weight="700" marker is percent-escaped in the data URI.
    const uri = pdfDealerLogoDataUri("Xyzzy Motors")!;
    expect(uri).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    expect(pdfDealerLogoIsMonogram(uri)).toBe(true);
  });

  it("prefers the real brand SVG over a monogram for a known VIN WMI", () => {
    const uri = pdfDealerLogoDataUriFromVin("YV1PZ68TCL1106362")!;
    expect(uri).toBeTruthy();
    expect(pdfDealerLogoIsMonogram(uri)).toBe(false);
  });

  it("embeds Mercedes as a star-in-ring SVG (not a solid dark disc)", () => {
    const uri = pdfDealerLogoDataUri("Mercedes-Benz")!;
    expect(uri).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(pdfDealerLogoIsMonogram(uri)).toBe(false);
    const decoded = Buffer.from(uri.split(",")[1]!, "base64").toString("utf8");
    expect(decoded).toContain('viewBox="0 0 24 24"');
    // Solid dark plate becomes a black blob under OEM CSS filter:brightness(0).
    expect(decoded).not.toMatch(/fill="#0b1220"|fill="#0f172a"|fill="#111"/i);
    expect(pdfDealerBrandFileKeyFromVin("WDC1671191A006856")).toBe("mercedes");
    expect(pdfDealerLogoIsMonogram(pdfDealerLogoDataUriFromVin("WDC1671191A006856")!)).toBe(false);
  });

  it("stays browser-safe so the admin client bundle does not pull node:fs", () => {
    const src = readFileSync(new URL("./pdf-source-brand-logos.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/from ["']node:(?:fs|path)["']/);
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
