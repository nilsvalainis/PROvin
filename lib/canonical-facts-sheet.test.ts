import { describe, expect, it } from "vitest";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import {
  CANONICAL_FACTS_HEADER,
  CANONICAL_FACTS_MAX_CHARS,
  LARGE_ODOMETER_DROP_KM,
  buildAllCommentsContext,
  buildCanonicalFacts,
  buildOtherFieldVerdicts,
  hasRollbackOrMileageWarning,
} from "@/lib/canonical-facts-sheet";

function fixtureBlocks() {
  const blocks = createDefaultSourceBlocks();
  blocks.csdd = {
    ...blocks.csdd,
    makeModel: "BMW 320d",
    modelYear: "2016",
    firstRegistration: "22.01.2016",
    previousRegistrationCountry: "Vācija",
    ownerCountLatvia: "3",
    mileageHistory: [
      { date: "01.01.2020", odometer: "185000", country: "Vācija" },
      { date: "15.06.2020", odometer: "92000", country: "Latvija" },
    ],
  };
  blocks.carvertical = {
    ...blocks.carvertical,
    comments: "Odometer discrepancy / mileage rollback warning in the report.",
    mileagePasteRaw: "2020-01-01 185000 km\n2020-06-15 92000 km odometer anomaly",
  };
  return blocks;
}

describe("KANONISKIE FAKTI sheet", () => {
  it("puts rollback amount, owner/change counts and first-reg country/date on the sheet", () => {
    const facts = buildCanonicalFacts({
      vin: "WBA12345678901234",
      sourceBlocks: fixtureBlocks(),
    });
    expect(facts.sheet).toContain(CANONICAL_FACTS_HEADER);
    expect(facts.sheet.length).toBeLessThanOrEqual(CANONICAL_FACTS_MAX_CHARS + 80);
    expect(facts.owners.totalCount).toBe(3);
    expect(facts.owners.changeCount).toBe(2);
    expect(facts.sheet).toMatch(/Skaits:\s*3/);
    expect(facts.sheet).toMatch(/Maiņas:\s*2/);
    expect(facts.sheet).toMatch(/N īpašnieki = N-1 maiņas/);
    expect(facts.firstReg.date).toBe("22.01.2016");
    expect(facts.firstReg.countryLv).toMatch(/vācij/i);
    expect(facts.firstReg.countryIso).toBe("DE");
    expect(facts.sheet).toContain("22.01.2016");
    expect(facts.sheet).toMatch(/izcelsmes valsts:.*Vācij/);
    expect(facts.sheet).toContain("(DE)");
    expect(facts.maxRollbackDropKm).toBeGreaterThanOrEqual(LARGE_ODOMETER_DROP_KM);
    expect(facts.sheet).toMatch(/Kritums:.*185/);
    expect(facts.sheet).toMatch(/minimums/);
    expect(facts.carverticalMileageWarning).toBe(true);
    expect(hasRollbackOrMileageWarning(facts)).toBe(true);
  });

  it("treats empty previous-registration country as Latvija when a first-reg date exists", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.csdd = {
      ...blocks.csdd,
      firstRegistration: "10.03.2018",
      previousRegistrationCountry: "",
      ownerCountLatvia: "2",
      registrationNumber: "AB1234",
    };
    const facts = buildCanonicalFacts({ sourceBlocks: blocks });
    expect(facts.firstReg.countryLv).toBe("Latvija");
    expect(facts.firstReg.countryIso).toBe("LV");
    expect(facts.owners.totalCount).toBe(2);
    expect(facts.owners.changeCount).toBe(1);
    expect(facts.sheet).toContain("(LV)");
  });

  it("keeps source verdicts shorter than dumping full comments three times", () => {
    const longComment = "Nobraukuma hronoloģija\n".concat("Teksts. ".repeat(80));
    const blocks = fixtureBlocks();
    blocks.csdd = { ...blocks.csdd, comments: longComment };
    const input = {
      sourceBlocks: blocks,
      mileageComment: longComment,
      internalComment: longComment,
      irissSummary: longComment,
      technicalRiskAnalysis: longComment,
    };
    const facts = buildCanonicalFacts(input);
    const verdicts = buildOtherFieldVerdicts(input);
    const allOnce = buildAllCommentsContext(input);
    const compactSource = `${facts.sheet}\n${verdicts}`;
    const oldStyleTriple = `${allOnce}\n${allOnce}\n${allOnce}`;
    expect(compactSource.length).toBeLessThan(oldStyleTriple.length / 3);
    expect(verdicts).toMatch(/Citu lauku verdikti/);
    expect(verdicts).not.toMatch(/Teksts\. Teksts\. Teksts\. Teksts\. Teksts\. Teksts\. Teksts\. Teksts\. Teksts\. Teksts\./);
  });
});
