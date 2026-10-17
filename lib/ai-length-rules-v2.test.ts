import { afterEach, describe, expect, it } from "vitest";
import {
  AI_LENGTH_WORDING_RULES_V2,
  evaluateLengthRulesV2,
  isIceVehicleFromPrompt,
  LENGTH_RULES_V2_CHEAP_RETRY_CODES,
  LENGTH_RULES_V2_CRITICAL_RETRY_CODES,
} from "@/lib/ai-length-rules-v2";
import { commentLengthBudgetForField, COMMENT_LENGTH_BUDGET } from "@/lib/ai-comment-length-budget";
import { evaluateExpertCommentQuality } from "@/lib/ai-eval/comment-quality";

describe("length rules v2", () => {
  afterEach(() => {
    delete process.env.LENGTH_RULES_V2;
  });

  it("keeps default budgets when the flag is off", () => {
    expect(COMMENT_LENGTH_BUDGET.technical_risks.maxChars).toBe(16_000);
    expect(commentLengthBudgetForField("technical_risks").maxChars).toBe(16_000);
    expect(commentLengthBudgetForField("summary").maxChars).toBe(1800);
  });

  it("tightens TR and summary budgets when LENGTH_RULES_V2=1", () => {
    process.env.LENGTH_RULES_V2 = "1";
    expect(commentLengthBudgetForField("technical_risks").maxChars).toBe(3200);
    expect(commentLengthBudgetForField("technical_risks").targetChars).toMatch(/1200-2500/);
    expect(commentLengthBudgetForField("summary").maxChars).toBe(900);
    expect(COMMENT_LENGTH_BUDGET.technical_risks.maxChars).toBe(16_000);
  });

  it("G1 regenerates TR over 3200 chars and warns under 1000", () => {
    process.env.LENGTH_RULES_V2 = "1";
    const long = "A".repeat(3300);
    expect(evaluateLengthRulesV2(long, "technical_risks").some((i) => i.code === "g1_tr_length_regen")).toBe(
      true,
    );
    const short = "Ķēde aizmugurē. ".repeat(10);
    expect(evaluateLengthRulesV2(short, "technical_risks").some((i) => i.code === "g1_tr_length_warn")).toBe(
      true,
    );
  });

  it("G2 regenerates a summary over 900 chars", () => {
    process.env.LENGTH_RULES_V2 = "1";
    const text = "Fakti. ".repeat(200);
    expect(evaluateLengthRulesV2(text, "summary").some((i) => i.code === "g2_summary_length_regen")).toBe(true);
  });

  it("G3 requires Nākamajos 100 000 km for ICE", () => {
    process.env.LENGTH_RULES_V2 = "1";
    const body = [
      "Ķēde aizmugurē.",
      "EGR dzesētājs.",
      "Kārbas eļļa.",
      "Turbo aktuators.",
    ].join("\n\n") + " " + "teksts ".repeat(80);
    const ice = evaluateLengthRulesV2(body, "technical_risks", {
      sourcePrompt: "Identificētais auto (CSDD): BMW 530d, Dīzeļdegviela",
    });
    expect(isIceVehicleFromPrompt("Dīzeļdegviela")).toBe(true);
    expect(ice.some((i) => i.code === "g3_missing_next_100k")).toBe(true);
    const withHeading = `${body}\n\nNākamajos 100 000 km\nĶēde paliek uzmanības punkts.`;
    expect(
      evaluateLengthRulesV2(withHeading, "technical_risks", {
        sourcePrompt: "Dīzeļdegviela",
      }).some((i) => i.code === "g3_missing_next_100k"),
    ).toBe(false);
    expect(isIceVehicleFromPrompt("BEV elektroauto, battery electric")).toBe(false);
  });

  it("G4 flags imperative wording", () => {
    process.env.LENGTH_RULES_V2 = "1";
    const text = "Ķēdi noteikti jāmaina. Iegāde netiek rekomendēta. " + "fakti ".repeat(80);
    const issues = evaluateLengthRulesV2(text, "technical_risks");
    expect(issues.some((i) => i.code === "g4_imperative_wording")).toBe(true);
  });

  it("consultative wording is always-on for TR even when G4 flag is off", () => {
    const text = "Iegāde netiek rekomendēta. " + "ķēde ".repeat(40);
    expect(
      evaluateExpertCommentQuality(text, { field: "technical_risks" }).some(
        (i) => i.code === "consultative_wording",
      ),
    ).toBe(true);
    expect(
      evaluateExpertCommentQuality("Virsbūve jāpārbauda klātienē ar krāsas biezuma mērītāju.", {
        field: "inspection",
      }).every((i) => i.code !== "consultative_wording"),
    ).toBe(true);
  });

  it("G4 is a cheap Gemini retry, G3 stays on the same model", () => {
    expect(LENGTH_RULES_V2_CHEAP_RETRY_CODES.has("g4_imperative_wording")).toBe(true);
    expect(LENGTH_RULES_V2_CRITICAL_RETRY_CODES.has("g3_missing_next_100k")).toBe(true);
    expect(LENGTH_RULES_V2_CRITICAL_RETRY_CODES.has("g4_imperative_wording")).toBe(false);
  });

  it("quality harness picks up G codes only when the flag is on", () => {
    const text = "obligāti jāmaina ķēde. " + "x".repeat(50);
    expect(evaluateExpertCommentQuality(text, { field: "technical_risks" }).every((i) => i.code !== "g4_imperative_wording")).toBe(
      true,
    );
    process.env.LENGTH_RULES_V2 = "1";
    expect(
      evaluateExpertCommentQuality(text, { field: "technical_risks" }).some((i) => i.code === "g4_imperative_wording"),
    ).toBe(true);
  });

  it("prompt block contains the operator-facing rules", () => {
    expect(AI_LENGTH_WORDING_RULES_V2).toMatch(/1200-2500|1 200-2 500/);
    expect(AI_LENGTH_WORDING_RULES_V2).toMatch(/Nākamajos 100 000 km/);
    expect(AI_LENGTH_WORDING_RULES_V2).toMatch(/Fakti/);
    expect(AI_LENGTH_WORDING_RULES_V2).toMatch(/Mūsu ieteikums/);
    expect(AI_LENGTH_WORDING_RULES_V2).toMatch(/iesakām/);
    expect(AI_LENGTH_WORDING_RULES_V2).toMatch(/Pēc pieejamajiem datiem mūsu ieteikums/);
  });
});
