import { describe, expect, it } from "vitest";
import {
  applyIrissScanMakeModelEdit,
  applyIrissScanNameSuggestion,
  applyIrissScanRangeEdit,
  applyIrissScanSpecTextEdit,
  irissScanCriteriaBounds,
  irissScanCriteriaView,
  irissScanHasStructuredCriteria,
  suggestIrissScanCriteriaFromName,
} from "@/lib/iriss-scan-criteria";
import { irissScanOrderBrief } from "@/lib/iriss-scan-listings";
import { keepStoredIrissScanCriteria, mergeIrissScanRecords } from "@/lib/iriss-scan-save-safety";
import { applyGeneratedScanSourceFilter } from "@/lib/iriss-scan-platform-search";
import { emptyIrissScanRecord, type IrissScanRecord } from "@/lib/iriss-scan-types";
import { marketplaceQueryFromScan } from "@/lib/marketplace/query-from-scan";

function scan(patch: Partial<IrissScanRecord> = {}): IrissScanRecord {
  return { ...emptyIrissScanRecord("s1", "2026-11-07T00:00:00.000Z"), ...patch };
}

const AUDIT_NAME = "Audi 2.0D manuālis 2009-2015, 150-330k, 3000-12000 EUR";

describe("suggestIrissScanCriteriaFromName", () => {
  it("parsē audita piemēru: marka, gadi, km, cena, dīzelis, manuāla, tilpums", () => {
    const s = suggestIrissScanCriteriaFromName(AUDIT_NAME)!;
    expect(s.make).toEqual(["Audi"]);
    expect(s.yearFrom).toBe(2009);
    expect(s.yearTo).toBe(2015);
    expect(s.mileageFrom).toBe(150_000);
    expect(s.mileageTo).toBe(330_000);
    expect(s.priceFrom).toBe(3000);
    expect(s.priceTo).toBe(12_000);
    expect(s.fuel).toEqual(["Dīzelis"]);
    expect(s.gearbox).toEqual(["Manuāla"]);
    expect(s.ccFrom).toBe(1950);
    expect(s.ccTo).toBe(2050);
    expect(s.summary.join(" | ")).toContain("Cena: 3 000-12 000 €");
  });

  it("jauda, līdz cena un modelis", () => {
    const s = suggestIrissScanCriteriaFromName("BMW X5 automāts no 2016, 150-220 kW, līdz 25 000 €")!;
    expect(s.make).toEqual(["BMW"]);
    expect(s.models.join(" ")).toMatch(/X5/);
    expect(s.yearFrom).toBe(2016);
    expect(s.yearTo).toBeNull();
    expect(s.kwFrom).toBe(150);
    expect(s.kwTo).toBe(220);
    expect(s.priceFrom).toBeNull();
    expect(s.priceTo).toBe(25_000);
    expect(s.gearbox).toEqual(["Automāts"]);
  });

  it("tikai marka/modelis - nav ieteikuma", () => {
    expect(suggestIrissScanCriteriaFromName("Toyota RAV4")).toBeNull();
    expect(suggestIrissScanCriteriaFromName("")).toBeNull();
  });
});

describe("Radara kritēriji ierakstā", () => {
  it("vecs Radars bez criteria: nav strukturēts, skats tukšs, vaicājums kā agrāk", () => {
    const rec = scan({ brandModel: "Audi A4", productionYears: "2015-2018" });
    expect(irissScanHasStructuredCriteria(rec)).toBe(false);
    expect(irissScanCriteriaView(rec).yearFrom).toBe("");
    const q = marketplaceQueryFromScan(rec);
    expect(q.make).toBe("Audi");
    expect(q.yearFrom).toBe(2015);
    expect(q.priceTo).toBeNull();
  });

  it("ieteikums ierakstā nonāk tikai pēc apply; nosaukums nemainās", () => {
    const rec = scan({ brandModel: AUDIT_NAME });
    const s = suggestIrissScanCriteriaFromName(rec.brandModel)!;
    expect(rec.criteria).toBeUndefined();
    const next = applyIrissScanNameSuggestion(rec, s);
    expect(next.brandModel).toBe(AUDIT_NAME);
    expect(irissScanHasStructuredCriteria(next)).toBe(true);
    expect(next.engineType).toBe("Dīzelis");
    expect(next.transmission).toBe("Manuāla");
    expect(next.productionYears).toBe("2009-2015");
    const view = irissScanCriteriaView(next);
    expect(view.make).toBe("Audi");
    expect(view.mileageTo).toBe("330000");
    expect(view.priceTo).toBe("12000");
  });

  it("tirgus vaicājums: cena = sludinājuma cena (bez -2000), km, jauda no shēmas, marka bez trokšņa", () => {
    const rec = applyIrissScanNameSuggestion(scan({ brandModel: AUDIT_NAME }), suggestIrissScanCriteriaFromName(AUDIT_NAME)!);
    const q = marketplaceQueryFromScan(rec);
    expect(q.make).toBe("Audi");
    expect(q.priceFrom).toBe(3000);
    expect(q.priceTo).toBe(12_000);
    expect(q.mileageTo).toBe(330_000);
    expect(q.yearFrom).toBe(2009);
    expect(q.yearTo).toBe(2015);
    expect(q.fuel).toBe("diesel");
    expect(q.gearbox).toBe("manual");
  });

  it("diapazona lauki: kW no-līdz paliek diapazons arī izsoles saitē", () => {
    let rec = scan({ brandModel: "Audi A6" });
    rec = applyIrissScanMakeModelEdit(rec, "make", "Audi");
    rec = applyIrissScanMakeModelEdit(rec, "models", "A6");
    rec = applyIrissScanRangeEdit(rec, "kwFrom", "140");
    rec = applyIrissScanRangeEdit(rec, "kwTo", "180");
    rec = applyIrissScanRangeEdit(rec, "yearFrom", "2016");
    expect(irissScanCriteriaBounds(rec)).toMatchObject({ kwFrom: 140, kwTo: 180, yearFrom: 2016, make: ["Audi"], models: ["A6"] });
    expect(rec.productionYears).toBe("no 2016");
    const q = marketplaceQueryFromScan(rec);
    expect(q.powerFromKw).toBe(140);
    expect(q.powerToKw).toBe(180);
    const gen = applyGeneratedScanSourceFilter(rec, "ecarstrade");
    expect(gen.url).toBeTruthy();
    const url = new URL(gen.url!);
    const qs = url.search;
    expect(qs).toContain("140");
    expect(qs).toContain("180");
  });

  it("nederīgs teksts paliek redzams laukā, nevis pazūd", () => {
    const rec = applyIrissScanRangeEdit(scan({ brandModel: "Audi" }), "yearFrom", "ap 2015");
    expect(irissScanCriteriaView(rec).yearFrom).toBe("ap 2015");
    expect(irissScanCriteriaBounds(rec)?.yearFrom ?? null).toBeNull();
  });

  it("čipi: degvielas teksts sinhronizē shēmu", () => {
    const rec = applyIrissScanSpecTextEdit(scan({ brandModel: "VW Passat" }), "engineType", "Dīzelis, Benzīns");
    const q = marketplaceQueryFromScan({ ...applyIrissScanMakeModelEdit(rec, "make", "Volkswagen") });
    expect(q.fuel.split(", ").sort()).toEqual(["diesel", "petrol"]);
  });

  it("kartītes ✓/✕: Radaram ar shēmu ir kritēriji, vecam nav", () => {
    expect(irissScanOrderBrief(scan({ brandModel: "Audi" })).criteria).toBeUndefined();
    const rec = applyIrissScanNameSuggestion(scan({ brandModel: AUDIT_NAME }), suggestIrissScanCriteriaFromName(AUDIT_NAME)!);
    const brief = irissScanOrderBrief(rec);
    expect(brief.criteria).toMatchObject({ productionYears: "2009-2015", maxMileage: "330000", transmission: "Manuāla", totalBudget: "" });
  });
});

describe("saglabāšanas drošība", () => {
  const stored = applyIrissScanRangeEdit(scan({ brandModel: "Audi" }), "yearFrom", "2015");

  it("ieraksts bez criteria (vecs klients) saglabātos kritērijus nedzēš", () => {
    const incoming = scan({ brandModel: "Audi", vin: "X" });
    expect(keepStoredIrissScanCriteria(stored, incoming).criteria).toEqual(stored.criteria);
  });

  it("atsūtīti criteria (arī notīrīti) paliek operatora", () => {
    const cleared = applyIrissScanRangeEdit(stored, "yearFrom", "");
    expect(keepStoredIrissScanCriteria(stored, cleared).criteria).toEqual(cleared.criteria);
  });

  it("konflikta apvienošana patur lokālos kritērijus", () => {
    const server = scan({ brandModel: "Audi" });
    expect(mergeIrissScanRecords(server, stored).criteria).toEqual(stored.criteria);
    expect(mergeIrissScanRecords(stored, server).criteria).toEqual(stored.criteria);
  });
});
