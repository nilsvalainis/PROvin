import { describe, expect, it } from "vitest";

import { createDefaultSourceBlocks, type CsddFormFields, type CsddRegistrySnapshot } from "@/lib/admin-source-blocks";
import { isValidLtabPlate, resolveLtabQueryTarget } from "@/lib/ltab-query-target";

const VIN = "WBALW3C59CC891863";

function csdd(patch: Partial<CsddFormFields> = {}): CsddFormFields {
  return { ...createDefaultSourceBlocks().csdd, ...patch };
}

function registry(data: Partial<CsddRegistrySnapshot["data"]>): CsddRegistrySnapshot {
  const base = createDefaultSourceBlocks().csdd.registry?.data;
  return {
    nr1: VIN,
    fetchedAt: "2026-10-23T10:00:00.000Z",
    data: {
      ...(base ?? ({} as CsddRegistrySnapshot["data"])),
      registrationNumber: "",
      vin: VIN,
      make: "BMW",
      model: "640I",
      year: "2012",
      ...data,
    } as CsddRegistrySnapshot["data"],
  };
}

describe("LTAB vaicājums: tikai LV numurzīme pēc CSDD", () => {
  it("uses the plate from the CSDD registry when the VIN matches the order", () => {
    expect(resolveLtabQueryTarget(csdd({ registry: registry({ registrationNumber: "ab 1234" }) }), VIN)).toEqual({
      kind: "plate",
      plate: "AB1234",
      source: "registry",
    });
  });

  it("skips foreign cars: CSDD has no record and no plate (never searches by VIN)", () => {
    expect(resolveLtabQueryTarget(csdd(), VIN)).toEqual({ kind: "skip", reason: "no_csdd_data" });
    expect(resolveLtabQueryTarget(null, VIN)).toEqual({ kind: "skip", reason: "no_csdd_data" });
    expect(resolveLtabQueryTarget(csdd({ registrationStatus: "Dati nav pieejami" }), VIN)).toEqual({ kind: "skip", reason: "not_registered_lv" });
  });

  it("skips deregistered / exported cars even if CSDD still has a plate", () => {
    for (const status of ["Noņemts no uzskaites", "Izvests uz ārvalstīm", "Norakstīts"]) {
      expect(resolveLtabQueryTarget(csdd({ registrationStatus: status, registry: registry({ registrationNumber: "AB1234" }) }), VIN).kind).toBe("skip");
    }
  });

  it("skips when the CSDD registry belongs to a different VIN", () => {
    expect(resolveLtabQueryTarget(csdd({ registry: registry({ registrationNumber: "AB1234", vin: "WVWZZZ1KZAW000001" }) }), VIN)).toEqual({
      kind: "skip",
      reason: "vin_mismatch",
    });
  });

  it("without the API needs both a pasted plate and status Uzskaitē/Reģistrēts", () => {
    expect(resolveLtabQueryTarget(csdd({ registrationNumber: "KG982", registrationStatus: "Uzskaitē" }), VIN)).toEqual({
      kind: "plate",
      plate: "KG982",
      source: "csdd_form",
    });
    expect(resolveLtabQueryTarget(csdd({ registrationNumber: "KG982", registrationStatus: "" }), VIN)).toEqual({ kind: "skip", reason: "not_registered_lv" });
    expect(resolveLtabQueryTarget(csdd({ registrationNumber: "DE-XY 123", registrationStatus: "Uzskaitē" }), VIN).kind).toBe("skip");
  });

  it("accepts personalised plates only as LTAB-safe tokens", () => {
    expect(isValidLtabPlate("AB1234")).toBe(true);
    expect(isValidLtabPlate("MANS")).toBe(true);
    expect(isValidLtabPlate("1234")).toBe(false);
    expect(isValidLtabPlate(VIN)).toBe(false);
  });
});
