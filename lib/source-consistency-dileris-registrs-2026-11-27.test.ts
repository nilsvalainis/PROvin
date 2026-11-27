import { describe, expect, it } from "vitest";

import { mergeSourceBlocksWithDefaults, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { buildDealerQualityGateInput, evaluateDealerQualityGate } from "@/lib/dealer-quality-gate";
import { checkSourceConsistency, formatSourceIssueLine, type SourceIssue } from "@/lib/source-consistency";

/**
 * BF 27.11.2026 (S1): lielākais oficiālā dīlera nobraukums > vēlāks reģistra rādījums - neviens AI komentārs
 * to neminēja. Deterministisks brīdinājums adminā un ēnu pārbaudē. Anonimizētas struktūras
 * (Mercedes: dīleris 2023 324 067 km pret CSDD 2026 287 469 km; BMW: dīleris 2016 216 612 km pret CSDD 2022 189 261 km).
 */
const NOW = Date.UTC(2026, 10, 27);

function blocks(patch: Record<string, unknown>): WorkspaceSourceBlocks {
  return mergeSourceBlocksWithDefaults(patch as unknown);
}

const work = (date: string, odometer: string, works = "Apkope") => ({ date, odometer, location: "", works });

function dealerBlock(rows: ReturnType<typeof work>[]) {
  return { auto_records: { serviceWorks: rows } };
}

function csdd(rows: { date: string; odometer: string }[]) {
  return {
    csdd: {
      makeModel: "BMW 320D",
      registrationNumber: "XX0000",
      firstRegistration: "2008-10-13",
      mileageHistory: rows.map((r) => ({ ...r, country: "Latvija" })),
    },
  };
}

function run(patch: Record<string, unknown>): SourceIssue[] {
  return checkSourceConsistency({ sourceBlocks: blocks(patch), nowMs: NOW });
}

const pick = (issues: SourceIssue[]) => issues.filter((i) => i.kind === "dealer_registry_mileage");

describe("dīleris pret vēlāku reģistra km (BF 27.11, S1)", () => {
  it("BMW: dīleris 2016 216 612 km, CSDD 2022 189 261 km -> kritisks brīdinājums ar abiem avotiem", () => {
    const issues = pick(
      run({
        ...dealerBlock([
          work("23.03.2016", "216612"),
          work("27.07.2015", "203689"),
          work("15.12.2011", "138274"),
          work("28.10.2010", "101104"),
        ]),
        ...csdd([
          { date: "10.10.2026", odometer: "212270" },
          { date: "11.11.2024", odometer: "199455" },
          { date: "18.10.2022", odometer: "189261" },
        ]),
      }),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]!.severity).toBe("critical");
    expect(issues[0]!.title).toBe(
      "Iespējama nobraukuma pretruna: 216 612 km (23.03.2016, dīleris) pret 189 261 km (18.10.2022, CSDD)",
    );
    expect(formatSourceIssueLine(issues[0]!)).toContain("216 612 km (23.03.2016)");
  });

  it("vēlākie reģistra km lielāki par dīlera km - nav pretrunas", () => {
    const issues = pick(
      run({
        ...dealerBlock([work("23.03.2016", "150000"), work("27.07.2015", "140000")]),
        ...csdd([{ date: "18.10.2022", odometer: "189261" }]),
      }),
    );
    expect(issues).toEqual([]);
  });

  it("viens dīlera izlecējs (pārrakstīšanās) nav salīdzināšanas punkts", () => {
    const issues = pick(
      run({
        ...dealerBlock([
          work("10.01.2015", "100000"),
          work("10.01.2016", "912000"),
          work("10.01.2017", "120000"),
          work("10.01.2018", "140000"),
        ]),
        ...csdd([{ date: "10.01.2022", odometer: "190000" }]),
      }),
    );
    expect(issues).toEqual([]);
  });

  it("mazs kritums (zem 1 000 km / 2 %) - nekas; reģistrs pirms dīlera - nekas", () => {
    expect(
      pick(run({ ...dealerBlock([work("23.03.2016", "190500")]), ...csdd([{ date: "18.10.2022", odometer: "190000" }]) })),
    ).toEqual([]);
    expect(
      pick(run({ ...dealerBlock([work("23.03.2023", "216612")]), ...csdd([{ date: "18.10.2022", odometer: "189261" }]) })),
    ).toEqual([]);
  });

  it("ēnu pārbaude: pretruna redzama «Pretrunas ar datiem» (brīdinājums)", () => {
    const sourceBlocks = blocks({
      ...dealerBlock([work("23.03.2016", "216612"), work("27.07.2015", "203689")]),
      ...csdd([{ date: "18.10.2022", odometer: "189261" }]),
    });
    const input = buildDealerQualityGateInput({
      job: { vin: "WBA00000000000000", status: "done" },
      sourceBlocks,
      pdf: null,
      nowMs: NOW,
    });
    const gate = evaluateDealerQualityGate(input, { nowIso: new Date(NOW).toISOString() });
    const c = gate.checks.find((x) => x.id === "contradictions");
    expect(c?.state).toBe("fail");
    expect(c?.severity).toBe("warn");
    expect(c?.reason).toContain("Iespējama nobraukuma pretruna: 216 612 km (23.03.2016, dīleris)");
  });
});
