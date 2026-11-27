import { beforeEach, describe, expect, it } from "vitest";

import { emptyCcVinBlock } from "@/lib/cc-vin-report";
import {
  applyCheckcarImportToBlock,
  attachCheckcarPhotos,
  checkcarHtmlToText,
  checkcarPageVinMismatch,
  checkcarPdfGroupTitle,
  checkcarPhotoGroupTitle,
  CHECKCAR_RAW_MARKER,
  knownCcVinSourceUrls,
  mergeCheckcarRaw,
  parseCheckcarImport,
} from "@/lib/checkcar-full-report";
import { setEcbDailyRatesForTests } from "@/lib/currency-eur-convert";

beforeEach(() => {
  setEcbDailyRatesForTests({ date: "2026-11-27", rates: { USD: 1.09, GBP: 0.85 } });
});

/** Izdomāts VIN un dati (anonimizēti; struktūra kā publiskajā atskaites lapā). */
const VIN = "VF1AAAAA012345678";

/** Lapas teksts tādā pašā secībā kā PDF atskaitē (innerText). */
const REPORT_TEXT = [
  "Vehicle history report",
  "Renault Kangoo, 2014",
  "VIN:",
  VIN,
  "Report Date:",
  "26/11/2026",
  "3/12 attention marks",
  "Auction sale history",
  "2 record(s)",
  "SOLD #1",
  "4,250 EUR",
  "187,300 km",
  "AUTOBID",
  "14/03/2025",
  "SOLD #2",
  "2,100 EUR",
  "120,000 km",
  "AUTOBID",
  "02/02/2021",
  "VEHICLE INFO",
  "MakeRenault",
].join("\n");

/** Cita lapas struktūra (kartītes, garās rindas) - galvenais parseris to nepazīst. */
const CARD_TEXT = [
  `Vehicle history report for ${VIN}`,
  "Lot from Autobid auction - 14.03.2025",
  "Mileage: 187 300 km · Price: € 4 250 · Sold",
  "Photos (24)",
  "Inspection record 2019-05-10",
  "Odometer 95 000 km",
].join("\n");

describe("CheckCar pilnās atskaites parseris", () => {
  it("PDF formāta tekstu nolasa ar galveno parseri: izsoles, km, cenas EUR", () => {
    const r = parseCheckcarImport({ vin: VIN, text: REPORT_TEXT });
    expect(r.fallbackRows).toBe(0);
    expect(r.parsed.sales.map((s) => [s.date, s.venue, s.odometer, s.status])).toEqual([
      ["14.03.2025", "AUTOBID", "187 300", "Pārdots"],
      ["02.02.2021", "AUTOBID", "120 000", "Pārdots"],
    ]);
    expect(r.parsed.mileage.map((m) => [m.date, m.odometer])).toEqual([
      ["14.03.2025", "187300"],
      ["02.02.2021", "120000"],
    ]);
    expect(r.parsed.reportDate).toBe("26.11.2026");
  });

  it("nezināmu struktūru nolasa elastīgi: datums + km / cena / izsole, ar piezīmi operatoram", () => {
    const r = parseCheckcarImport({ vin: VIN, text: CARD_TEXT });
    expect(r.fallbackRows).toBeGreaterThan(0);
    expect(r.parsed.sales).toEqual([
      { date: "14.03.2025", venue: "Autobid", odometer: "187 300", price: "4 250 EUR", status: "Pārdots" },
    ]);
    expect(r.parsed.mileage).toEqual([
      { date: "14.03.2025", odometer: "187300", country: "" },
      { date: "10.05.2019", odometer: "95000", country: "" },
    ]);
    expect(r.parsed.notes.join(" ")).toMatch(/elastīgo parseri/);
  });

  it("bez innerText nolasa HTML redzamo tekstu (skripti un stili izmesti)", () => {
    const html = `<html><script>var x="14/03/1999 999 km"</script><body><div>VIN: ${VIN}</div><p>Autobid 14.03.2025</p><p>187 300 km</p></body></html>`;
    const text = checkcarHtmlToText(html);
    expect(text).not.toMatch(/1999/);
    const r = parseCheckcarImport({ vin: VIN, text: "", html });
    expect(r.parsed.mileage).toEqual([{ date: "14.03.2025", odometer: "187300", country: "" }]);
    expect(r.rawText).toContain("Autobid 14.03.2025");
  });

  it("VIN aizsargs: cits VIN lapā vai lapa bez VIN neder", () => {
    expect(checkcarPageVinMismatch(REPORT_TEXT, "", VIN)).toBe(false);
    expect(checkcarPageVinMismatch(REPORT_TEXT.replace(VIN, "WVWZZZ1KZAW000001"), "", VIN)).toBe(true);
    expect(checkcarPageVinMismatch("bez vin", "", VIN)).toBe(true);
    expect(checkcarPageVinMismatch("bez vin", `https://checkcar.vin/report/${VIN}`, VIN)).toBe(false);
  });
});

describe("foto grupas", () => {
  it("nosaukums: CheckCar.vin · izsole · datums; klienta PDF bez avota nosaukuma", () => {
    const title = checkcarPhotoGroupTitle("Autobid auction lot 123 · 14/03/2025 · 187 300 km");
    expect(title).toBe("CheckCar.vin · Autobid · 14.03.2025");
    expect(checkcarPdfGroupTitle(title)).toBe("Autobid · 14.03.2025");
    expect(checkcarPhotoGroupTitle("", "26.11.2026")).toBe("CheckCar.vin · 26.11.2026");
    expect(checkcarPdfGroupTitle("TheCarApi · Autobid")).toBe("TheCarApi · Autobid");
  });

  it("grupas ar vienādu izsoli un datumu apvieno, dublētus URL izmet, ne-https izmet", () => {
    const r = parseCheckcarImport({
      vin: VIN,
      text: REPORT_TEXT,
      groups: [
        { label: "Autobid 14/03/2025", urls: ["https://img.example/1.jpg", "http://img.example/x.jpg"] },
        { label: "AUTOBID sale 14.03.2025", urls: ["https://img.example/2.jpg", "https://img.example/1.jpg"] },
        { label: "Autobid 02/02/2021", urls: ["https://img.example/3.jpg"] },
        { label: "bez foto", urls: [] },
      ],
    });
    expect(r.groups).toEqual([
      { title: "CheckCar.vin · Autobid · 14.03.2025", urls: ["https://img.example/1.jpg", "https://img.example/2.jpg"] },
      { title: "CheckCar.vin · Autobid · 02.02.2021", urls: ["https://img.example/3.jpg"] },
    ]);
  });

  it("piesaista augšupielādētos foto grupām, atkārtotu URL neliek otrreiz", () => {
    const first = attachCheckcarPhotos(emptyCcVinBlock(), [
      { id: "ih_ph_000000000000000000000001", title: "CheckCar.vin · Autobid · 14.03.2025", sourceUrl: "https://img.example/1.jpg" },
      { id: "ih_ph_000000000000000000000002", title: "CheckCar.vin · Autobid · 14.03.2025", sourceUrl: "https://img.example/2.jpg" },
    ]);
    expect(first.added).toBe(2);
    expect(first.block.photoGroups.map((g) => [g.title, g.photos.length])).toEqual([
      ["CheckCar.vin · Autobid · 14.03.2025", 2],
    ]);
    expect(first.block.photos).toHaveLength(2);
    const again = attachCheckcarPhotos(first.block, [
      { id: "ih_ph_000000000000000000000003", title: "CheckCar.vin · Autobid · 14.03.2025", sourceUrl: "https://img.example/1.jpg" },
      { id: "ih_ph_000000000000000000000004", title: "CheckCar.vin · Autobid · 02.02.2021", sourceUrl: "https://img.example/3.jpg" },
    ]);
    expect(again.added).toBe(1);
    expect(again.block.photoGroups.map((g) => [g.title, g.photos.length])).toEqual([
      ["CheckCar.vin · Autobid · 14.03.2025", 2],
      ["CheckCar.vin · Autobid · 02.02.2021", 1],
    ]);
    expect(knownCcVinSourceUrls(again.block)).toEqual([
      "https://img.example/1.jpg",
      "https://img.example/2.jpg",
      "https://img.example/3.jpg",
    ]);
  });
});

describe("bloka ierakstīšana", () => {
  it("RAW teksts paliek admin laukā; atkārtots imports aizstāj tikai savu sadaļu", () => {
    const once = mergeCheckcarRaw("operatora piezīme", "pirmais", "26.11.2026");
    expect(once.startsWith(CHECKCAR_RAW_MARKER)).toBe(true);
    expect(once).toContain("operatora piezīme");
    const twice = mergeCheckcarRaw(once, "otrais", "27.11.2026");
    expect(twice).toContain("otrais");
    expect(twice).not.toContain("pirmais");
    expect(twice).toContain("operatora piezīme");
    expect(twice.split(CHECKCAR_RAW_MARKER)).toHaveLength(2);
  });

  it("operatora rindas paliek, atkārtots imports rindas nedublē", () => {
    const imported = parseCheckcarImport({ vin: VIN, text: REPORT_TEXT });
    const prev = {
      ...emptyCcVinBlock(),
      sales: [{ date: "01.01.2018", venue: "Operatora rinda", odometer: "50 000", price: "", status: "" }],
    };
    const once = applyCheckcarImportToBlock(prev, imported, "27.11.2026");
    const twice = applyCheckcarImportToBlock(once, imported, "27.11.2026");
    expect(twice.sales.map((s) => s.venue)).toEqual(["AUTOBID", "AUTOBID", "Operatora rinda"]);
    expect(twice.rawUnprocessedData).toContain("SOLD #1");
  });
});
