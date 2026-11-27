import { describe, expect, it } from "vitest";
import {
  buildPdfTopSectionHtml,
  PDF_TOP6_CSS,
  PDF_TOP_MAKE_LOGO_MAX_H,
  pdfTopMakeLogoBox,
  pdfTopMakeLogoUri,
  pdfTopSvgAspect,
} from "@/lib/pdf-report-top";

const CELL_W = 700 / 4 - 18;

describe("markas logo izmērs avotu rindā (Nils 27.11: Škoda par lielu)", () => {
  it("platas vārdzīmes (Škoda, Jaguar, Kia) nepārsniedz 64 px platumu un 20 px augstumu", () => {
    for (const mk of ["Skoda", "Jaguar", "Kia", "Dacia", "Audi", "Ford"]) {
      const uri = pdfTopMakeLogoUri(mk);
      expect(uri, mk).toBeTruthy();
      const box = pdfTopMakeLogoBox(pdfTopSvgAspect(uri!), CELL_W);
      expect(box.w, mk).toBeLessThanOrEqual(64);
      expect(box.h, mk).toBeLessThanOrEqual(PDF_TOP_MAKE_LOGO_MAX_H);
    }
  });

  it("Škoda vārdzīme ir zema (≤ 10 px) un ≤ 65 % kolonnas", () => {
    const box = pdfTopMakeLogoBox(pdfTopSvgAspect(pdfTopMakeLogoUri("Skoda")!), CELL_W);
    expect(box.h).toBeLessThanOrEqual(10);
    expect(box.w).toBeLessThanOrEqual(CELL_W * 0.65);
  });

  it("kvadrātveida zīmes (BMW, VW, Mercedes, Volvo) - 20 px", () => {
    for (const mk of ["BMW", "Volkswagen", "Mercedes-Benz", "Volvo"]) {
      const box = pdfTopMakeLogoBox(pdfTopSvgAspect(pdfTopMakeLogoUri(mk)!), CELL_W);
      expect(box.h, mk).toBe(20);
    }
  });

  it("šaura kolonna samazina platumu; nederīgs aspekts nesalauž", () => {
    expect(pdfTopMakeLogoBox(7, 60).w).toBeLessThanOrEqual(39);
    expect(pdfTopMakeLogoBox(NaN, CELL_W)).toEqual({ w: 20, h: 20 });
  });

  it("HTML: markas logo ar skaidru width/height; CSS ierobežo max-height un object-fit", () => {
    const uri = pdfTopMakeLogoUri("Skoda")!;
    const html = buildPdfTopSectionHtml({
      lang: "lv", logoSvg: "<svg></svg>", kindTitle: "AUDITS", dateLabel: "27.11.2026", makeModel: "", vin: "", specLine: "",
      photo: null, odometer: null, age: "", firstReg: null, cards: [],
      sources: [
        { logo: { key: "csdd" }, name: "CSDD", category: "catRegistry", count: 3 },
        { name: "car.info", category: "catPublic", count: 2 },
        { logo: { uri, make: true }, name: "Skoda", category: "catDealer", count: 12 },
        { name: "Izsoles", category: "catAuctions", count: 1 },
      ],
      totals: { paid: 2, pub: 2, other: 0 }, wordmarkHtml: "PROVIN",
    });
    const m = /pdf-top6-src__logo--make" style="width:([\d.]+)px;height:([\d.]+)px"/.exec(html);
    expect(m).toBeTruthy();
    expect(Number(m![1])).toBeLessThanOrEqual(64);
    expect(Number(m![2])).toBeLessThanOrEqual(10);
    expect(PDF_TOP6_CSS).toMatch(/\.pdf-top6-src__logo--make\{[^}]*max-height:20px[^}]*object-fit:contain/);
    expect(PDF_TOP6_CSS).not.toMatch(/\.pdf-top6-src__logo--make\{[^}]*height:22px/);
  });
});
