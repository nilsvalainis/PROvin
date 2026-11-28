import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildCcVinPdfInnerHtml } from "@/lib/cc-vin-pdf-html";
import { emptyCcVinBlock, normalizeCcVinBlock } from "@/lib/cc-vin-report";
import { applyCheckcarImportToBlock, parseCheckcarImport } from "@/lib/checkcar-full-report";
import {
  checkcarReportDataRoot,
  parseCheckcarReportData,
  parseCheckcarServicesText,
  parseCheckcarSpecsText,
} from "@/lib/checkcar-report-data";

/** Reālas atskaites 28.11 (savāktas ar izvērstām sadaļām); klientu datu CheckCar atskaitēs nav. */
const fx = (name: string) => readFileSync(path.join(__dirname, "__fixtures__/checkcar", name), "utf8");
const BMW_TEXT = fx("bmw-530d.report.txt");
const BMW_DATA = JSON.parse(fx("bmw-530d.report-data.json")) as unknown;
const AMAROK_TEXT = fx("vw-amarok.report.txt");
const AMAROK_DATA = JSON.parse(fx("vw-amarok.report-data.json")) as unknown;

describe("fixtures", () => {
  it("bez personas datiem (e-pasts, telefons)", () => {
    for (const raw of [BMW_TEXT, AMAROK_TEXT, JSON.stringify(BMW_DATA), JSON.stringify(AMAROK_DATA)]) {
      expect(raw).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
      expect(raw).not.toMatch(/\+\d{3}\s?\d{6,}/);
    }
  });
});

describe("parseCheckcarReportData - BMW 530d WBAMW91040DV10103", () => {
  const d = parseCheckcarReportData(BMW_DATA)!;

  it("visi 29 odometra ieraksti", () => {
    expect(d.mileage).toHaveLength(29);
    expect(d.mileage[0]).toEqual({ date: "01.10.2013", odometer: "25500", country: "" });
    expect(d.mileage.find((m) => m.date === "22.06.2025")).toEqual({ date: "22.06.2025", odometer: "268200", country: "Vācija" });
  });

  it("visi 29 servisa ieraksti ar darbiem un nobraukumu pēc datuma", () => {
    expect(d.services).toHaveLength(29);
    expect(d.services[0]!.date).toBe("01.02.2023");
    expect(d.services[0]!.odometer).toBe("204 000");
    expect(d.services[0]!.description).toContain("Exhaust gas radiator high temperature (11717822350)");
    expect(d.services[0]!.description).toContain("ET-No. 11658595650 1/2 proportionally");
    const last = d.services[28]!;
    expect(last.date).toBe("01.10.2013");
    expect(last.description).toContain("Dent in the front flap gently inst");
    expect(d.counts.find((c) => c.section === "Servisa ieraksti")).toEqual({ section: "Servisa ieraksti", declared: 29, parsed: 29 });
  });

  it("izsole ar cenu un statusu", () => {
    expect(d.sales).toEqual([
      { date: "22.06.2025", venue: "AUTOBID", odometer: "268 200", price: "10 158 EUR", status: "Pārdots" },
    ]);
  });

  it("specifikācija latviski, bez tukšajiem «-»", () => {
    const by = Object.fromEntries(d.specs.map((r) => [r.label, r.value]));
    expect(by["Dzinēja kods"]).toBe("N57D30A");
    expect(by["Virsbūve"]).toBe("Universālis");
    expect(by["Piedziņa"]).toBe("Pilnpiedziņa (4x4)");
    expect(by["Dzinēja jauda"]).toBe("190 kW (255 hp)");
    expect(by["Maksimālais ātrums"]).toBe("245 km/h");
    expect(by["Krāsa"]).toBeUndefined();
    expect(d.specs.every((r) => r.value !== "-")).toBe(true);
  });

  it("teksta rezerve: tie paši 29 servisi un specifikācija no izvērstās lapas", () => {
    const svc = parseCheckcarServicesText(BMW_TEXT);
    expect(svc).toHaveLength(29);
    expect(svc[0]!.date).toBe("01.02.2023");
    expect(svc[1]!.description).toContain("Seal, door seam, roof front left (51767182285)");
    expect(parseCheckcarSpecsText(BMW_TEXT)).toEqual(d.specs);
  });
});

describe("parseCheckcarReportData - VW Amarok WV1ZZZ2HZHH001470", () => {
  it("4 izsoles no datiem (lapa sadaļu nerenderē)", () => {
    expect(AMAROK_TEXT).not.toMatch(/Auction sale history/);
    const d = parseCheckcarReportData(AMAROK_DATA)!;
    expect(d.sales.map((r) => [r.date, r.price, r.status, r.odometer])).toEqual([
      ["14.05.2025", "17 471 EUR", "Nav pārdots", "194 900"],
      ["12.05.2025", "16 607 EUR", "Nav pārdots", "194 900"],
      ["07.05.2025", "19 854 EUR", "Nav pārdots", "194 900"],
      ["30.04.2025", "19 998 EUR", "Nav pārdots", "194 900"],
    ]);
    expect(d.mileage).toHaveLength(4);
    expect(d.mileage.every((m) => m.odometer === "194900" && m.country === "Vācija")).toBe(true);
    expect(d.services).toEqual([]);
  });

  it("pieņem arī __NUXT__.data masīvu un JSON tekstu", () => {
    expect(checkcarReportDataRoot([{ report: { data: AMAROK_DATA } }])).toBe(AMAROK_DATA);
    expect(checkcarReportDataRoot(JSON.stringify(AMAROK_DATA))).toEqual(AMAROK_DATA);
    expect(checkcarReportDataRoot({ foo: 1 })).toBeNull();
    expect(parseCheckcarReportData("nav json")).toBeNull();
  });
});

describe("imports pasūtījumā", () => {
  it("Amarok: teksts + dati -> 4 pārdošanas, nobraukums, RAW ar visiem ierakstiem", () => {
    const imported = parseCheckcarImport({ vin: "WV1ZZZ2HZHH001470", text: AMAROK_TEXT, data: AMAROK_DATA });
    expect(imported.parsed.sales).toHaveLength(4);
    expect(imported.parsed.mileage.length).toBeGreaterThanOrEqual(4);
    expect(imported.parsed.reportDate).toBe("28.11.2026");
    expect(imported.parsed.notes).toEqual([]);
    expect(imported.rawText).toContain("Lapas dati (visi ieraksti)");
    expect(imported.rawText).toContain("30.04.2025 | AUTOBID | 194 900 km | 19 998 EUR | Nav pārdots");
    const block = applyCheckcarImportToBlock(emptyCcVinBlock(), imported, "28.11.2026");
    expect(block.sales.filter((r) => r.date)).toHaveLength(4);
    expect(block.specs?.find((r) => r.label === "Sērija")?.value).toBe("Amarok I Double Cab (facelift 2016)");
  });

  it("BMW: teksts + dati nedublē (29 nobraukumi, 1 izsole, 29 servisi); bez datiem - no teksta", () => {
    const withData = parseCheckcarImport({ vin: "WBAMW91040DV10103", text: BMW_TEXT, data: BMW_DATA });
    expect(withData.parsed.mileage).toHaveLength(29);
    expect(withData.parsed.sales).toHaveLength(1);
    expect(withData.parsed.services).toHaveLength(29);
    const textOnly = parseCheckcarImport({ vin: "WBAMW91040DV10103", text: BMW_TEXT });
    expect(textOnly.parsed.mileage).toHaveLength(29);
    expect(textOnly.parsed.services).toHaveLength(29);
    expect(textOnly.parsed.services![0]!.odometer).toBe("204 000");
  });

  it("atkārtots imports nedublē servisus; normalizācija saglabā servisus un «Citi dati»", () => {
    const imported = parseCheckcarImport({ vin: "WBAMW91040DV10103", text: BMW_TEXT, data: BMW_DATA });
    const once = applyCheckcarImportToBlock(emptyCcVinBlock(), imported, "28.11.2026");
    const twice = applyCheckcarImportToBlock(once, imported, "28.11.2026");
    expect(twice.services).toHaveLength(29);
    expect(twice.specs).toHaveLength(once.specs!.length);
    const back = normalizeCcVinBlock(JSON.parse(JSON.stringify(twice)));
    expect(back.services).toHaveLength(29);
    expect(back.specs).toEqual(twice.specs);
  });

  it("klienta PDF: servisi un «Citi dati» latviski, bez avota nosaukuma", () => {
    const imported = parseCheckcarImport({ vin: "WBAMW91040DV10103", text: BMW_TEXT, data: BMW_DATA });
    const block = applyCheckcarImportToBlock(emptyCcVinBlock(), imported, "28.11.2026");
    const html = buildCcVinPdfInnerHtml(block);
    expect(html).toContain("Servisa ieraksti");
    expect(html).toContain("Veiktie darbi un detaļas (oriģināls)");
    expect(html).toContain("Exhaust gas radiator high temperature (11717822350)");
    expect(html).toContain("Citi dati: tehniskā specifikācija");
    expect(html).toContain("N57D30A");
    expect(html).not.toMatch(/checkcar/i);
    expect((html.match(/<br>/g) ?? []).length).toBeGreaterThan(29);
  });
});
