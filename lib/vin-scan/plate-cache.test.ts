import { describe, expect, it } from "vitest";

import { changedVinScanPlateKinds, mergeVinScanPlates, vinScanPlateStaleSourceIds } from "@/lib/vin-scan/plate-cache";
import { emptyVinScanPlates } from "@/lib/vin-scan/plates";

const plates = (p: Partial<ReturnType<typeof emptyVinScanPlates>>) => ({ ...emptyVinScanPlates(), ...p });

describe("VIN SCAN kešs un numurzīmes", () => {
  it("tas pats numurs (citā rakstībā) kešu nebojā", () => {
    expect(vinScanPlateStaleSourceIds(plates({ nl: "AB123C" }), plates({ nl: "ab-123-c" })).size).toBe(0);
  });

  it("jauns NL numurs pēc pirmā skenējuma -> RDW jāskenē no jauna", () => {
    expect([...vinScanPlateStaleSourceIds(plates({}), plates({ nl: "AB123C" }))]).toEqual(["rdw"]);
  });

  it("cits numurs -> cita auto dati nedrīkst nākt no keša", () => {
    const stale = vinScanPlateStaleSourceIds(plates({ uk: "AB12CDE", se: "ABC12D" }), plates({ uk: "XY99ZZZ", se: "ABC12D" }));
    expect([...stale]).toEqual(["dvsa_mot"]);
  });

  it("tukšs vai nederīgs pieprasījuma numurs nav maiņa", () => {
    expect(changedVinScanPlateKinds(plates({ nl: "AB123C" }), plates({}))).toEqual([]);
    expect(changedVinScanPlateKinds(plates({}), plates({ nl: "X" }))).toEqual([]);
  });

  it("LV/FI numurs neietekmē VIN kešu", () => {
    expect(vinScanPlateStaleSourceIds(plates({}), plates({ lv: "AB1234", fi: "ABC123" })).size).toBe(0);
  });

  it("saglabājot jaunais numurs aizstāj veco, tukšs patur veco", () => {
    expect(mergeVinScanPlates(plates({ nl: "AB123C", lt: "ABC123" }), plates({ nl: "ZZ999Z" }))).toEqual(
      plates({ nl: "ZZ999Z", lt: "ABC123" }),
    );
  });
});
