import { describe, expect, it } from "vitest";
import { isMemoryVin, kmRollback, latestKm, mergeObservations, parseVinMemoryTable, serializeVinMemoryTable, toObservation } from "@/lib/vin-memory";

const NOW = new Date("2026-10-29T10:00:00Z");

describe("isMemoryVin", () => {
  it("īsts Eiropas VIN jā, Auto1 jaucējkods un īss teksts nē", () => {
    expect(isMemoryVin("WVWZZZ7NZEV015204")).toBe(true);
    expect(isMemoryVin(" wvwzzz7nzev015204 ")).toBe(true);
    expect(isMemoryVin("7B7A4C2C89AE96965")).toBe(false);
    expect(isMemoryVin("WVWZZZ7NZEV01520O")).toBe(false);
  });
});

describe("toObservation", () => {
  it("sakārto km, datumu, modeli; nederīgu datumu noraida", () => {
    expect(toObservation({ vin: "WVWZZZ7NZEV015204", date: "2026-10-29T08:12:00.000Z", source: "autobid", km: "184 350 km", model: "  VW  Sharan 2.0 TDI ", firstRegistration: "2014-03", country: "de" })).toEqual({
      vin: "WVWZZZ7NZEV015204",
      obs: { date: "2026-10-29", source: "autobid", km: 184350, model: "VW Sharan 2.0 TDI", firstRegistration: "2014-03", country: "DE" },
    });
    expect(toObservation({ vin: "WVWZZZ7NZEV015204", date: "vakar", source: "order" })).toBeNull();
    expect(toObservation({ vin: "WVWZZZ7NZEV015204", date: "2026-10-29", source: "order", km: 0 })?.obs.km).toBeNull();
  });
});

describe("mergeObservations", () => {
  const vin = "WVWZZZ7NZEV015204";

  it("pievieno, vienā dienā no viena avota tikai viens, kārto pēc datuma", () => {
    const r1 = mergeObservations({}, [{ vin, date: "2026-10-29", source: "autobid", km: 184350 }], NOW);
    expect(r1.added).toBe(1);
    const r2 = mergeObservations(r1.table, [
      { vin, date: "2026-10-29", source: "autobid", km: 184350 },
      { vin, date: "2026-10-01", source: "order", km: 183000, model: "VW Sharan" },
    ], NOW);
    expect(r2.added).toBe(1);
    expect(r2.updated).toBe(0);
    expect(r2.table[vin].observations.map((o) => `${o.date} ${o.source} ${o.km}`)).toEqual(["2026-10-01 order 183000", "2026-10-29 autobid 184350"]);
  });

  it("tā pati diena un avots ar jaunu km atjauno, bez km nepārraksta esošo", () => {
    const base = mergeObservations({}, [{ vin, date: "2026-10-29", source: "autobid", km: 184350 }], NOW).table;
    const a = mergeObservations(base, [{ vin, date: "2026-10-29", source: "autobid", km: null }], NOW);
    expect(a.updated).toBe(0);
    expect(a.table[vin].observations[0].km).toBe(184350);
    const b = mergeObservations(base, [{ vin, date: "2026-10-29", source: "autobid", km: 184400 }], NOW);
    expect(b.updated).toBe(1);
    expect(b.table[vin].observations[0].km).toBe(184400);
  });

  it("jaucējkodus un sliktus VIN izlaiž, tabulu nemaina", () => {
    const r = mergeObservations({}, [{ vin: "7B7A4C2C89AE96965", date: "2026-10-29", source: "auto1", km: 1 }], NOW);
    expect(r.table).toEqual({});
    expect(r.added).toBe(0);
  });
});

describe("latestKm un kmRollback", () => {
  const vin = "WVWZZZ7NZEV015204";
  const table = mergeObservations({}, [
    { vin, date: "2024-03-10", source: "autobid", km: 184000 },
    { vin, date: "2025-01-05", source: "ecarstrade", km: null },
    { vin, date: "2026-10-01", source: "order", km: 150000 },
  ], NOW).table;

  it("pēdējais ar km, ne tukšais", () => {
    expect(latestKm(table[vin])).toMatchObject({ date: "2026-10-01", km: 150000 });
    expect(latestKm(undefined)).toBeNull();
  });

  it("vēlāks mazāks km = pretruna", () => {
    expect(kmRollback(table[vin])).toMatchObject({ earlier: { km: 184000 }, later: { km: 150000 } });
    const ok = mergeObservations({}, [{ vin, date: "2024-03-10", source: "autobid", km: 100 }, { vin, date: "2025-03-10", source: "order", km: 200 }], NOW).table;
    expect(kmRollback(ok[vin])).toBeNull();
  });
});

describe("serialize / parse", () => {
  it("apaļš ceļš un bojātu ierakstu izmešana", () => {
    const vin = "WVWZZZ7NZEV015204";
    const table = mergeObservations({}, [{ vin, date: "2026-10-29", source: "autobid", km: 184350, model: "VW Sharan" }], NOW).table;
    expect(parseVinMemoryTable(JSON.parse(serializeVinMemoryTable(table)))).toEqual(table);
    expect(parseVinMemoryTable({ entries: { [vin]: { observations: [{ date: "x", source: "autobid" }] }, "7B7A4C2C89AE96965": { observations: [{ date: "2026-10-29", source: "auto1" }] } } })).toEqual({});
    expect(parseVinMemoryTable(null)).toEqual({});
  });
});
