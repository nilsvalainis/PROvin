import { describe, expect, it } from "vitest";
import { normalizeAutoparksCar } from "@/lib/iriss-autoparks";
import { emptyAutoparksV2State, normalizeAutoparksV2State } from "@/lib/iriss-autoparks-v2";
import { autoparksV2ListRows, autoparksV2OwnerCounts, filterAutoparksV2Rows, flattenAutoparksV2Rows, groupAutoparksV2Rows } from "@/lib/iriss-autoparks-v2-list";

const cars = [
  { id: "a", make: "Volkswagen", model: "Passat Variant", vin: "WVWZZZ3CZKE012345", status: "in_service", statusChangedAt: "2026-10-20", purchasePriceEur: 9850 },
  { id: "b", make: "Škoda", model: "Octavia Combi", vin: "TMBJJ7NE5ML998877", status: "in_service", owner: "DZA", statusChangedAt: "2026-10-22" },
  { id: "c", make: "BMW", model: "320d Touring", vin: "WBA8E1C5XGA123456", status: "in_transit" },
  { id: "d", make: "Audi", model: "A6", vin: "WAUZZZ4G6JN445566", status: "sold", archivedAt: "2026-10-01" },
].map((c) => normalizeAutoparksCar(c)!);

const rows = autoparksV2ListRows(cars, emptyAutoparksV2State());

describe("Autoparks v2 saraksts", () => {
  it("rindā nav summu, īpašnieks tikai filtram; VIN pilns", () => {
    expect(Object.keys(rows[0]!).sort()).toEqual(["archived", "color", "hasPhoto", "id", "owner", "status", "statusChangedAt", "title", "vin", "year"]);
    expect(rows[0]!.vin).toBe("WVWZZZ3CZKE012345");
  });

  it("sadaļas pēc statusa procesa secībā, jaunākā maiņa augšā", () => {
    const g = groupAutoparksV2Rows(filterAutoparksV2Rows(rows, { owner: "all" }));
    expect(g.map((s) => [s.status, s.rows.map((r) => r.id)])).toEqual([
      ["in_transit", ["c"]],
      ["in_service", ["b", "a"]],
    ]);
  });

  it("plakans saraksts (m01): tā pati secība, bez sadaļām", () => {
    expect(flattenAutoparksV2Rows(filterAutoparksV2Rows(rows, { owner: "all" })).map((r) => r.id)).toEqual(["c", "b", "a"]);
  });

  it("īpašnieka filtrs, arhīvs, meklēšana pēc markas/modeļa/VIN daļas", () => {
    expect(filterAutoparksV2Rows(rows, { owner: "DZA" }).map((r) => r.id)).toEqual(["b"]);
    expect(filterAutoparksV2Rows(rows, { owner: "archive" }).map((r) => r.id)).toEqual(["d"]);
    expect(filterAutoparksV2Rows(rows, { owner: "all", query: "passat ke012" }).map((r) => r.id)).toEqual(["a"]);
    expect(filterAutoparksV2Rows(rows, { owner: "all", query: "škoda" }).map((r) => r.id)).toEqual(["b"]);
    expect(autoparksV2OwnerCounts(rows)).toEqual({ all: 3, IRISS: 2, DZA: 1 });
  });

  it("J29 C: sarakstā redzama v2 labotā marka/modelis/VIN", () => {
    const v2 = normalizeAutoparksV2State({ cars: { c: { fields: { make: "BMW", model: "220d Gran Tourer", vin: "WBA2A1234A1234567" } } } });
    const r = autoparksV2ListRows(cars, v2).find((x) => x.id === "c")!;
    expect(r.title).toBe("BMW 220d Gran Tourer");
    expect(r.vin).toBe("WBA2A1234A1234567");
  });
});
