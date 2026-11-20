import { describe, expect, it } from "vitest";
import { normalizeAutoparksCar, normalizeAutoparksState, type AutoparksCar } from "@/lib/iriss-autoparks";
import { listAcceptedForTradeVehicles } from "@/lib/iriss-autoparks-accepted";
import { effectiveAutoparksCar, effectiveAutoparksCars, effectiveAutoparksOwner } from "@/lib/iriss-autoparks-effective";
import { parseRegistryFile, REGISTRY_SCHEMA_ID } from "@/lib/iriss-autoparks-registry";
import { applyRegistryFileToState } from "@/lib/iriss-autoparks-registry-apply";
import { autoparksV2Basics, emptyAutoparksV2State, emptyCarV2, type AutoparksCarV2, type AutoparksV2State } from "@/lib/iriss-autoparks-v2";
import { autoparksV2PriceSheet, priceSheetSold } from "@/lib/iriss-autoparks-v2-cenu-lapa";
import { autoparksV2ListRows, filterAutoparksV2Rows } from "@/lib/iriss-autoparks-v2-list";
import { offerSeedFromAutoparks } from "@/lib/iriss-offer-seed";
import { irissPdCarPicks } from "@/lib/iriss-piedavajumi";
import { irissPdFactsFromAutoparks } from "@/lib/iriss-piedavajumi-facts";
import { IRISS_PD_FACTS_TEMPLATE } from "@/lib/iriss-piedavajumi-types";
import { dzintarzemeAcceptedCars, waybillTradeCars } from "@/lib/iriss-waybill-trade-cars";

const V1VIN = "WBA00000000000001";
const FIXED = "WBA00000000000009";

function car(extra: Record<string, unknown> = {}): AutoparksCar {
  return normalizeAutoparksCar({ id: "c1", make: "BMW", model: "330", year: "2019", color: "melna", vin: V1VIN, plate: "", mileageKm: 100000, status: "for_sale", ...extra })!;
}

function v2With(fields: Partial<AutoparksCarV2["fields"]>, tech: Partial<AutoparksCarV2["tech"]> = {}): AutoparksCarV2 {
  const c = emptyCarV2();
  return { ...c, fields: { ...c.fields, ...fields }, tech: { ...c.tech, ...tech } };
}

function stateOf(id: string, v2: AutoparksCarV2): AutoparksV2State {
  return { ...emptyAutoparksV2State(), cars: { [id]: v2 } };
}

const accepted = { tradeActNo: "TA-1", tradeActDate: "2026-10-01", status: "Tirdzniecībā", importedAt: "x" };

describe("efektīvie Autoparka lauki (v2 || v1)", () => {
  it("v2 labotās vērtības aizstāj v1; tukšie v2 lauki - v1; v1 objekts netiek mainīts", () => {
    const c = car();
    const e = effectiveAutoparksCar(c, v2With({ vin: FIXED, plate: "AB-1234", make: "Audi", year: "2020", color: "balta", owner: "DZA" }, { mileageKm: 55000 }));
    expect(e).toMatchObject({ vin: FIXED, plate: "AB-1234", make: "Audi", model: "330", year: "2020", color: "balta", owner: "DZA", mileageKm: 55000 });
    expect(c).toMatchObject({ vin: V1VIN, make: "BMW", year: "2019", mileageKm: 100000 });
    expect(c.owner).toBeUndefined();
    expect(effectiveAutoparksCar(c, null)).toBe(c);
  });

  it("īpašnieks: v2 -> v1 -> IRISS; nobraukums kā kabinetā (ar roku -> CSDD -> v1)", () => {
    expect(effectiveAutoparksOwner({ owner: "DZA" }, v2With({}))).toBe("DZA");
    expect(effectiveAutoparksOwner({}, v2With({ owner: "DZA" }))).toBe("DZA");
    expect(effectiveAutoparksOwner({}, null)).toBe("IRISS");
    const withReg = car({ registry: { odometerKm: 120000 } });
    const b = autoparksV2Basics(withReg, v2With({}));
    expect(effectiveAutoparksCar(withReg, v2With({})).mileageKm).toBe(b.mileageKm.value);
  });
});

describe("1. CSDD reģistra sinhronizācija pēc efektīvā VIN", () => {
  const file = (vehicles: unknown[], snapshot?: unknown) => {
    const r = parseRegistryFile({ schema: REGISTRY_SCHEMA_ID, generatedAt: "2026-11-20", vehicles, ...(snapshot ? { snapshot } : {}) });
    if (!r.ok) throw new Error(r.error);
    return r.file;
  };

  it("auto ar Pamatdatos labotu VIN tiek atrasts; v1 VIN netiek pārrakstīts", () => {
    const s = { ...normalizeAutoparksState({ version: 1 }), cars: [car({ registry: accepted })] };
    const v2 = stateOf("c1", v2With({ vin: FIXED }));
    const { result } = applyRegistryFileToState(s, file([{ vin: FIXED, tradeAct: { number: "TA-2", date: "2026-11-01" }, status: "Tirdzniecībā" }]), "rokas.json", "2026-11-20T10:00:00Z", v2);
    expect(result.matched).toBe(1);
    expect(result.unmatched).toEqual([]);
    expect(s.cars[0]!.vin).toBe(V1VIN);
    expect(s.cars[0]!.registry?.tradeActNo).toBe("TA-2");
  });

  it("izņemšana pēc efektīvā īpašnieka: DZA nolasījums neatzīmē v2 IRISS auto", () => {
    const cars = [car({ id: "x", vin: V1VIN, owner: "DZA", registry: accepted })];
    const s = { ...normalizeAutoparksState({ version: 1 }), cars };
    const v2 = stateOf("x", v2With({ owner: "IRISS" }));
    const { result } = applyRegistryFileToState(s, file([{ vin: "WBA00000000000005", owner: "DZA", status: "Tirdzniecībā" }], { complete: true, owners: ["DZA"] }), "auto.json", "2026-11-20T10:00:00Z", v2);
    expect(result.removed).toBe(0);
    expect(s.cars[0]!.registry?.removedAt ?? "").toBe("");
  });
});

describe("2.-3. Pavadzīmes un pieņemtie auto - efektīvais īpašnieks, marka, VIN, gads", () => {
  it("B192-7 (DZA) rāda auto, kam īpašnieks DZA labots Pamatdatos; marka/VIN/gads efektīvie", () => {
    const cars = effectiveAutoparksCars([car({ registry: accepted })], stateOf("c1", v2With({ owner: "DZA", make: "Audi", model: "A6", vin: FIXED, year: "2021" })));
    const trade = waybillTradeCars(cars);
    expect(trade[0]).toMatchObject({ brandModel: "Audi A6", vin: FIXED, year: "2021", owner: "DZA" });
    expect(dzintarzemeAcceptedCars(trade).map((c) => c.id)).toEqual(["c1"]);
    expect(listAcceptedForTradeVehicles(cars, { owner: "DZA" }).map((v) => v.vin)).toEqual([FIXED]);
    expect(listAcceptedForTradeVehicles(cars, { owner: "IRISS" })).toEqual([]);
  });
});

describe("8. Autoparka saraksts", () => {
  it("gads/krāsa/īpašnieks efektīvie; meklē arī pēc numurzīmes", () => {
    const rows = autoparksV2ListRows([car()], stateOf("c1", v2With({ year: "2021", color: "zila", owner: "DZA", plate: "AB-1234" })));
    expect(rows[0]).toMatchObject({ year: "2021", color: "zila", owner: "DZA", plate: "AB-1234" });
    expect(filterAutoparksV2Rows(rows, { owner: "DZA" })).toHaveLength(1);
    expect(filterAutoparksV2Rows(rows, { owner: "IRISS" })).toHaveLength(0);
    expect(filterAutoparksV2Rows(rows, { owner: "all", query: "ab1234" })).toHaveLength(1);
    expect(filterAutoparksV2Rows(rows, { owner: "all", query: "AB-1234" })).toHaveLength(1);
    expect(filterAutoparksV2Rows(rows, { owner: "all", query: "XY-9999" })).toHaveLength(0);
  });
});

describe("5. PD sākuma dati no Autoparka", () => {
  it("efektīvais VIN/krāsa/marka un ar roku labotais nobraukums; atslēgas un otrs komplekts", () => {
    const v2 = v2With({ vin: FIXED, color: "balta", make: "Audi" }, { mileageKm: 55000, keysCount: 2, secondWheels: "ziemas riepas" });
    const c = effectiveAutoparksCar(car({ displayName: "", registry: { odometerKm: 120000 } }), v2);
    const f = offerSeedFromAutoparks(c, { tech: v2.tech });
    expect(f.vin).toBe(FIXED);
    expect(f.color).toBe("balta");
    expect(f.brandModel).toBe("Audi 330");
    expect(f.odometerReading).toMatch(/^55\s?000 km$/);
    expect(f.keyCount).toBe("2");
    expect(f.hasSecondWheelSet).toBe(true);
    expect(offerSeedFromAutoparks(c, { tech: { secondWheels: "nav" } }).hasSecondWheelSet).toBeUndefined();
  });

  it("PD fakti: atslēgu skaits un otrs riteņu komplekts (tikai neaiztiktās šablona rindas)", () => {
    const facts = irissPdFactsFromAutoparks({ keysCount: 1, secondWheels: "jā" }, IRISS_PD_FACTS_TEMPLATE);
    expect(facts.find((f) => f.text === "1 atslēga")?.on).toBe(true);
    expect(facts.find((f) => f.text === "Otrs riteņu komplekts")?.on).toBe(true);
    const touched = IRISS_PD_FACTS_TEMPLATE.map((f) => (f.text === "2 atslēgas" ? { ...f, on: true } : f));
    expect(irissPdFactsFromAutoparks({ keysCount: 3 }, touched).find((f) => f.text === "2 atslēgas")?.on).toBe(true);
    expect(irissPdFactsFromAutoparks(null, IRISS_PD_FACTS_TEMPLATE)).toEqual(IRISS_PD_FACTS_TEMPLATE);
  });
});

describe("6. PD auto izvēle pēc efektīvā VIN un numura", () => {
  it("izvēlē efektīvais nosaukums/VIN/numurs; dublikāts pēc efektīvā VIN", () => {
    const cars = effectiveAutoparksCars([car({ displayName: "" })], stateOf("c1", v2With({ vin: FIXED, plate: "AB-1234", make: "Audi" })));
    const row = { id: "pd1", number: 1, status: "sent", vin: FIXED, sourceRef: "", source: "link", sourceKey: "" } as never;
    const picks = irissPdCarPicks(cars, [row]);
    expect(picks[0]).toMatchObject({ title: "Audi 330", vinTail: FIXED.slice(-6), plate: "AB-1234" });
    expect(picks[0]!.search).toContain("ab1234");
    expect(picks[0]!.takenBy).not.toBe("");
  });
});

describe("7. Cenu lapa", () => {
  it("virsraksts un gads no efektīvajiem Pamatdatiem", () => {
    const c = car({ displayName: "" });
    const v2 = v2With({ make: "Audi", model: "A6 Avant", year: "2021" });
    const s = autoparksV2PriceSheet(c, v2, autoparksV2Basics(c, v2));
    expect(s.displayName).toBe("AUDI A6 AVANT");
    expect(s.year).toBe("2021");
    expect(s.sold).toBe(false);
  });

  it("«Pārdots» bez manuālas izvēles - lapu nedrukā; manuāla izvēle atļauj", () => {
    const sold = car({ status: "sold" });
    expect(priceSheetSold(sold, { sheetState: null })).toBe(true);
    expect(priceSheetSold(sold, { sheetState: "reserved" })).toBe(false);
    expect(priceSheetSold(car(), { sheetState: null })).toBe(false);
    const v2 = v2With({});
    expect(autoparksV2PriceSheet(sold, v2, autoparksV2Basics(sold, v2)).sold).toBe(true);
  });
});
