import { describe, expect, it } from "vitest";
import {
  levenshtein,
  scoreTechRiskAbHarness,
  splitTechRiskSections,
} from "@/lib/admin-ai-tech-risk-ab-harness";

const oldText = `Sadales ķēde
Šī automašīna ir aprīkota ar N47. Remonts 800 EUR.

Kārba
Automātiskā kārba paliek uzturēšana.`;

const newText = `Sadales ķēde
N47D20 tipiski šajā posmā prasa klausīties auksto startu. Dīlera datos maiņa nav fiksēta.

Kārba
Automātiskā kārba paliek ierasta uzturēšanas izmaksa. Klātienē jāpārbauda pārslēgšanās.

EGR un ieplūde
Šim agregātam oglekļa nogulsnes ir tipiskas.

Stiprās puses
Konstrukcija ir pazīstama servisiem.`;

describe("tech risk A/B harness", () => {
  it("measures edit distance and per-section corrections", () => {
    expect(levenshtein("abc", "abc")).toBe(0);
    expect(levenshtein("abc", "ab")).toBe(1);
    expect(splitTechRiskSections(newText).length).toBeGreaterThanOrEqual(3);
    const scored = scoreTechRiskAbHarness([
      { slot: 1, id: "", label: "BMW X1", old: oldText, new: newText },
    ]);
    expect(scored.summary.slots).toBe(1);
    expect(scored.summary.withBothTexts).toBe(1);
    expect(scored.pairs[0]!.editDistance).toBeGreaterThan(0);
    expect(scored.pairs[0]!.correctionsNeeded).toBeGreaterThan(0);
    expect(scored.pairs[0]!.sections.length).toBeGreaterThan(0);
    expect(["left", "right"]).toContain(scored.pairs[0]!.blinded.newIs);
    expect(scored.pairs[0]!.iriss.techAccuracy).toBeNull();
  });
});
