import { describe, expect, it } from "vitest";
import {
  pdfDealerLogoDataUri,
  pdfDealerLogoDataUriPreferBrand,
  pdfDealerLogoIsMonogram,
} from "@/lib/pdf-source-brand-logos";
import { PDF_DEALER_LOGO_DATA_URI } from "@/lib/pdf-source-brand-logo-data";

describe("pdfDealerLogoDataUriPreferBrand", () => {
  it("tikai modelis «Passat Variant» bez VIN -> «P» monogramma (vecā kļūda)", () => {
    const uri = pdfDealerLogoDataUri("Passat Variant");
    expect(uri && pdfDealerLogoIsMonogram(uri)).toBe(true);
  });
  it("tikai modelis + VW VIN -> Volkswagen logo, ne monogramma", () => {
    const uri = pdfDealerLogoDataUriPreferBrand("Passat Variant", "WVWZZZ3CZNE054721");
    expect(uri).toBe(PDF_DEALER_LOGO_DATA_URI.volkswagen);
  });
  it("marka nosaukumā uzvar", () => {
    expect(pdfDealerLogoDataUriPreferBrand("VOLKSWAGEN PASSAT", null)).toBe(PDF_DEALER_LOGO_DATA_URI.volkswagen);
  });
  it("nezināms modelis un nezināms VIN -> monogramma paliek", () => {
    const uri = pdfDealerLogoDataUriPreferBrand("Zzzmodel", "XXX00000000000000");
    expect(uri && pdfDealerLogoIsMonogram(uri)).toBe(true);
  });
});
