import { describe, expect, it } from "vitest";
import { normalizeAutoparksCar, type AutoparksCar } from "@/lib/iriss-autoparks";
import {
  autoparksV2Basics,
  autoparksV2Title,
  capHistory,
  decideStatusUndo,
  emptyCarV2,
  normalizeAutoparksV2State,
  normalizeCarV2,
  V2_HISTORY_PER_CAR,
  type V2HistoryRow,
} from "@/lib/iriss-autoparks-v2";

function v1Car(extra: Record<string, unknown> = {}): AutoparksCar {
  return normalizeAutoparksCar({ id: "ap-1", make: "VW", model: "Passat Variant", year: "2019", vin: "WVWZZZ3CZKE012345", mileageKm: 140000, status: "in_service", ...extra })!;
}

describe("autoparks-v2.json normalizators", () => {
  it("nav faila -> tukšs stāvoklis; auto bez v2 ieraksta -> tukšs v2", () => {
    expect(normalizeAutoparksV2State(null)).toEqual({ version: 1, cars: {}, history: [] });
    expect(normalizeCarV2(undefined)).toEqual(emptyCarV2());
  });

  it("saglabā zināmos laukus, izmet nezināmos un nederīgos", () => {
    const s = normalizeAutoparksV2State({
      cars: {
        "ap-1": {
          tech: { powerKw: "110", displacementCm3: 1968, tyreSize: "225/45 R17" },
          sources: { "tech.powerKw": "csdd", bad: "hack", "x y": "csdd" },
          purchase: { vat: { mode: "margin" }, purchasePriceEur: "9 850,00" },
          service: {
            problems: [{ id: "p1", text: "Bremzes\nNomainīt", fixedByService: true }],
            invoices: [{ id: "i1", fileId: "af-1", pages: 2, amountEur: null }, { id: "bez-faila" }],
          },
          secret: "x",
        },
        "../ļauns": {},
      },
    });
    const car = s.cars["ap-1"]!;
    expect(Object.keys(s.cars)).toEqual(["ap-1"]);
    expect(car.tech.powerKw).toBe(110);
    expect(car.sources).toEqual({ "tech.powerKw": "csdd" });
    expect(car.purchase.vat.mode).toBe("margin");
    expect(car.purchase.purchasePriceEur).toBe(9850);
    expect(car.service.problems[0]!.text).toBe("Bremzes\nNomainīt");
    expect(car.service.invoices).toHaveLength(1);
    expect("secret" in car).toBe(false);
  });

  it("J29 B papildus: normalizē jaunos v2 laukus (gads, krāsa, īpašnieks, nobraukums)", () => {
    const s = normalizeAutoparksV2State({
      cars: {
        "ap-1": {
          fields: { year: "2020", color: "sarkans", owner: "dza" },
          tech: { mileageKm: "150 500" },
        },
        "ap-2": { fields: { owner: "hack" } },
      },
    });
    expect(s.cars["ap-1"]!.fields.year).toBe("2020");
    expect(s.cars["ap-1"]!.fields.color).toBe("sarkans");
    expect(s.cars["ap-1"]!.fields.owner).toBe("");
    expect(s.cars["ap-1"]!.tech.mileageKm).toBe(150500);
    expect(s.cars["ap-2"]!.fields.owner).toBe("");
  });

  it("J30: normalizē jaunos tech laukus (pārnesumkārba, dzinējs); vecs fails bez šiem laukiem -> tukšs, bez regresijas", () => {
    const s = normalizeAutoparksV2State({
      cars: {
        "ap-1": { tech: { gearbox: "Automātiskā", engine: "2.0 TDI" } },
        "ap-2": { tech: { powerKw: 110 } },
      },
    });
    expect(s.cars["ap-1"]!.tech.gearbox).toBe("Automātiskā");
    expect(s.cars["ap-1"]!.tech.engine).toBe("2.0 TDI");
    expect(s.cars["ap-2"]!.tech).toMatchObject({ gearbox: "", engine: "", powerKw: 110 });
  });

  it("vēsture: ne vairāk kā 500 rindas uz auto, citu auto rindas paliek", () => {
    const rows: V2HistoryRow[] = [];
    for (let i = 0; i < 520; i++) rows.push({ id: `a${i}`, carId: "A", at: `t${i}`, actorId: "u", actorName: "u", field: "f", from: "", to: String(i) });
    rows.push({ id: "b", carId: "B", at: "t", actorId: "u", actorName: "u", field: "f", from: "", to: "" });
    const out = capHistory(rows);
    expect(out.filter((r) => r.carId === "A")).toHaveLength(V2_HISTORY_PER_CAR);
    expect(out[0]!.id).toBe("a20");
    expect(out.some((r) => r.carId === "B")).toBe(true);
  });
});

describe("Pamatdati skats", () => {
  it("nobraukums: CSDD reģistra odometrs galvenais (zaļš punkts); v1 vērtība netiek mainīta", () => {
    const car = v1Car({ registry: { odometerKm: 148950, importedAt: "2026-10-20" } });
    const b = autoparksV2Basics(car, emptyCarV2());
    expect(b.mileageKm).toEqual({ value: 148950, csdd: true });
    expect(car.mileageKm).toBe(140000);
    expect(autoparksV2Basics(v1Car(), emptyCarV2()).mileageKm).toEqual({ value: 140000, csdd: false });
  });

  it("v2 laukā ievadītā numurzīme rādās v2, v1 paliek", () => {
    const v2 = emptyCarV2();
    v2.fields.plate = "AB1234";
    const car = v1Car({ plate: "" });
    expect(autoparksV2Basics(car, v2).plate).toBe("AB1234");
    expect(car.plate).toBe("");
  });

  it("J29 C: ar roku labota marka/modelis/VIN rādās v2, v1 paliek nemainīts", () => {
    const v2 = emptyCarV2();
    v2.fields.make = "BMW";
    v2.fields.model = "220d Gran Tourer";
    v2.fields.vin = "WBA2A1234A1234567";
    const car = v1Car({ make: "BMW", model: "218D", vin: "WBA2A9999A9999999" });
    const b = autoparksV2Basics(car, v2);
    expect(b.title).toBe("BMW 220d Gran Tourer");
    expect(b.make).toBe("BMW");
    expect(b.model).toBe("220d Gran Tourer");
    expect(b.vin).toBe("WBA2A1234A1234567");
    expect(car.model).toBe("218D");
    expect(car.vin).toBe("WBA2A9999A9999999");
    expect(autoparksV2Title(car)).toBe("BMW 218D");
  });

  it("J29 B papildus: ar roku labots gads/krāsa/īpašnieks rādās v2, v1 paliek nemainīts", () => {
    const v2 = emptyCarV2();
    v2.fields.year = "2020";
    v2.fields.color = "sarkans";
    v2.fields.owner = "DZA";
    const car = v1Car({ year: "2019", color: "pelēks", owner: "IRISS" });
    const b = autoparksV2Basics(car, v2);
    expect(b.year).toBe("2020");
    expect(b.color).toBe("sarkans");
    expect(b.owner).toBe("DZA");
    expect(b.ownerLabel).toBe("SIA DZINTARZEME AUTO");
    expect(car.year).toBe("2019");
    expect(car.color).toBe("pelēks");
  });

  it("J29 B papildus: ar roku labots nobraukums ir galvenais pat ja ir CSDD odometrs; v1 nemainās", () => {
    const v2 = emptyCarV2();
    v2.tech.mileageKm = 150500;
    const car = v1Car({ registry: { odometerKm: 148950, importedAt: "2026-10-20" } });
    const b = autoparksV2Basics(car, v2);
    expect(b.mileageKm).toEqual({ value: 150500, csdd: false });
    expect(car.mileageKm).toBe(140000);
  });

  it("nederīga v2.fields.owner vērtība ignorēta - krīt atpakaļ uz v1 īpašnieku", () => {
    const v2 = emptyCarV2();
    v2.fields.owner = "nav-derigs";
    expect(autoparksV2Basics(v1Car({ owner: "DZA" }), v2).owner).toBe("DZA");
  });

  it("J30: pārnesumkārba - ar roku ievadīta vērtība pārsvarā; tukša -> CSDD tirdzniecības reģistra registry.gearbox", () => {
    const car = v1Car({ registry: { gearbox: "Manuālā" } });
    expect(autoparksV2Basics(car, emptyCarV2()).gearbox).toEqual({ value: "Manuālā", csdd: true });
    const v2 = emptyCarV2();
    v2.tech.gearbox = "Automātiskā";
    expect(autoparksV2Basics(car, v2).gearbox).toEqual({ value: "Automātiskā", csdd: false });
  });

  it("J30: dzinējs - ar roku ievadīts teksts rādās Pamatdatos; tukšs, ja nav ievadīts", () => {
    expect(autoparksV2Basics(v1Car(), emptyCarV2()).engine).toEqual({ value: "", csdd: false });
    const v2 = emptyCarV2();
    v2.tech.engine = "2.0 TDI";
    expect(autoparksV2Basics(v1Car(), v2).engine).toEqual({ value: "2.0 TDI", csdd: false });
  });

  it("CSDD reģistra statuss: nav / pieņemts / noņemts", () => {
    expect(autoparksV2Basics(v1Car(), emptyCarV2()).registry.status).toBe("none");
    expect(autoparksV2Basics(v1Car({ registry: { tradeActNo: "TA-1182", tradeActDate: "2026-10-20" } }), emptyCarV2()).registry).toMatchObject({ status: "accepted", actNo: "TA-1182" });
    expect(autoparksV2Basics(v1Car({ registry: { tradeActNo: "TA-1", removedAt: "2026-10-22" } }), emptyCarV2()).registry.status).toBe("removed");
  });
});

describe("statusa atsaukšana (5 s)", () => {
  const at = Date.parse("2026-10-23T10:00:00Z");
  const row: V2HistoryRow = { id: "h1", carId: "ap-1", at: new Date(at).toISOString(), actorId: "u1", actorName: "U", field: "status", from: "in_service", to: "for_sale" };

  it("5 s laikā atgriež iepriekšējo", () => {
    const d = decideStatusUndo({ history: [row], rowId: "h1", actorId: "u1", currentStatus: "for_sale", nowMs: at + 4_000 });
    expect(d).toMatchObject({ ok: true, revertTo: "in_service" });
  });

  it("pēc loga - expired; cits mainīja - changed; cita persona - not_owner", () => {
    expect(decideStatusUndo({ history: [row], rowId: "h1", actorId: "u1", currentStatus: "for_sale", nowMs: at + 8_000 })).toEqual({ ok: false, reason: "expired" });
    expect(decideStatusUndo({ history: [row], rowId: "h1", actorId: "u1", currentStatus: "reserved", nowMs: at + 2_000 })).toEqual({ ok: false, reason: "changed" });
    const later = { ...row, id: "h2", at: new Date(at + 1000).toISOString(), from: "for_sale", to: "for_sale" };
    expect(decideStatusUndo({ history: [row, later], rowId: "h1", actorId: "u1", currentStatus: "for_sale", nowMs: at + 2_000 })).toEqual({ ok: false, reason: "changed" });
    expect(decideStatusUndo({ history: [row], rowId: "h1", actorId: "u2", currentStatus: "for_sale", nowMs: at + 2_000 })).toEqual({ ok: false, reason: "not_owner" });
  });
});
