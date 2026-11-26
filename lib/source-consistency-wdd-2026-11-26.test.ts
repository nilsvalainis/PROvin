import { describe, expect, it } from "vitest";

import { mergeSourceBlocksWithDefaults, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { buildCanonicalFactsSheet } from "@/lib/canonical-facts-sheet";
import { buildDealerCodeFactsForPrompt } from "@/lib/dealer-code-facts-prompt";
import { checkSourceConsistency } from "@/lib/source-consistency";

/** Anonimizēts paraugs pēc WDD2122931A366915 audita (26.11): 4 eļļas maiņas tabulā. */
const NOW = Date.UTC(2026, 10, 26);

function blocks(patch: Record<string, unknown>): WorkspaceSourceBlocks {
  return mergeSourceBlocksWithDefaults(patch as unknown);
}

const OIL_ROWS = [
  { date: "12.08.2011", odometer: "25400", location: "Serviss", works: "Motoreļļas un eļļas filtra maiņa" },
  { date: "08.05.2012", odometer: "50319", location: "Serviss", works: "Motoreļļas un eļļas filtra maiņa" },
  { date: "10.12.2014", odometer: "97879", location: "Serviss", works: "Motoreļļas un eļļas filtra maiņa" },
  { date: "03.06.2015", odometer: "105486", location: "Serviss", works: "Motoreļļas un eļļas filtra maiņa" },
];

function oilBlocks(notes: string): WorkspaceSourceBlocks {
  return blocks({
    csdd: { makeModel: "MERCEDES BENZ", enginePowerKw: "195" },
    auto_records: { serviceWorks: OIL_ROWS, oilChangeIntervalNotes: notes },
  });
}

describe("26.11: dīlera eļļas komentārs pret eļļas tabulu", () => {
  it("cits skaits un cits diapazons - divi brīdinājumi", () => {
    const issues = checkSourceConsistency({
      sourceBlocks: oilBlocks(
        "Dīlera datubāzē fiksētas 3 <strong>dzinēja</strong> eļļas maiņas. Lielākajā daļā ciklu nobraukuma solis ir 11 200-25 000 km robežās.",
      ),
      nowMs: NOW,
    });
    const count = issues.find((i) => i.id === "ai_oil_count");
    const range = issues.find((i) => i.id === "ai_oil_range");
    expect(count?.severity).toBe("warn");
    expect(count?.values[0]?.value).toBe("4 fiksētas maiņas");
    expect(range?.values[0]?.value).toContain("7 607-47 560 km");
  });

  it("pareizs skaits un diapazons - nav brīdinājuma", () => {
    const issues = checkSourceConsistency({
      sourceBlocks: oilBlocks("Fiksētas 4 dzinēja eļļas maiņas. Nobraukuma solis starp maiņām 7 607-47 560 km."),
      nowMs: NOW,
    });
    expect(issues.filter((i) => i.kind === "ai_oil_table")).toEqual([]);
  });

  it("kārbas eļļas maiņu skaits netiek jaukts ar dzinēja eļļu", () => {
    const issues = checkSourceConsistency({ sourceBlocks: oilBlocks("Fiksētas 2 kārbas eļļas maiņas."), nowMs: NOW });
    expect(issues.filter((i) => i.kind === "ai_oil_table")).toEqual([]);
  });

  it("AI faktu lapās ir tabulas skaits un precīzais soļu diapazons", () => {
    const b = oilBlocks("");
    const code = buildDealerCodeFactsForPrompt(b, NOW);
    expect(code).toContain("Dzinēja eļļas maiņas (tā pati tabula kā PDF): 4");
    expect(code).toContain("no 7 607 km līdz 47 560 km");
    const sheet = buildCanonicalFactsSheet({ sourceBlocks: b } as never);
    expect(sheet).toContain("Dzinēja eļļas maiņas: 4");
    expect(sheet).toContain("7 607-47 560 km");
  });
});

describe("26.11: jauda - ārvalstu reģistrs pret CSDD (±5 %)", () => {
  it("DK 247 kW pret CSDD 195 kW - brīdinājums", () => {
    const issues = checkSourceConsistency({
      sourceBlocks: blocks({
        csdd: { makeModel: "MERCEDES BENZ", enginePowerKw: "195" },
        tjekbil: { statusRecords: "Jauda / piedziņa: 336 HK (247 kW) · Pilnpiedziņa" },
      }),
      nowMs: NOW,
    });
    const p = issues.find((i) => i.id === "power");
    expect(p?.severity).toBe("warn");
    expect(p?.values.map((v) => v.value)).toEqual(["195 kW", "247 kW"]);
  });

  it("5 % robežās - nav brīdinājuma", () => {
    const issues = checkSourceConsistency({
      sourceBlocks: blocks({
        csdd: { makeModel: "MERCEDES BENZ", enginePowerKw: "195" },
        tjekbil: { statusRecords: "Jauda / piedziņa: 270 HK (199 kW)" },
      }),
      nowMs: NOW,
    });
    expect(issues.find((i) => i.id === "power")).toBeUndefined();
  });
});
