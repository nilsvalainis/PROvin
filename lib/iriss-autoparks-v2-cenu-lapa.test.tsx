import { describe, expect, it } from "vitest";
import { normalizeAutoparksCar } from "@/lib/iriss-autoparks";
import { autoparksV2Basics, emptyCarV2, normalizeV2PriceSheetSafety } from "@/lib/iriss-autoparks-v2";
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
    // Nils 28.10: drošības tabula vienmēr, pēc noklusējuma viss "Ir" un "Pārbaudīts"; spilveni pēdējie.
    expect(s.safetyRows.map((r) => r.label)).toEqual([
      "Elektroniskā stabilitātes sistēma (ESP)",
      "Elektriskais stūres pastiprinātājs (EPS)",
      "Bremžu antibloķēšanas sistēma (ABS)",
      "Drošības spilveni",
    ]);
    expect(s.safetyRows[2]).toEqual({ label: "Bremžu antibloķēšanas sistēma (ABS)", present: "Ir", checked: "Pārbaudīts" });
    expect(s.roadworthy).toBe(true);
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
    expect(text).toContain("Transportlīdzeklis tehniski atbilst izmantošanai ceļu satiksmē!");
    expect(text).not.toContain("cena ar PVN");
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

  it("bez CSDD datiem tabula un apliecinājums ir lapā pēc noklusējuma", () => {
    const v2 = emptyCarV2();
    const text = renderText(<A4Sheet s={autoparksV2PriceSheet(car, v2, autoparksV2Basics(car, v2))} />);
    expect(text).toContain("Drošības spilveni");
    expect(text).toContain("Pārbaudīts");
    expect(text).toContain("Transportlīdzeklis tehniski atbilst izmantošanai ceļu satiksmē!");
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
