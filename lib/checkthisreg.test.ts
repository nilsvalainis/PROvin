import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import {
  CHECKTHISREG_STRONG_MAKES,
  checkThisRegHighlighted,
  checkThisRegHint,
  checkThisRegMake,
  checkThisRegMakeTexts,
} from "@/lib/checkthisreg";
import { AdminCheckThisRegButton } from "@/components/admin/AdminCheckThisRegButton";

describe("CheckThisReg markas noteikšana", () => {
  it("saraksts satur Renault", () => {
    expect(CHECKTHISREG_STRONG_MAKES).toContain("RENAULT");
  });
  it("Renault pēc CSDD markas teksta", () => {
    expect(checkThisRegMake({ vin: "", makeTexts: ["RENAULT MEGANE"] })).toBe("Renault");
    expect(checkThisRegMake({ makeTexts: ["Renault Clio"] })).toBe("Renault");
  });
  it("Renault pēc VIN WMI, ja teksta markas nav", () => {
    for (const w of ["VF1", "VF2", "VF6", "VF8"]) {
      expect(checkThisRegMake({ vin: `${w}RFB00X56123456`, makeTexts: [] })).toBe("Renault");
    }
  });
  it("Dacia nav (ne pēc teksta, ne UU1), citas markas nav", () => {
    expect(checkThisRegMake({ vin: "UU1HSDADG12345678", makeTexts: [] })).toBeNull();
    expect(checkThisRegMake({ vin: "VF1RFB00X56123456", makeTexts: ["DACIA DUSTER"] })).toBeNull();
    expect(checkThisRegMake({ vin: "WBA5R1C0XLFH42873", makeTexts: ["BMW 320D"] })).toBeNull();
    expect(checkThisRegMake({ vin: "WBA5R1C0XLFH42873" })).toBeNull();
  });
  it("markas teksti no avotu blokiem (CSDD API + forma)", () => {
    expect(
      checkThisRegMakeTexts({ csdd: { makeModel: "RENAULT KADJAR", registry: { data: { make: "RENAULT" } } } }),
    ).toEqual(["RENAULT", "RENAULT KADJAR"]);
    expect(checkThisRegMakeTexts(null)).toEqual([]);
  });
  it("izcelšana tikai bez datiem / kļūda", () => {
    expect(checkThisRegHighlighted("no_data")).toBe(true);
    expect(checkThisRegHighlighted("failed")).toBe(true);
    expect(checkThisRegHighlighted("done")).toBe(false);
    expect(checkThisRegHighlighted(undefined)).toBe(false);
    expect(checkThisRegHint("Renault")).toBe("Renault dati - CheckThisReg");
  });
});

describe("AdminCheckThisRegButton", () => {
  it("parastā: poga bez markas vārda, saite jaunā cilnē", () => {
    const html = renderToStaticMarkup(
      createElement(AdminCheckThisRegButton, { make: "Renault", vin: "VF1RFB00X56123456", highlighted: false }),
    );
    expect(html).toContain(">CheckThisReg</a>");
    expect(html).toContain('href="https://checkthisreg.com/"');
    expect(html).toContain('target="_blank"');
    expect(html).not.toContain("Renault dati");
  });
  it("izceltā: īss teksts", () => {
    const html = renderToStaticMarkup(
      createElement(AdminCheckThisRegButton, { make: "Renault", vin: "VF1RFB00X56123456", highlighted: true }),
    );
    expect(html).toContain("Renault dati - CheckThisReg");
    expect(html).toContain('data-checkthisreg="highlighted"');
  });
  it("telefona variants", () => {
    const html = renderToStaticMarkup(
      createElement(AdminCheckThisRegButton, { make: "Renault", vin: "VF1", highlighted: true, variant: "glass" }),
    );
    expect(html).toContain("amx-btn--primary");
    expect(html).toContain("Renault dati - CheckThisReg");
  });
});
