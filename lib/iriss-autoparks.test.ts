import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  autoparksBundleName,
  autoparksDaysInPark,
  autoparksDefaultStage,
  autoparksDownloadName,
  autoparksListRows,
  autoparksRoom,
  autoparksStatusCounts,
  AUTOPARKS_STATUS_LV,
  autoparksWorkTotal,
  formatAutoparksEur,
  normalizeAutoparksCar,
  normalizeAutoparksState,
  sortAutoparksRows,
  type AutoparksCar,
} from "@/lib/iriss-autoparks";
import { parseAutoparksCarInput } from "@/lib/iriss-autoparks-input";
import { decideAdminPageAccess } from "@/lib/staff-roles";

const car = {
  id: "ap-1",
  orderId: "lo-1",
  vin: "wauzzz8k0fa036715",
  make: "Audi",
  model: "A4 Avant",
  year: "2015",
  status: "in_service",
  createdAt: "2026-10-10T08:00:00.000Z",
  arrivedAt: "2026-10-11",
  archivedAt: "",
};

describe("Autoparks dati", () => {
  it("normalizes unknown values safely and keeps VIN upper-case", () => {
    const state = normalizeAutoparksState({
      cars: [car, { id: "" }, { id: "ap-2", status: "nezinu" }],
      files: [
        { id: "f1", carId: "ap-1", stage: "service", title: "Rēķins", contentType: "application/pdf", size: 10, createdAt: "2026-10-12" },
        { id: "f2", carId: "ap-1", stage: "sale", deletedAt: "2026-10-13" },
      ],
      notes: [{ id: "n1", carId: "ap-1", text: " ", stage: "service" }],
      work: [{ id: "w1", carId: "ap-1", title: "Eļļa", priceEur: "45,50", done: false }],
    });
    expect(state.cars).toHaveLength(2);
    expect(state.cars[0]!.vin).toBe("WAUZZZ8K0FA036715");
    expect(state.cars[1]!.status).toBe("prep_waiting");
    expect(state.notes).toHaveLength(0);
    expect(state.work[0]!.priceEur).toBe(45.5);

    const rows = autoparksListRows(state);
    expect(rows[0]!.fileCount).toBe(1);
    expect(rows[0]!.stageFileCounts).toEqual({ purchase: 0, transport: 0, service: 1, sale: 0 });
    expect(rows[0]!.workOpen).toBe(1);
    expect(autoparksRoom(state, "ap-1")!.files.map((f) => f.id)).toEqual(["f1"]);
    expect(autoparksRoom(state, "nav")).toBeNull();
  });

  it("counts statuses, days in park and work totals", () => {
    expect(autoparksStatusCounts([{ status: "in_service" }, { status: "sold" }, { status: "in_service" }])).toEqual({
      prep_waiting: 0,
      in_service: 2,
      for_sale: 0,
      reserved: 0,
      ordered: 0,
      sold: 1,
    });
    expect(autoparksDaysInPark({ arrivedAt: "2026-10-11", createdAt: "" }, new Date("2026-10-21T12:00:00Z"))).toBe(10);
    expect(autoparksWorkTotal([{ qty: 2, priceEur: 10.25 }, { qty: 1, priceEur: null }])).toBe(20.5);
    expect(formatAutoparksEur(12900)).toBe("12 900,00 €");
    expect(formatAutoparksEur(4.5)).toBe("4,50 €");
  });

  it("builds download names without Latvian diacritics or odd characters", () => {
    expect(autoparksDownloadName({ make: "Škoda", model: "Superb", vin: "TMBJG9NP9H7045709" }, { title: "Servisa rēķins #1", stage: "service", fileName: "x.PDF" })).toBe(
      "Skoda-Superb-045709-Serviss-Servisa-rekins-1.pdf",
    );
    expect(autoparksBundleName({ make: "Audi", model: "A4", vin: "" }, null)).toBe("Audi-A4-visi-dokumenti.pdf");
  });

  it("opens the stage that matches the car status", () => {
    expect(autoparksDefaultStage("prep_waiting")).toBe("service");
    expect(autoparksDefaultStage("reserved")).toBe("sale");
    expect(autoparksDefaultStage("ordered")).toBe("sale");
  });

  it("keeps a saved ordered status and labels it apart from for-sale", () => {
    expect(normalizeAutoparksCar({ id: "x", status: "ordered" })?.status).toBe("ordered");
    expect(AUTOPARKS_STATUS_LV.ordered).toBe("Pasūtījums");
    expect(AUTOPARKS_STATUS_LV.ordered).not.toBe(AUTOPARKS_STATUS_LV.for_sale);
  });

  it("ignores prices from users who cannot see sums", () => {
    expect(parseAutoparksCarInput({ salePriceEur: "1000", make: "BMW" }, true)).toEqual({ make: "BMW" });
    expect(parseAutoparksCarInput({ salePriceEur: "12 900", status: "for_sale" }, false)).toEqual({ salePriceEur: 12900, status: "for_sale" });
  });
});

describe("Autoparks piekļuve", () => {
  it("opens Autoparks for Serviss, Loģistika and Grāmatvede, but not for Pavadzīmes", () => {
    for (const section of ["serviss", "logistika", "gramatvede"] as const) {
      expect(decideAdminPageAccess("/admin/iriss/autoparks", { kind: "staff", sections: [section] })).toBe("allow");
    }
    expect(decideAdminPageAccess("/admin/iriss/autoparks", { kind: "staff", sections: ["pavadzimes"] })).toBe("forbidden");
  });

  it("guards every write route with the cabinet write check", () => {
    const routes = [
      "app/api/admin/iriss-logistics/autoparks/route.ts",
      "app/api/admin/iriss-logistics/autoparks/[id]/route.ts",
      "app/api/admin/iriss-logistics/autoparks/[id]/files/route.ts",
      "app/api/admin/iriss-logistics/autoparks/files/[fileId]/route.ts",
    ];
    for (const file of routes) {
      const src = readFileSync(file, "utf8");
      const writes = src.match(/export async function (POST|PATCH|DELETE)/g) ?? [];
      const guards = src.match(/logisticsCabinetWriteForbidden\(gate\.actor\)/g) ?? [];
      expect(guards.length, file).toBeGreaterThanOrEqual(writes.length);
    }
  });
});


describe("Autoparks kārtošana un arhīvs", () => {
  const mk = (id: string, make: string, model: string, arrivedAt: string, extra: Partial<AutoparksCar> = {}) =>
    ({ ...car, id, make, model, arrivedAt, ...extra }) as AutoparksCar;
  const rows = [
    mk("a", "Volvo", "XC60", "2026-10-01"),
    mk("b", "Škoda", "Superb", "2026-10-15"),
    mk("c", "BMW", "530d", "2026-09-20"),
    mk("d", "Audi", "A4", "2026-10-10"),
  ];

  it("jaunākie, vecākie, alfabēts un marka", () => {
    expect(sortAutoparksRows(rows, "newest").map((r) => r.id)).toEqual(["b", "d", "a", "c"]);
    expect(sortAutoparksRows(rows, "oldest").map((r) => r.id)).toEqual(["c", "a", "d", "b"]);
    expect(sortAutoparksRows(rows, "alpha").map((r) => r.make)).toEqual(["Audi", "BMW", "Škoda", "Volvo"]);
    expect(sortAutoparksRows(rows, "make").map((r) => r.make)).toEqual(["Audi", "BMW", "Škoda", "Volvo"]);
  });

  it("arhīvā esošie netiek skaitīti statusos", () => {
    const counts = autoparksStatusCounts([
      { status: "sold", archivedAt: "" },
      { status: "sold", archivedAt: "2026-10-20T00:00:00Z" },
    ]);
    expect(counts.sold).toBe(1);
    expect(normalizeAutoparksCar({ id: "x", status: "sold" })?.archivedAt).toBe("");
  });
});
