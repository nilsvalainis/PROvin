import { describe, expect, it } from "vitest";
import { normalizeAutoparksCar } from "@/lib/iriss-autoparks";
import { parseAutoparksCarInput } from "@/lib/iriss-autoparks-input";
import {
  applyManualRegistryPatch,
  mergeRegistryValues,
  parseRegistryFile,
  REGISTRY_SCHEMA_ID,
  registryFieldSource,
} from "@/lib/iriss-autoparks-registry";
import { pickLatestRegistryEntry } from "@/lib/iriss-autoparks-registry-dropbox";
import { autoparksRowsForActor } from "@/lib/iriss-autoparks-access";
import { autoparksListRows, normalizeAutoparksState } from "@/lib/iriss-autoparks";

const vehicle = {
  vin: "wauzzz8k0fa036715",
  makeModel: "AUDI A4 AVANT",
  firstRegistrationDate: "14.05.2018",
  odometerKm: "123 456",
  vehicleType: "M1 - vieglais pasažieru",
  fuel: "Dīzelis",
  gearbox: "Automātiskā",
  seats: 5,
  grossMassKg: 2210,
  co2GKm: "129,5",
  tradeAct: { number: "TA-2026-0042", date: "2026-10-01" },
  safety: {
    airbags: { present: true, checked: true },
    esp: { present: true, checked: false },
    eps: { present: false },
    abs: {},
  },
  status: "Tirdzniecībā",
  // Personas dati failā nedrīkst nonākt kartītē.
  ownerName: "Jānis Bērziņš",
  ownerPersonalCode: "010101-12345",
};

const meta = { importedAt: "2026-10-22T05:00:00.000Z", importFile: "registrs-2026-10-22.json", registryDate: "2026-10-21" };

function parse(vehicles: unknown[]) {
  const r = parseRegistryFile({ schema: REGISTRY_SCHEMA_ID, generatedAt: "2026-10-21", vehicles });
  if (!r.ok) throw new Error(r.error);
  return r;
}

describe("CSDD reģistra fails", () => {
  it("parses whitelisted fields, normalizes VIN, dates and numbers", () => {
    const r = parse([vehicle]);
    const v = r.file.vehicles[0]!;
    expect(v.vin).toBe("WAUZZZ8K0FA036715");
    expect(v.values).toEqual({
      makeModel: "AUDI A4 AVANT",
      firstRegDate: "2018-05-14",
      vehicleType: "M1 - vieglais pasažieru",
      fuel: "Dīzelis",
      gearbox: "Automātiskā",
      tradeActNo: "TA-2026-0042",
      tradeActDate: "2026-10-01",
      status: "Tirdzniecībā",
      odometerKm: 123456,
      seats: 5,
      grossMassKg: 2210,
      co2GKm: 129.5,
      airbags: "yes_checked",
      esp: "yes",
      eps: "no",
    });
  });

  it("drops personal data and unknown keys", () => {
    const json = JSON.stringify(parse([vehicle]).file);
    expect(json).not.toContain("Bērziņš");
    expect(json).not.toContain("010101");
  });

  it("rejects wrong schema and skips rows without a usable VIN", () => {
    expect(parseRegistryFile({ schema: "cits", vehicles: [] })).toEqual({ ok: false, error: "wrong_schema" });
    expect(parseRegistryFile({ schema: REGISTRY_SCHEMA_ID })).toEqual({ ok: false, error: "no_vehicles" });
    const r = parse([{ vin: "123" }, "x", vehicle]);
    expect(r.skipped).toBe(2);
    expect(r.file.vehicles).toHaveLength(1);
  });
});

describe("Reģistra imports kartītē", () => {
  it("fills empty registry and marks source as CSDD", () => {
    const { registry, changed } = mergeRegistryValues(undefined, parse([vehicle]).file.vehicles[0]!.values, meta);
    expect(changed).toContain("odometerKm");
    expect(registry.odometerKm).toBe(123456);
    expect(registry.importFile).toBe("registrs-2026-10-22.json");
    expect(registryFieldSource(registry, "odometerKm")).toBe("csdd");
    expect(registryFieldSource(registry, "abs")).toBe("");
  });

  it("never overwrites fields Nils edited by hand", () => {
    const first = mergeRegistryValues(undefined, { odometerKm: 100000, fuel: "Dīzelis" }, meta).registry;
    const edited = applyManualRegistryPatch(first, { odometerKm: 99000 });
    expect(registryFieldSource(edited, "odometerKm")).toBe("manual");
    const again = mergeRegistryValues(edited, { odometerKm: 130000, fuel: "Benzīns" }, meta);
    expect(again.registry.odometerKm).toBe(99000);
    expect(again.registry.fuel).toBe("Benzīns");
    expect(again.changed).toEqual(["fuel"]);
  });

  it("empty value in file does not wipe existing data", () => {
    const first = mergeRegistryValues(undefined, { fuel: "Dīzelis", seats: 5 }, meta).registry;
    const next = mergeRegistryValues(first, {}, { ...meta, importFile: "cits.json" });
    expect(next.changed).toEqual([]);
    expect(next.registry.fuel).toBe("Dīzelis");
    expect(next.registry.importFile).toBe(meta.importFile);
  });

  it("clearing a hand-edited field returns it to CSDD on next import", () => {
    const edited = applyManualRegistryPatch(undefined, { fuel: "Hibrīds" });
    const cleared = applyManualRegistryPatch(edited, { fuel: "" });
    expect(cleared.manual).toEqual([]);
    expect(mergeRegistryValues(cleared, { fuel: "Dīzelis" }, meta).registry.fuel).toBe("Dīzelis");
  });
});

describe("Auto kartīte un vecie ieraksti", () => {
  const old = { id: "ap-1", vin: "WAUZZZ8K0FA036715", make: "Audi", status: "for_sale" };

  it("keeps old records without new keys", () => {
    const car = normalizeAutoparksCar(old)!;
    expect("registry" in car).toBe(false);
    expect("displayName" in car).toBe(false);
    expect("listPriceEur" in car).toBe(false);
  });

  it("normalizes stored registry and drops unknown keys", () => {
    const car = normalizeAutoparksCar({ ...old, displayName: " Audi A4 ", registry: { fuel: "Dīzelis", esp: "bad", manual: ["fuel", "x"], ownerName: "X" } })!;
    expect(car.displayName).toBe("Audi A4");
    expect(car.registry?.fuel).toBe("Dīzelis");
    expect(car.registry?.esp).toBe("");
    expect(car.registry?.manual).toEqual(["fuel"]);
    expect(JSON.stringify(car)).not.toContain("ownerName");
  });

  it("API input: price only for users who see sums, registry patch parsed", () => {
    const body = { displayName: "Audi A4 Avant", equipmentLine: "ACC DISTRONIC / LANE ASSIST", listPriceEur: "18 900", registry: { odometerKm: "120 000", esp: "yes_checked", nope: 1 } };
    expect(parseAutoparksCarInput(body, false)).toEqual({
      displayName: "Audi A4 Avant",
      equipmentLine: "ACC DISTRONIC / LANE ASSIST",
      listPriceEur: 18900,
      registry: { odometerKm: 120000, esp: "yes_checked" },
    });
    expect(parseAutoparksCarInput(body, true)).not.toHaveProperty("listPriceEur");
  });

  it("hides list price for roles without sums", () => {
    const state = normalizeAutoparksState({ cars: [{ ...old, listPriceEur: 18900 }] });
    expect(autoparksRowsForActor(autoparksListRows(state), true)[0]!.listPriceEur).toBeNull();
    expect(autoparksRowsForActor(autoparksListRows(state), false)[0]!.listPriceEur).toBe(18900);
  });
});

describe("Dropbox jaunākais fails", () => {
  it("picks newest .json by server time and ignores other files", () => {
    const latest = pickLatestRegistryEntry([
      { ".tag": "file", id: "id:a", name: "registrs-2026-10-15.json", server_modified: "2026-10-15T08:00:00Z" },
      { ".tag": "file", id: "id:b", name: "registrs-2026-10-22.json", server_modified: "2026-10-22T08:00:00Z" },
      { ".tag": "file", id: "id:c", name: "piezimes.txt", server_modified: "2026-10-23T08:00:00Z" },
      { ".tag": "folder", name: "arhivs.json" },
    ]);
    expect(latest?.id).toBe("id:b");
    expect(pickLatestRegistryEntry([])).toBeNull();
  });
});
