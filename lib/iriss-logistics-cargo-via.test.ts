import { describe, expect, it } from "vitest";
import {
  addCargoVia,
  CARGO_VIA_MAX,
  cargoRoutePointsKey,
  emptyCargoPlan,
  insertCargoViaPoints,
  moveCargoVia,
  normalizeCargoPlan,
  removeCargoVia,
} from "@/lib/iriss-logistics-cargo-plan";

// Rīga -> Kauņa -> Varšava (aptuveni)
const RIGA = { lat: 56.95, lng: 24.1 };
const KAUNAS = { lat: 54.9, lng: 23.9 };
const WARSAW = { lat: 52.23, lng: 21.0 };

describe("maršruta starppunkti (pavilkta līnija)", () => {
  it("starppunkts nonāk tuvākajā posmā un ir atzīmēts kā via", () => {
    const panevezys = { lat: 55.73, lng: 24.36 };
    const augustow = { lat: 53.84, lng: 22.98 };
    const out = insertCargoViaPoints([RIGA, KAUNAS, WARSAW], [augustow, panevezys]);
    expect(out).toEqual([
      RIGA,
      { ...panevezys, via: true },
      KAUNAS,
      { ...augustow, via: true },
      WARSAW,
    ]);
  });

  it("vairāki vienā posmā sakārtojas pēc attāluma no sākuma", () => {
    const near = { lat: 56.5, lng: 24.0 };
    const far = { lat: 55.3, lng: 23.95 };
    const out = insertCargoViaPoints([RIGA, KAUNAS], [far, near]);
    expect(out.map((p) => p.lat)).toEqual([RIGA.lat, near.lat, far.lat, KAUNAS.lat]);
  });

  it("bez starppunktiem maršruts nemainās; atslēga atšķiras, ja starppunkts ir", () => {
    expect(insertCargoViaPoints([RIGA, WARSAW], [])).toEqual([RIGA, WARSAW]);
    const k0 = cargoRoutePointsKey([RIGA, WARSAW]);
    const k1 = cargoRoutePointsKey(insertCargoViaPoints([RIGA, WARSAW], [KAUNAS]));
    expect(k0).not.toBe(k1);
    expect(k1).toContain("~");
  });

  it("pievienot, pārvietot, noņemt, ne vairāk kā maksimums", () => {
    let plan = emptyCargoPlan("t");
    plan = addCargoVia(plan, "next", KAUNAS, "t");
    expect(plan.routes.next.via).toEqual([KAUNAS]);
    plan = moveCargoVia(plan, "next", 0, WARSAW, "t");
    expect(plan.routes.next.via).toEqual([WARSAW]);
    expect(moveCargoVia(plan, "next", 5, RIGA, "t")).toBe(plan);
    plan = removeCargoVia(plan, "next", 0, "t");
    expect(plan.routes.next.via).toEqual([]);
    for (let i = 0; i < CARGO_VIA_MAX + 3; i++) plan = addCargoVia(plan, "after", { lat: 50 + i, lng: 20 }, "t");
    expect(plan.routes.after.via.length).toBe(CARGO_VIA_MAX);
  });

  it("vecie saglabātie plāni bez via ielādējas ar tukšu sarakstu", () => {
    const plan = normalizeCargoPlan({ version: 1, cars: [], routes: { next: { enabled: true }, after: {} } });
    expect(plan.routes.next.via).toEqual([]);
  });
});
