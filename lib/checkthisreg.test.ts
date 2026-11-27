import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import {
  CHECKTHISREG_MIN_YEAR,
  CHECKTHISREG_STRONG_MAKES,
  CHECKTHISREG_URL,
  checkThisRegMakeFromBlocks,
  checkThisRegYear,
  checkThisRegYearFromText,
  checkThisRegHighlighted,
  checkThisRegHint,
  checkThisRegMake,
  checkThisRegMakeTexts,
} from "@/lib/checkthisreg";
import { AdminCheckThisRegButton } from "@/components/admin/AdminCheckThisRegButton";

const NOW = new Date("2026-11-27T12:00:00Z");

describe("CheckThisReg markas noteikšana", () => {
  it("saraksts un sliekšņi", () => {
    expect([...CHECKTHISREG_STRONG_MAKES]).toEqual([
      "RENAULT", "DACIA", "BMW", "MINI", "JAGUAR", "MERCEDES-BENZ", "SMART", "LAND ROVER",
      "AUDI", "SKODA", "VOLKSWAGEN", "SEAT", "CUPRA", "HONDA", "ROLLS-ROYCE",
    ]);
    expect(CHECKTHISREG_MIN_YEAR).toEqual({
      "MERCEDES-BENZ": 2008, SMART: 2008, "LAND ROVER": 2009, AUDI: 2013, SKODA: 2013,
      VOLKSWAGEN: 2017, SEAT: 2017, CUPRA: 2017, HONDA: 2020, "ROLLS-ROYCE": 2020,
    });
    expect(CHECKTHISREG_URL).toBe("https://www.checkthisreg.com/");
  });

  it.each([
    ["RENAULT MEGANE", "Renault"],
    ["Dacia Duster", "Dacia"],
    ["BMW 320D", "BMW"],
    ["MINI COOPER S", "MINI"],
    ["JAGUAR F-PACE", "Jaguar"],
  ])("bez gada ierobežojuma: %s (arī vecs auto, arī bez gada)", (text, display) => {
    expect(checkThisRegMake({ makeTexts: [text], year: 1999, now: NOW })).toBe(display);
    expect(checkThisRegMake({ makeTexts: [text], now: NOW })).toBe(display);
  });

  it.each([
    ["MERCEDES-BENZ C 220", "Mercedes-Benz", 2008],
    ["SMART FORTWO", "smart", 2008],
    ["LAND ROVER RANGE ROVER", "Land Rover", 2009],
    ["AUDI A6", "Audi", 2013],
    ["ŠKODA OCTAVIA", "Škoda", 2013],
    ["VOLKSWAGEN GOLF", "Volkswagen", 2017],
    ["SEAT LEON", "SEAT", 2017],
    ["CUPRA FORMENTOR", "Cupra", 2017],
    ["HONDA CIVIC", "Honda", 2020],
    ["ROLLS-ROYCE GHOST", "Rolls-Royce", 2020],
  ])("gada slieksnis: %s >= %s", (text, display, min) => {
    expect(checkThisRegMake({ makeTexts: [text as string], year: (min as number) - 1, now: NOW })).toBeNull();
    expect(checkThisRegMake({ makeTexts: [text as string], year: min as number, now: NOW })).toBe(display);
    expect(checkThisRegMake({ makeTexts: [text as string], year: (min as number) + 3, now: NOW })).toBe(display);
  });

  it("gada slieksnis: gads nezināms un VIN nav - poga nav", () => {
    expect(checkThisRegMake({ makeTexts: ["AUDI A4"], now: NOW })).toBeNull();
  });

  it("gada slieksnis: rezerve pēc VIN 10. zīmes", () => {
    // 10. zīme «H» = 2017, «G» = 2016
    expect(checkThisRegMake({ vin: "WVWZZZAUZHW000001", makeTexts: ["VW GOLF"], now: NOW })).toBe("Volkswagen");
    expect(checkThisRegMake({ vin: "WVWZZZAUZGW000001", makeTexts: ["VW GOLF"], now: NOW })).toBeNull();
  });

  it("pēc VIN WMI, ja teksta markas nav", () => {
    for (const w of ["VF1", "VF2", "VF6", "VF8"]) {
      expect(checkThisRegMake({ vin: `${w}RFB00X56123456`, now: NOW })).toBe("Renault");
    }
    expect(checkThisRegMake({ vin: "UU1HSDADG12345678", now: NOW })).toBe("Dacia");
    expect(checkThisRegMake({ vin: "WBA5R1C0XLFH42873", now: NOW })).toBe("BMW");
    expect(checkThisRegMake({ vin: "WMWXXXXXXXX000001", now: NOW })).toBe("MINI");
  });

  it("teksta marka noteicošā; citas markas nav", () => {
    expect(checkThisRegMake({ vin: "VF1RFB00X56123456", makeTexts: ["NISSAN QASHQAI"], now: NOW })).toBeNull();
    expect(checkThisRegMake({ makeTexts: ["TOYOTA RAV4"], year: 2024, now: NOW })).toBeNull();
    expect(checkThisRegMake({ vin: "JTDXXXXXXXX000001", now: NOW })).toBeNull();
  });

  it("gads no teksta", () => {
    expect(checkThisRegYearFromText("2015-03-12")).toBe(2015);
    expect(checkThisRegYearFromText("12.03.2013")).toBe(2013);
    expect(checkThisRegYearFromText("")).toBeNull();
  });

  it("no avotu blokiem: CSDD API marka/gads, formas pirmā reģistrācija", () => {
    const api = { csdd: { makeModel: "AUDI A6", registry: { data: { make: "AUDI", year: "2012", firstRegistrationIso: "2013-01-05" } } } };
    expect(checkThisRegMakeTexts(api)).toEqual(["AUDI", "AUDI A6"]);
    expect(checkThisRegYear(api)).toBe(2012);
    expect(checkThisRegMakeFromBlocks(api, "WAUZZZ4G0CN000001")).toBeNull();
    const form = { csdd: { makeModel: "AUDI A6", firstRegistration: "2014-05-01" } };
    expect(checkThisRegMakeFromBlocks(form, "")).toBe("Audi");
    expect(checkThisRegMakeTexts(null)).toEqual([]);
  });

  it("izcelšana tikai «datu nav»", () => {
    expect(checkThisRegHighlighted("no_data")).toBe(true);
    expect(checkThisRegHighlighted("failed")).toBe(false);
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
    expect(html).toContain('href="https://www.checkthisreg.com/"');
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
