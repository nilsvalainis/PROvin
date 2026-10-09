import { describe, expect, it } from "vitest";
import { createDefaultSourceBlocks, mergeSourceBlocksWithDefaults, type CsddRegistrySnapshot } from "@/lib/admin-source-blocks";
import {
  csddHasPurchasedData,
  importSourceBlocks,
  sourceBlockHasContent,
  sourceBlockHasPurchasedContent,
} from "@/lib/quick-eval-merge";

const registry: CsddRegistrySnapshot = {
  nr1: "WVWZZZ1KZAW000001",
  fetchedAt: "2026-10-01T10:00:00.000Z",
  data: {
    registrationNumber: "AB1234",
    vin: "WVWZZZ1KZAW000001",
    make: "VOLKSWAGEN",
    model: "GOLF",
    year: "2010",
    fuel: "Dīzeļdegviela",
    powerKw: "77",
    electricPowerKw: "",
    electricPowerKw2: "",
    displacementCm3: "1968",
    firstRegistrationIso: "2010-03-01",
    color: "Pelēka",
    vehicleKind: "Vieglais pasažieru",
    cocCategory: "M1",
    cocType: "",
    cocApprovalNumber: "",
    cocVariant: "",
    cocVersion: "",
    grossMassKg: "1900",
    curbMassKg: "1350",
    insuranceEndIso: "2027-01-01",
    inspectionValidUntilIso: "2027-03-01",
  } as CsddRegistrySnapshot["data"],
};

function blocks() {
  return mergeSourceBlocksWithDefaults(createDefaultSourceBlocks());
}

describe("importSourceBlocks", () => {
  it("copies blocks into an empty target and reports nothing for empty incoming", () => {
    const incoming = blocks();
    incoming.autodna = { ...incoming.autodna, comments: "2 negadījumi" };
    const r = importSourceBlocks(blocks(), incoming);
    expect(r.copied).toEqual(["autodna"]);
    expect(r.blocks.autodna.comments).toBe("2 negadījumi");
    expect(r.conflicts).toEqual([]);
  });

  it("keeps the target block on conflict", () => {
    const target = blocks();
    target.carvertical = { ...target.carvertical, comments: "mērķis" };
    const incoming = blocks();
    incoming.carvertical = { ...incoming.carvertical, comments: "avots" };
    const r = importSourceBlocks(target, incoming);
    expect(r.blocks.carvertical.comments).toBe("mērķis");
    expect(r.conflicts.map((c) => c.key)).toEqual(["carvertical"]);
    expect(r.changed).toBe(false);
  });

  it("respects wiped blocks and key filters", () => {
    const incoming = blocks();
    incoming.autodna = { ...incoming.autodna, comments: "x" };
    incoming.ltab = { ...incoming.ltab, comments: "y" };
    expect(importSourceBlocks(blocks(), incoming, { wipes: ["autodna"] }).copied).toEqual(["ltab"]);
    expect(importSourceBlocks(blocks(), incoming, { keys: ["autodna"] }).copied).toEqual(["autodna"]);
  });

  it("CSDD: fills empty fields from incoming PDF data but API fields stay locked", () => {
    const target = blocks();
    target.csdd = { ...target.csdd, registry, makeModel: "VOLKSWAGEN GOLF", vin: registry.data.vin };
    const incoming = blocks();
    incoming.csdd = {
      ...incoming.csdd,
      makeModel: "VW GOLF VI",
      roadTaxEur: "120",
      ownerCountLatvia: "3",
    };
    const r = importSourceBlocks(target, incoming);
    expect(r.copied).toEqual(["csdd"]);
    expect(r.blocks.csdd.makeModel).toBe("VOLKSWAGEN GOLF");
    expect(r.blocks.csdd.roadTaxEur).toBe("120");
    expect(r.blocks.csdd.ownerCountLatvia).toBe("3");
    expect(r.blocks.csdd.registry?.fetchedAt).toBe(registry.fetchedAt);
  });

  it("CSDD: target without registry gets incoming registry values with priority", () => {
    const target = blocks();
    target.csdd = { ...target.csdd, color: "Zila", roadTaxEur: "90" };
    const incoming = blocks();
    incoming.csdd = { ...incoming.csdd, registry };
    const r = importSourceBlocks(target, incoming);
    expect(r.blocks.csdd.registry).toBeDefined();
    expect(r.blocks.csdd.color).toBe("Pelēka");
    expect(r.blocks.csdd.conflicts?.color?.value).toBe("Zila");
  });
});

describe("purchased content", () => {
  it("API-only CSDD is not purchased data, PDF parts are", () => {
    const b = blocks();
    b.csdd = { ...b.csdd, registry, makeModel: "VOLKSWAGEN GOLF" };
    expect(sourceBlockHasContent(b, "csdd")).toBe(true);
    expect(sourceBlockHasPurchasedContent(b, "csdd")).toBe(false);
    b.csdd = { ...b.csdd, ownerCountLatvia: "2" };
    expect(csddHasPurchasedData(b.csdd)).toBe(true);
  });

  it("default blocks have no content", () => {
    const b = blocks();
    for (const k of Object.keys(b) as (keyof typeof b)[]) expect(sourceBlockHasContent(b, k)).toBe(false);
  });
});
