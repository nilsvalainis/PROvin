import { describe, expect, it } from "vitest";

import {
  applyDenmarkSeedResult,
  applyNordicRegistryFetches,
  DENMARK_AUTO_SEED_PREFIX,
  denmarkSeedNeeded,
} from "@/lib/admin-denmark-registry-seed-apply";
import { createDefaultSourceBlocks, emptyVinRegistryBlock } from "@/lib/admin-source-blocks";
import { emptyVinSourceResult, type VinSourceFetchResult } from "@/lib/vin-sources/types";

const VIN = "VF12RFL1H49621453";

function foundResult(): VinSourceFetchResult {
  return {
    ...emptyVinSourceResult("tjekbil", VIN, "RENAULT Captur, AB12345, Registreret"),
    found: true,
    mileage: [{ date: "2025-08-22", odometer: "385537", country: "DK", origin: "Apskate" }],
    ownersSummary: "2 īpašnieki",
    notes: ["Pēdējā apskate izturēta"],
    raw: '{"dmr":{}}',
  };
}

describe("denmarkSeedNeeded", () => {
  it("tukšs bloks prasa ielasi", () => {
    expect(denmarkSeedNeeded(emptyVinRegistryBlock())).toBe(true);
    expect(denmarkSeedNeeded(undefined)).toBe(true);
  });

  it("operatora dati blokā atceļ zvanu", () => {
    expect(denmarkSeedNeeded({ ...emptyVinRegistryBlock(), comments: "Pārbaudīts" })).toBe(false);
    expect(denmarkSeedNeeded({ ...emptyVinRegistryBlock(), ownersSummary: "1 īpašnieks" })).toBe(false);
  });

  it("jau automātiski pārbaudīts bez rezultāta netiek pārbaudīts otrreiz", () => {
    const checked = { ...emptyVinRegistryBlock(), fetchedAt: "2026-10-06T10:00:00.000Z", fetchMessage: `${DENMARK_AUTO_SEED_PREFIX}: VIN nav` };
    expect(denmarkSeedNeeded(checked)).toBe(false);
  });
});

describe("applyDenmarkSeedResult", () => {
  it("atrasts: pilns bloks, operatora komentārs un AI konteksts saglabājas", () => {
    const current = { ...emptyVinRegistryBlock(), comments: "", aiContextRaw: "" };
    const next = applyDenmarkSeedResult(current, foundResult());
    expect(next).not.toBeNull();
    expect(next?.mileage[0]?.odometer).toBe("385537");
    expect(next?.ownersSummary).toBe("2 īpašnieki");
    expect(next?.autoNotes).toContain("izturēta");
    expect(next?.fetchMessage).toBe(`${DENMARK_AUTO_SEED_PREFIX}: RENAULT Captur, AB12345, Registreret`);
    expect(next?.fetchedAt).toBeTruthy();
  });

  it("nav atrasts: tikai ielases laiks un atbilde, dati netiek izdomāti", () => {
    const next = applyDenmarkSeedResult(emptyVinRegistryBlock(), emptyVinSourceResult("tjekbil", VIN, "VIN nav Dānijas transportlīdzekļu reģistrā (DMR)"));
    expect(next).not.toBeNull();
    expect(next?.fetchMessage).toContain("VIN nav Dānijas");
    expect(next?.fetchedAt).toBeTruthy();
    expect(next?.mileage.every((r) => !r.odometer && !r.date)).toBe(true);
    expect(next?.ownersSummary).toBe("");
  });

  it("bloks ar operatora datiem netiek pārrakstīts", () => {
    const current = { ...emptyVinRegistryBlock(), statusRecords: "Taksometrs" };
    expect(applyDenmarkSeedResult(current, foundResult())).toBeNull();
  });
});

describe("applyNordicRegistryFetches", () => {
  it("aizpilda tukšos Dānijas, Igaunijas un Zviedrijas blokus, operatora datus neaiztiek", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.carinfo = { ...emptyVinRegistryBlock(), ownersSummary: "Jau ir" };
    const { applied, blocks: next } = applyNordicRegistryFetches(blocks, {
      tjekbil: foundResult(),
      mnt_ee: emptyVinSourceResult("mnt_ee", VIN, "VIN nav Igaunijas reģistrā"),
      lkf_ee: {
        ...emptyVinSourceResult("lkf_ee", VIN, "OCTA: 1 polise"),
        found: true,
        notes: ["OCTA derīga"],
      },
      carinfo: foundResult(),
    });
    expect(applied).toEqual(["tjekbil", "mnt_ee", "lkf_ee"]);
    expect(next.tjekbil.mileage[0]?.odometer).toBe("385537");
    expect(next.mnt_ee.fetchMessage).toContain("VIN nav Igaunijas");
    expect(next.lkf_ee.autoNotes).toContain("OCTA");
    expect(next.carinfo.ownersSummary).toBe("Jau ir");
  });
});
