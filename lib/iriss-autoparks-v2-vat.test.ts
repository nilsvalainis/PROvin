import { describe, expect, it } from "vitest";
import { vatModeFromInvoiceText } from "@/lib/iriss-autoparks-v2-vat";

describe("PVN režīms no izsoles rēķina", () => {
  it("Autobid rēķins ar §25a -> margin", () => {
    const text = `autobid.de GmbH Rechnung Nr. 4471-882 Fahrzeug VW Passat Variant FIN WVWZZZ3CZKE012345
      Kaufpreis 9.850,00 EUR Differenzbesteuerung gem. § 25a UStG - Umsatzsteuer wird nicht gesondert ausgewiesen.`;
    expect(vatModeFromInvoiceText(text)).toBe("margin");
  });
  it("inkl. 19 % MwSt -> PVN; zzgl. MwSt -> neto", () => {
    expect(vatModeFromInvoiceText("Gesamtbetrag 12.000,00 EUR inkl. 19 % MwSt")).toBe("gross");
    expect(vatModeFromInvoiceText("Nettobetrag 10.000 EUR zzgl. 19% MwSt")).toBe("net");
  });
  it("neatpazīts vai tukšs teksts -> nav režīma (nevis noklusējums)", () => {
    expect(vatModeFromInvoiceText("Rechnung 123 Fahrzeug")).toBe("");
    expect(vatModeFromInvoiceText("")).toBe("");
  });
});
