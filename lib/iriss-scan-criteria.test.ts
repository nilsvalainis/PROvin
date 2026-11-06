import { describe, expect, it } from "vitest";
import { irissListingDetailsLabel, IRISS_LISTING_CARD_ACTION_ORDER, IRISS_LISTING_CARD_ACTION_RADAR_DETAILS } from "@/lib/iriss-listing-card-actions";
import {
  irissScanCriteriaForm,
  irissScanCriteriaIsStored,
  irissScanStoredSearchFields,
  parseIrissScanCriteriaNumber,
  parseIrissScanTitle,
  patchIrissScanCriteria,
  readIrissScanCriteria,
  sanitizeIrissScanCriteria,
} from "@/lib/iriss-scan-criteria";
import { irissScanOrderBrief } from "@/lib/iriss-scan-order-brief";
import { applyGeneratedScanSourceFilter, scanOrderSearchFields } from "@/lib/iriss-scan-platform-search";
import { mergeIrissScanRecords, prepareIrissScanWrite } from "@/lib/iriss-scan-save-safety";
import { emptyIrissScanRecord, type IrissScanRecord } from "@/lib/iriss-scan-types";
import { irissScanHasOperatorContent } from "@/lib/iriss-scan-vin";

const ID = "11111111-1111-4111-8111-111111111111";
const AT = "2026-11-07T10:00:00.000Z";
const NILS_TITLE = "Audi 2.0D manuālis 2009-2015, 150-330k, 3000-12000 EUR";

function scan(over: Partial<IrissScanRecord> = {}): IrissScanRecord {
  return { ...emptyIrissScanRecord(ID, AT), ...over };
}

describe("Radara kritēriji: migrācija no nosaukuma (vecie ieraksti)", () => {
  it("Nila piemērs: nosaukumā ierakstītie kritēriji kļūst par laukiem", () => {
    const f = readIrissScanCriteria(scan({ brandModel: NILS_TITLE })).filters[0]!;
    expect(f.make.value).toEqual(["Audi"]);
    expect([f.yearFrom.value, f.yearTo.value]).toEqual([2009, 2015]);
    expect([f.mileageFrom.value, f.mileageTo.value]).toEqual([150000, 330000]);
    expect([f.budgetFrom.value, f.budgetTo.value]).toEqual([3000, 12000]);
    expect(f.fuel.value).toEqual([{ group: "diesel" }]);
    expect(f.gearbox.value).toEqual([{ group: "manual" }]);
    expect(f.ccFrom.value).toBe(2000);
    expect(f.make.source).toBe("migrated");
  });

  it("lasīšana ieraksta nemaina un nepievieno criteria", () => {
    const rec = scan({ brandModel: NILS_TITLE, productionYears: "" });
    const before = JSON.stringify(rec);
    readIrissScanCriteria(rec);
    irissScanCriteriaForm(rec);
    irissScanOrderBrief(rec);
    expect(JSON.stringify(rec)).toBe(before);
    expect("criteria" in rec).toBe(false);
    expect(irissScanCriteriaIsStored(rec)).toBe(false);
  });

  it("aizpildīts teksta lauks uzvar nosaukumu", () => {
    const f = readIrissScanCriteria(scan({ brandModel: "Audi A6 2009-2015 automāts", productionYears: "2017-2019", transmission: "manuāla" })).filters[0]!;
    expect([f.yearFrom.value, f.yearTo.value]).toEqual([2017, 2019]);
    expect(f.gearbox.value).toEqual([{ group: "manual" }]);
  });

  it("nosaukums bez kritērijiem paliek marka/modelis; nekas netiek uzminēts", () => {
    expect(parseIrissScanTitle("LEXUS/TOYOTA")).toMatchObject({ brandModel: "LEXUS/TOYOTA", productionYears: "", totalBudget: "", maxMileage: "" });
    const f = readIrissScanCriteria(scan({ brandModel: "LEXUS/TOYOTA" })).filters[0]!;
    expect(f.make.value).toEqual(["Lexus", "Toyota"]);
    expect(f.budgetTo.value).toBeNull();
    expect(f.yearFrom.value).toBeNull();
  });

  it("dažādi pieraksti: '2016+', 'līdz 200 000 km', 'līdz 9000 €', kW diapazons", () => {
    const a = parseIrissScanTitle("VW Golf 1.6 TDI 2016+ līdz 200 000 km līdz 9000 €");
    expect(a).toMatchObject({ brandModel: "VW Golf", productionYears: "2016+", maxMileage: "200000", totalBudget: "9000" });
    const b = parseIrissScanTitle("BMW X5 automāts 2018-2021 110-180 kW");
    expect(b).toMatchObject({ productionYears: "2018-2021", transmission: "automāts", powerKw: "110-180" });
    // kW nav nobraukums.
    expect(b.maxMileage).toBe("");
  });
});

describe("Radara kritēriji: saglabāšana reālos laukos", () => {
  it("operatora labojums saglabā criteria (avots form), nosaukums un teksta lauki paliek", () => {
    const rec = scan({ brandModel: NILS_TITLE });
    const next = patchIrissScanCriteria(rec, "budgetTo", "15000");
    expect(irissScanCriteriaIsStored(next)).toBe(true);
    const f = next.criteria!.filters[0]!;
    expect(f.budgetTo).toEqual({ value: 15000, manual: "", source: "form" });
    // Pārējie nolasītie lauki tiek fiksēti tādi, kā operators tos redzēja formā.
    expect([f.yearFrom.value, f.yearTo.value]).toEqual([2009, 2015]);
    expect(f.useForm).toBe(true);
    expect(next.brandModel).toBe(NILS_TITLE);
    expect(rec.criteria).toBeUndefined();
  });

  it("saglabātie kritēriji uzvar nosaukumu arī pēc nosaukuma maiņas", () => {
    const saved = patchIrissScanCriteria(scan({ brandModel: NILS_TITLE }), "yearFrom", "2011");
    const renamed = { ...saved, brandModel: "Audi meklējums salonam 2001-2003" };
    const f = readIrissScanCriteria(renamed).filters[0]!;
    expect([f.yearFrom.value, f.yearTo.value]).toEqual([2011, 2015]);
  });

  it("izvēles lauki (degviela, kārba, virsbūve) un notīrīšana", () => {
    let rec = patchIrissScanCriteria(scan({ brandModel: "Skoda Octavia" }), "fuel", ["diesel", "hybrid"]);
    rec = patchIrissScanCriteria(rec, "gearbox", ["automatic"]);
    rec = patchIrissScanCriteria(rec, "bodyTypes", ["wagon"]);
    rec = patchIrissScanCriteria(rec, "make", "Škoda, ");
    const { form, origin } = irissScanCriteriaForm(rec);
    expect(form).toMatchObject({ fuel: ["diesel", "hybrid"], gearbox: ["automatic"], bodyTypes: ["wagon"], make: "Škoda" });
    expect(origin.fuel).toBeUndefined();
    rec = patchIrissScanCriteria(rec, "fuel", []);
    expect(irissScanCriteriaForm(rec).form.fuel).toEqual([]);
  });

  it("forma rāda nolasītos laukus kā 'migrated', bet operatora labotos - ne", () => {
    const rec = scan({ brandModel: NILS_TITLE });
    expect(irissScanCriteriaForm(rec).origin).toMatchObject({ make: "migrated", budgetTo: "migrated" });
    const next = patchIrissScanCriteria(rec, "budgetTo", "14000");
    expect(irissScanCriteriaForm(next).origin.budgetTo).toBeUndefined();
  });

  it("skaitļu validācija: atdalītāji un 'k' der, nederīgs un ārpus robežām -> tukšs", () => {
    expect(parseIrissScanCriteriaNumber("150 000", "mileage")).toBe(150000);
    expect(parseIrissScanCriteriaNumber("12k", "budget")).toBe(12000);
    expect(parseIrissScanCriteriaNumber("12.500 €", "budget")).toBe(12500);
    expect(parseIrissScanCriteriaNumber("20", "year")).toBeNull();
    expect(parseIrissScanCriteriaNumber("abc", "kw")).toBeNull();
    expect(parseIrissScanCriteriaNumber("-5", "budget")).toBeNull();
    expect(patchIrissScanCriteria(scan(), "yearFrom", "1800").criteria!.filters[0]!.yearFrom.value).toBeNull();
  });

  it("serveris pieņem tikai derīgu V1 shēmu; svešie lauki (krāsa) un atkritumi tiek izmesti", () => {
    expect(sanitizeIrissScanCriteria({ version: 2, filters: [] })).toBeUndefined();
    expect(sanitizeIrissScanCriteria("x")).toBeUndefined();
    const saved = patchIrissScanCriteria(scan({ brandModel: NILS_TITLE }), "kwFrom", "100").criteria!;
    const withJunk = { ...saved, filters: [{ ...saved.filters[0]!, color: "melna" }] };
    const clean = sanitizeIrissScanCriteria(withJunk)!;
    expect(clean.filters[0]!.kwFrom.value).toBe(100);
    expect(JSON.stringify(clean)).not.toContain("melna");
  });

  it("rakstīšana bez criteria (cits rakstītājs) neizdzēš saglabātos kritērijus; 409 apvienošana tos patur", () => {
    const existing = patchIrissScanCriteria(scan({ brandModel: "Audi", workspaceRevision: 3 }), "budgetTo", "9000");
    const incoming = scan({ brandModel: "Audi A4" });
    const res = prepareIrissScanWrite(existing, incoming, 3, AT);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.record.criteria?.filters[0]?.budgetTo.value).toBe(9000);
    const merged = mergeIrissScanRecords(existing, scan({ brandModel: "Audi A4" }));
    expect(merged.criteria?.filters[0]?.budgetTo.value).toBe(9000);
  });

  it("jaunu radaru ar tikai kritērijiem (bez nosaukuma) drīkst saglabāt", () => {
    expect(irissScanHasOperatorContent(scan())).toBe(false);
    expect(irissScanHasOperatorContent(patchIrissScanCriteria(scan(), "make", "Volvo"))).toBe(true);
  });
});

describe("Radara kritēriji meklēšanā un kartītē", () => {
  it("vecs ieraksts: meklēšanas lauki kā līdz šim (nav saglabātu kritēriju)", () => {
    const rec = scan({ brandModel: "Volvo V60", productionYears: "2019-2021" });
    expect(irissScanStoredSearchFields(rec)).toBeNull();
    expect(scanOrderSearchFields(rec).productionYears).toBe("2019-2021");
  });

  it("saglabātie kritēriji nonāk izsoles meklēšanas saitē (gadi, cena, nobraukums, jauda)", () => {
    let rec = patchIrissScanCriteria(scan({ brandModel: "Volvo V60" }), "make", "Volvo");
    rec = patchIrissScanCriteria(rec, "models", "V60");
    rec = patchIrissScanCriteria(rec, "yearFrom", "2019");
    rec = patchIrissScanCriteria(rec, "yearTo", "2021");
    rec = patchIrissScanCriteria(rec, "mileageTo", "150000");
    rec = patchIrissScanCriteria(rec, "budgetTo", "20000");
    rec = patchIrissScanCriteria(rec, "kwFrom", "110");
    const fields = scanOrderSearchFields(rec);
    expect(fields).toMatchObject({ brandModel: "Volvo V60", productionYears: "2019-2021", maxMileage: "150000", totalBudget: "20000" });
    const out = applyGeneratedScanSourceFilter(rec, "auto1");
    expect(out.url).toContain("manufacturer=VOLVO");
    expect(out.url).toContain("firstRegistrationFrom=2019");
    expect(out.url).toContain("firstRegistrationTo=2021");
    expect(out.url).toContain("powerFrom=110");
    expect(out.url).toMatch(/maxPrice=\d+/);
    expect(out.record.listingLinkAuto1.filter(Boolean)).toContain(out.url);
  });

  it("radara kartīte saņem kritērijus ✓/✕ salīdzinājumam un budžetam (arī no veca nosaukuma)", () => {
    const brief = irissScanOrderBrief(scan({ brandModel: NILS_TITLE }));
    expect(brief.productionYears).toBe("2009-2015");
    expect(brief.budget).toBe(12000);
    expect(brief.criteria).toMatchObject({ productionYears: "2009-2015", maxMileage: "330000", totalBudget: "12000", transmission: "Manuāla", engineType: "Dīzelis" });
  });

  it("detaļu poga: radaram 'Radara detaļas', pasūtījumam - 'Pasūtījuma detaļas'", () => {
    expect(irissListingDetailsLabel(["scan:abc"])).toBe(IRISS_LISTING_CARD_ACTION_RADAR_DETAILS);
    expect(irissListingDetailsLabel(["scan:abc", "order-1"])).toBe(IRISS_LISTING_CARD_ACTION_ORDER);
    expect(irissListingDetailsLabel([])).toBe(IRISS_LISTING_CARD_ACTION_ORDER);
  });
});
