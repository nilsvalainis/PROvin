import { describe, expect, it } from "vitest";

import {
  applyFeedbackToFactFlags,
  applyFeedbackToSourceIssues,
  computeRuleFeedbackStats,
  contradictionFeedbackLogPath,
  contradictionWeeklyPushBody,
  factFlagFingerprint,
  factRuleOf,
  neverAutoDowngrade,
  parseContradictionFeedback,
  sourceIssueFingerprint,
  upsertContradictionFeedback,
  type ContradictionFeedbackLogLine,
} from "@/lib/contradiction-feedback";
import { normalizeOrderWorkspacePersistBody } from "@/lib/admin-order-workspace-persist";
import type { SourceIssue } from "@/lib/source-consistency";
import type { FactCheckFlag } from "@/lib/unit-facts/types";

const VIN = "WBA51AJ080CF92074";

const drop: SourceIssue = {
  id: "mileage_drop_AUTODNA_CSDD_01.07.2022_05.03.2023",
  kind: "mileage_drop",
  severity: "critical",
  title: "Nobraukums samazinās starp avotiem, −12 000 km",
  values: [
    { source: "AutoDNA", value: "207 000 km (01.07.2022)" },
    { source: "CSDD", value: "195 040 km (05.03.2023)" },
  ],
};

describe("pirkstu nospiedumi", () => {
  it("avotu brīdinājums: avotu secība un km līdz 100 nemaina fp", () => {
    const a = sourceIssueFingerprint(drop, VIN);
    const b = sourceIssueFingerprint(
      { ...drop, values: [{ source: "CSDD", value: "195 010 km (05.03.2023)" }, drop.values[0]!] },
      VIN,
    );
    expect(a.fp).toBe(b.fp);
    expect(a.pair).toBe("AUTODNA+CSDD");
    expect(sourceIssueFingerprint(drop, "WAUZZZ8K1BA009291").fp).not.toBe(a.fp);
  });

  it("teksta brīdinājums: cipari teikumā nemaina fp; noteikums bez skaitļa astes", () => {
    const f1 = factFlagFingerprint({ id: "csdd_foreign_mileage_154900", sentence: "Pie 154 900 km nomainīts." }, VIN);
    const f2 = factFlagFingerprint({ id: "csdd_foreign_mileage_154000", sentence: "Pie 154 000 km nomainīts." }, VIN);
    expect(f1.fp).toBe(f2.fp);
    expect(f1.rule).toBe("csdd_foreign_mileage");
    expect(factRuleOf("odo_rollback_v2|rollback|2024-06-01|120000|CSDD")).toBe("odo_rollback");
  });
});

describe("lēmumi pasūtījumā", () => {
  it("upsert aizstāj, atkārtots tas pats lēmums atsauc", () => {
    const e = { fp: "x", rule: "km_mismatch", origin: "fact" as const, verdict: "dismiss" as const, at: "2026-11-24T10:00:00Z" };
    const one = upsertContradictionFeedback(undefined, e);
    expect(one).toHaveLength(1);
    expect(upsertContradictionFeedback(one, { ...e, verdict: "confirm" })[0]!.verdict).toBe("confirm");
    expect(upsertContradictionFeedback(one, e)).toEqual([]);
  });

  it("parse: nederīgas rindas izmet, vecais melnraksts bez lauka paliek undefined", () => {
    expect(parseContradictionFeedback(undefined)).toBeUndefined();
    expect(parseContradictionFeedback([{ fp: "a", rule: "r", verdict: "nope" }, { fp: "b", rule: "r", verdict: "confirm" }])).toHaveLength(1);
  });

  it("persistence: normalizācija saglabā lēmumus", () => {
    const body = normalizeOrderWorkspacePersistBody({
      contradictionFeedback: [{ fp: "a", rule: "km_mismatch", origin: "fact", verdict: "dismiss", at: "2026-11-24T10:00:00Z" }],
    } as never);
    expect((body as { contradictionFeedback?: unknown[] }).contradictionFeedback).toHaveLength(1);
  });

  it("tam pašam VIN noraidītais avotu brīdinājums - info ar datumu, nebloķē", () => {
    const { fp } = sourceIssueFingerprint(drop, VIN);
    const out = applyFeedbackToSourceIssues([drop], {
      vin: VIN,
      entries: [{ fp, rule: "mileage_drop", origin: "source", verdict: "dismiss", at: "2026-11-24T10:00:00Z" }],
    });
    expect(out[0]!.severity).toBe("info");
    expect(out[0]!.originalSeverity).toBe("critical");
    expect(out[0]!.verdictAt).toBe("2026-11-24T10:00:00Z");
  });

  it("noraidīts teksta brīdinājums kļūst I (neskaitās kā E)", () => {
    const flag: FactCheckFlag = { id: "no_damage_claim", kind: "no_damage_claim", level: "E", message: "m", sentence: "Bojājumu nav." };
    const { fp } = factFlagFingerprint(flag, VIN);
    const out = applyFeedbackToFactFlags([flag], {
      vin: VIN,
      entries: [{ fp, rule: "no_damage_claim", origin: "fact", verdict: "dismiss", at: "2026-11-24T10:00:00Z" }],
    });
    expect(out[0]!.level).toBe("I");
  });
});

describe("automātiska pazemināšana", () => {
  const now = Date.parse("2026-11-24T12:00:00Z");
  const line = (i: number, verdict: "dismiss" | "confirm", rule = "km_mismatch", pair?: string): ContradictionFeedbackLogLine => ({
    fp: `fp${i}`,
    rule,
    origin: "fact",
    verdict,
    at: new Date(now - i * 3_600_000).toISOString(),
    vin: `VIN${i}`,
    ...(pair ? { pair } : {}),
  });

  it("≥5 lēmumi un ≥80 % noraidīti - pazemina par pakāpi", () => {
    const lines = [0, 1, 2, 3].map((i) => line(i, "dismiss")).concat(line(4, "confirm"));
    const stats = computeRuleFeedbackStats(lines, now);
    expect(stats[0]!.autoDowngrade).toBe(true);
    const flag: FactCheckFlag = { id: "km_mismatch", kind: "contradiction", level: "W", message: "m", sentence: "s" };
    expect(applyFeedbackToFactFlags([flag], { vin: "X", entries: [], downgraded: ["km_mismatch"] })[0]!.level).toBe("I");
    const few = computeRuleFeedbackStats(lines.slice(0, 4), now);
    expect(few[0]!.autoDowngrade).toBe(false);
  });

  it("izņēmumi: reģistrs pret reģistru kritums, atsaukumi, iekšējās piezīmes, marka", () => {
    expect(neverAutoDowngrade("mileage_drop", "CSDD+ZVIEDRIJAS REĢISTRI")).toBe(true);
    expect(neverAutoDowngrade("mileage_drop", "AUTODNA+CSDD")).toBe(false);
    expect(neverAutoDowngrade("recall_denied")).toBe(true);
    expect(neverAutoDowngrade("c10_internal_note")).toBe(true);
    expect(neverAutoDowngrade("make")).toBe(true);
    const lines = [0, 1, 2, 3, 4].map((i) => line(i, "dismiss", "mileage_drop", "CSDD+ZVIEDRIJAS REĢISTRI"));
    expect(computeRuleFeedbackStats(lines, now)[0]!.autoDowngrade).toBe(false);
    const issue = applyFeedbackToSourceIssues(
      [{ ...drop, values: [{ source: "CSDD", value: "1" }, { source: "ZVIEDRIJAS REĢISTRI", value: "2" }] }],
      { vin: VIN, entries: [], downgraded: ["mileage_drop|CSDD+ZVIEDRIJAS REĢISTRI", "mileage_drop"] },
    );
    expect(issue[0]!.severity).toBe("critical");
  });

  it("nedēļas push teksts un žurnāla ceļš", () => {
    const stats = computeRuleFeedbackStats([0, 1, 2].map((i) => line(i, "dismiss")), now, 7);
    expect(contradictionWeeklyPushBody(stats, [])).toContain("km_mismatch 3/3");
    expect(contradictionWeeklyPushBody([], [])).toBe("");
    expect(contradictionFeedbackLogPath("2026-11-24T10:00:00Z")).toBe("admin-contradiction-feedback/2026-11.jsonl");
  });
});
