import { describe, expect, it } from "vitest";
import { normalizeAutoparksCar } from "@/lib/iriss-autoparks";
import { autoparksV2Basics, emptyCarV2, normalizeCarV2, normalizeV2PriceSheetSafety } from "@/lib/iriss-autoparks-v2";
import { autoparksV2PriceSheet, engineLabel, priceSheetHighlights, priceSheetHighlightsLine, priceSheetTitlePx } from "@/lib/iriss-autoparks-v2-cenu-lapa";
import { renderText } from "@/lib/test-render";
import { A4Sheet } from "@/components/admin/iriss-autoparks-v2/A4Sheet";

describe("Cenu lapa L7 (Nils 27.10)", () => {
  const car = normalizeAutoparksCar({
    id: "q",
    make: "Audi",
    model: "SQ5",
    vin: "WAUZZZ8R7EA126875",
    displayName: "AUDI SQ5 EXCLUSIVE",
    equipmentLine: "ACC DISTRONIC / LANE ASSIST · QUATTRO",
    listPriceEur: 17900,
    registry: {
      makeModel: "AUDI SQ5",
      fuel: "Dīzeļdegviela",
      seats: 5,
      grossMassKg: 2530,
      tradeActNo: "GDZ00218",
      airbags: "yes_checked",
      esp: "yes_checked",
      eps: "",
      abs: "yes",
      importedAt: "x",
    },
  })!;

  it("tukšās rindas nerāda; saīsinātie nosaukumi; spilveni pēdējie", () => {
    const v2 = emptyCarV2();
    const s = autoparksV2PriceSheet(car, v2, autoparksV2Basics(car, v2));
    const labels = s.rows.map((r) => r.label);
    expect(labels).toContain("Akta numurs");
    expect(labels).not.toContain("Izmešu daudzums (CO2)");
    expect(labels).not.toContain("Transportlīdzekļa veids");
    expect(s.rows.find((r) => r.label === "Pilna masa")?.value).toBe("2 530 kg");
    // Nils 28.10: drošības tabula vienmēr; spilveni pēdējie. Nils 20.11: bez saglabātas izvēles - "Nav pārbaudīts", bez apliecinājuma.
    expect(s.safetyRows.map((r) => r.label)).toEqual([
      "Elektroniskā stabilitātes sistēma (ESP)",
      "Elektriskais stūres pastiprinātājs (EPS)",
      "Bremžu antibloķēšanas sistēma (ABS)",
      "Drošības spilveni",
    ]);
    expect(s.safetyRows[2]).toEqual({ label: "Bremžu antibloķēšanas sistēma (ABS)", present: "Ir", checked: "Nav pārbaudīts" });
    expect(s.roadworthy).toBe(false);
    expect(s.state).toBe("normal");
    expect(s.highlights).toEqual(["ACC DISTRONIC", "LANE ASSIST", "QUATTRO"]);
    expect(s.priceEur).toBe(17900);
  });

  it("«cena ar PVN» tikai PVN režīmā, margin - nē", () => {
    const v2 = emptyCarV2();
    expect(autoparksV2PriceSheet(car, v2, autoparksV2Basics(car, v2)).vatNote).toBe("");
    v2.purchase.vat.mode = "gross";
    expect(autoparksV2PriceSheet(car, v2, autoparksV2Basics(car, v2)).vatNote).toBe("cena ar PVN");
    v2.purchase.vat.mode = "margin";
    expect(autoparksV2PriceSheet(car, v2, autoparksV2Basics(car, v2)).vatNote).toBe("");
  });

  it("garš nosaukums - mazāks burts, īss - 50 px", () => {
    expect(priceSheetTitlePx("AUDI SQ5 EXCLUSIVE")).toBe(50);
    const long = priceSheetTitlePx("MERCEDES-BENZ E 220 CDI ELEGANCE");
    expect(long).toBeLessThan(50);
    expect(long * 0.72 * 32).toBeLessThanOrEqual(650);
  });

  it("aprīkojums līdz 8, bez dublikātiem", () => {
    expect(priceSheetHighlights("A / B / A / C / D / E / F / G / H / I")).toEqual(["A", "B", "C", "D", "E", "F", "G", "H"]);
    expect(priceSheetHighlightsLine(["X", " Y ", ""])).toBe("X / Y");
  });

  it("A4 lapā cena, dati un kontakti; bez «-» tukšajām rindām", () => {
    const v2 = emptyCarV2();
    const text = renderText(<A4Sheet s={autoparksV2PriceSheet(car, v2, autoparksV2Basics(car, v2))} />);
    expect(text).toContain("AUDI SQ5 EXCLUSIVE");
    expect(text).toContain("17 900 €");
    expect(text).toContain("GDZ00218");
    expect(text).toContain("+371 277 33 440");
    expect(text).not.toContain("DRĪZUMĀ");
    expect(text).not.toContain("tehniski atbilst");
    expect(text).not.toContain("cena ar PVN");
  });
});

describe("Cenu lapa «Drīzumā» (Nils 20.11, variants A)", () => {
  const notAccepted = normalizeAutoparksCar({ id: "t", make: "Volkswagen", model: "Touran", vin: "WVGZZZ1TZHW012345", listPriceEur: 13990 })!;
  const accepted = normalizeAutoparksCar({
    id: "u",
    make: "Volkswagen",
    model: "Touran",
    vin: "WVGZZZ1TZHW012345",
    listPriceEur: 13990,
    registry: { tradeActDate: "2026-11-10", importedAt: "x" },
  })!;
  const sheet = (car: typeof notAccepted, v2 = emptyCarV2()) => autoparksV2PriceSheet(car, v2, autoparksV2Basics(car, v2));

  it("noklusējums: nav pieņemts tirdzniecībā -> Drīzumā; pieņemts -> parastā lapa", () => {
    expect(sheet(notAccepted).state).toBe("soon");
    expect(sheet(notAccepted).stateAuto).toBe("soon");
    expect(sheet(notAccepted).stateMode).toBeNull();
    expect(sheet(accepted).state).toBe("normal");
  });

  it("A: DRĪZUMĀ cenas vietā + plānotā cena; bez akta numura rindas", () => {
    const v2 = emptyCarV2();
    v2.purchase.vat.mode = "gross";
    const s = sheet(notAccepted, v2);
    const text = renderText(<A4Sheet s={s} />);
    expect(text).toContain("DRĪZUMĀ");
    expect(text).toContain("auto tiek sagatavots pārdošanai");
    expect(text).toContain("Plānotā cena");
    expect(text).toContain("13 990 €");
    expect(text).toContain("cena ar PVN");
    expect(s.rows.map((r) => r.label)).not.toContain("Akta numurs");
  });

  it("D: «Rādīt plānoto cenu» izslēgts - bez cenas", () => {
    const v2 = emptyCarV2();
    v2.priceSheet.showPlannedPrice = false;
    const text = renderText(<A4Sheet s={sheet(notAccepted, v2)} />);
    expect(text).toContain("DRĪZUMĀ");
    expect(text).not.toContain("Plānotā cena");
    expect(text).not.toContain("13 990");
  });

  it("manuāli: ieslēgt pieņemtam, izslēgt nepieņemtam", () => {
    const on = emptyCarV2();
    on.priceSheet.sheetState = "soon";
    expect(sheet(accepted, on).state).toBe("soon");
    const off = emptyCarV2();
    off.priceSheet.sheetState = "normal";
    const s = sheet(notAccepted, off);
    expect(s.state).toBe("normal");
    expect(renderText(<A4Sheet s={s} />)).toContain("13 990 €");
  });

  it("Drīzumā drošība rediģējama: pārbaudīts + apliecinājums paliek, ja Nils tā izvēlas", () => {
    const v2 = emptyCarV2();
    v2.priceSheet.safety = normalizeV2PriceSheetSafety({ items: { abs: { present: true, checked: false } }, roadworthy: true })!;
    const s = sheet(notAccepted, v2);
    expect(s.safetyRows[0]!.checked).toBe("Pārbaudīts");
    expect(s.safetyRows[2]!.checked).toBe("Gaida pārbaudi");
    const text = renderText(<A4Sheet s={s} />);
    expect(text).toContain("tehniski atbilst");
    expect(text).not.toContain("tiks veikta pirms pārdošanas");
  });

  it("normalizācija: sheetState tikai zināmās vērtības, showPlannedPrice tikai boolean", () => {
    const n = normalizeCarV2({ priceSheet: { sheetState: "x", showPlannedPrice: false } });
    expect(n.priceSheet.sheetState).toBeNull();
    expect(n.priceSheet.showPlannedPrice).toBe(false);
    expect(normalizeCarV2({ priceSheet: { sheetState: "reserved" } }).priceSheet.sheetState).toBe("reserved");
  });

  it("Rezervēts: statuss «Rezervēts» uzvar pār Drīzumā; REZERVĒTS + «Cena»; drošība pēc faktiskā stāvokļa", () => {
    const resNot = normalizeAutoparksCar({ ...notAccepted, status: "reserved" })!;
    const resAcc = normalizeAutoparksCar({ ...accepted, status: "reserved" })!;
    const a = sheet(resNot);
    expect(a.state).toBe("reserved");
    const ta = renderText(<A4Sheet s={a} />);
    expect(ta).toContain("REZERVĒTS");
    expect(ta).toContain("auto ir rezervēts");
    expect(ta).toContain("Cena");
    expect(ta).not.toContain("Plānotā cena");
    expect(ta).toContain("13 990 €");
    expect(ta).toContain("Gaida pārbaudi");
    expect(ta).toContain("tiks veikta pirms pārdošanas");
    // Pieņemts tirdzniecībā: drošība kā parastā lapā.
    const v2 = emptyCarV2();
    v2.priceSheet.safety = normalizeV2PriceSheetSafety({ items: {} })!;
    const tb = renderText(<A4Sheet s={sheet(resAcc, v2)} />);
    expect(tb).toContain("REZERVĒTS");
    expect(tb).toContain("Pārbaudīts");
    expect(tb).toContain("tehniski atbilst");
    expect(sheet(resAcc).safetyRows[0]!.checked).toBe("Nav pārbaudīts");
    // Bez cenas.
    const nop = emptyCarV2();
    nop.priceSheet.showPlannedPrice = false;
    expect(renderText(<A4Sheet s={sheet(resNot, nop)} />)).not.toContain("13 990");
    // Manuāli parastā lapa arī rezervētam.
    const man = emptyCarV2();
    man.priceSheet.sheetState = "normal";
    expect(sheet(resNot, man).state).toBe("normal");
  });
});

describe("Cenu lapa", () => {
  const car = normalizeAutoparksCar({
    id: "a",
    make: "Audi",
    model: "A6 Avant",
    year: "2018",
    displayName: "AUDI A6 AVANT 40 TDI",
    equipmentLine: "MATRIX LED / ACC",
    salePriceEur: 18900,
    purchasePriceEur: 9850,
    registry: { odometerKm: 162400, gearbox: "Automāts", airbags: "yes", esp: "yes_checked", abs: "yes", importedAt: "x" },
  })!;

  it("nav iepirkuma cenas un pašizmaksas; v1 vērtības, ja v2 nav labots", () => {
    const v2 = emptyCarV2();
    const s = autoparksV2PriceSheet(car, v2, autoparksV2Basics(car, v2));
    expect(s).toMatchObject({ displayName: "AUDI A6 AVANT 40 TDI", salePriceEur: 18900, listPriceEur: 18900, gearbox: "Automāts", safety: "Ir" });
    expect(s.mileage).toEqual({ value: "162 400 km", csdd: true });
    expect(JSON.stringify(s)).not.toContain("9850");
  });

  it("v2 labojums uzvar, v1 paliek", () => {
    const v2 = emptyCarV2();
    v2.priceSheet.listPriceEur = 18500;
    const s = autoparksV2PriceSheet(car, v2, autoparksV2Basics(car, v2));
    expect(s.listPriceEur).toBe(18500);
    expect(car.listPriceEur).toBeUndefined();
  });

  it("motors", () => {
    expect(engineLabel(1968, 150)).toBe("2.0 · 150 kW");
    expect(engineLabel(null, 110)).toBe("110 kW");
  });

  it("J30: īpašnieks rādās cenu lapā", () => {
    const v2 = emptyCarV2();
    const s = autoparksV2PriceSheet(car, v2, autoparksV2Basics(car, v2));
    expect(s.owner).toBe("IRISS");
    expect(s.ownerLabel).toBeTruthy();
  });

  it("J30: ar roku ievadīts dzinējs cenu lapā uzvar pār aprēķināto no tilpuma+jaudas", () => {
    const v2 = emptyCarV2();
    v2.tech.displacementCm3 = 1968;
    v2.tech.powerKw = 150;
    const noManual = autoparksV2PriceSheet(car, v2, autoparksV2Basics(car, v2));
    expect(noManual.engine).toEqual({ value: "2.0 · 150 kW", csdd: false });

    v2.tech.engine = "2.0 TDI hibrīds";
    const withManual = autoparksV2PriceSheet(car, v2, autoparksV2Basics(car, v2));
    expect(withManual.engine).toEqual({ value: "2.0 TDI hibrīds", csdd: false });
  });

  it("J30: pārnesumkārba ar roku ievadīta cenu lapā uzvar pār registry.gearbox", () => {
    const v2 = emptyCarV2();
    v2.tech.gearbox = "Manuālā";
    const s = autoparksV2PriceSheet(car, v2, autoparksV2Basics(car, v2));
    expect(s.gearbox).toBe("Manuālā");
  });
});

describe("Cenu lapa - drošības tabula (Nils 28.10)", () => {
  const car = normalizeAutoparksCar({ id: "s80", make: "Volvo", model: "S80", vin: "YV1AS475BC1162162" })!;

  it("bez CSDD akta un saglabātas izvēles: Drīzumā, «Gaida pārbaudi», bez apliecinājuma (Nils 20.11)", () => {
    const v2 = emptyCarV2();
    const text = renderText(<A4Sheet s={autoparksV2PriceSheet(car, v2, autoparksV2Basics(car, v2))} />);
    expect(text).toContain("Drošības spilveni");
    expect(text).toContain("Gaida pārbaudi");
    expect(text).not.toContain("Pārbaudīts");
    expect(text).not.toContain("tehniski atbilst");
    expect(text).toContain("Drošības sistēmu pārbaude tiks veikta pirms pārdošanas.");
  });

  it("saglabātā vecā izvēle (viss pārbaudīts) paliek nemainīta", () => {
    const v2 = emptyCarV2();
    v2.priceSheet.safety = normalizeV2PriceSheetSafety({ items: {} })!;
    v2.priceSheet.sheetState = "normal";
    const s = autoparksV2PriceSheet(car, v2, autoparksV2Basics(car, v2));
    expect(s.safetyRows[0]!.checked).toBe("Pārbaudīts");
    expect(renderText(<A4Sheet s={s} />)).toContain("Transportlīdzeklis tehniski atbilst izmantošanai ceļu satiksmē!");
  });

  it("saglabātā izvēle uzvar: Nav un bez apliecinājuma", () => {
    const v2 = emptyCarV2();
    const safety = normalizeV2PriceSheetSafety({ items: { eps: { present: false, checked: true } }, roadworthy: false })!;
    v2.priceSheet.safety = safety;
    const s = autoparksV2PriceSheet(car, v2, autoparksV2Basics(car, v2));
    expect(s.safetyRows[1]).toEqual({ label: "Elektriskais stūres pastiprinātājs (EPS)", present: "Nav", checked: "" });
    expect(renderText(<A4Sheet s={s} />)).not.toContain("tehniski atbilst");
  });
});
