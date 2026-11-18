import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { mergeSourceBlocksWithDefaults, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { buildCanonicalFacts } from "@/lib/canonical-facts-sheet";

const DIR = path.join(__dirname, "__fixtures__", "mileage-etalons");
const facts = (name: string) => {
  const fx = JSON.parse(readFileSync(path.join(DIR, `${name}.json`), "utf8")) as { vin: string; sourceBlocks: WorkspaceSourceBlocks };
  return buildCanonicalFacts({ vin: fx.vin, sourceBlocks: mergeSourceBlocksWithDefaults(fx.sourceBlocks) });
};

describe("17.11 klase C: AI faktu lapa sakrīt ar nobraukuma tabulu", () => {
  it("BMW 650i: ievades kļūdas, novecojis dokuments un sludinājums nav kritumi (agrāk 5, 'lielākais kritums 54 722 km')", () => {
    const f = facts("WBAYM9C55DDW20079");
    expect(f.rollbacks).toEqual([]);
    expect(f.maxRollbackDropKm).toBe(0);
  });

  it("īstās korekcijas paliek faktu lapā kā kritumi", () => {
    for (const [name, from, to] of [
      ["WF0K-maskets-VmX9EF", 529000, 195623],
      ["TMBJH9NP9H7561596", 253760, 181345],
      ["1FTEX15NXSKB79831", 339738, 72348],
    ] as const) {
      const f = facts(name);
      expect(f.odometerAnomaly).toBe(true);
      expect(f.rollbacks.map((b) => [b.fromKm, b.toKm])).toContainEqual([from, to]);
    }
  });
});
