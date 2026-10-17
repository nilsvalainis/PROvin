import { describe, expect, it } from "vitest";
import {
  allowCostBands,
  isTechRiskV2Enabled,
  parseAnthropicComponentsFromOperatorNotes,
  resolveTechRiskV2Tiers,
} from "@/lib/admin-ai-tech-pipeline-config";
import { isGeminiAdminTier } from "@/lib/ai-admin-model-tier";

function env(partial: Record<string, string>): NodeJS.ProcessEnv {
  return { NODE_ENV: "test", ...partial } as NodeJS.ProcessEnv;
}

describe("tech risk v2 config", () => {
  it("is off unless TECH_RISK_V2=1", () => {
    expect(isTechRiskV2Enabled(env({}))).toBe(false);
    expect(isTechRiskV2Enabled(env({ TECH_RISK_V2: "0" }))).toBe(false);
    expect(isTechRiskV2Enabled(env({ TECH_RISK_V2: "1" }))).toBe(true);
  });

  it("keeps cost bands off by default", () => {
    expect(allowCostBands(env({}))).toBe(false);
    expect(allowCostBands(env({ ALLOW_COST_BANDS: "1" }))).toBe(true);
  });

  it("default path is 100% Gemini (admin default tier)", () => {
    const t = resolveTechRiskV2Tiers(null);
    expect([t.facts, t.lv, t.qa].every((x) => isGeminiAdminTier(x))).toBe(true);
    expect(t.anthropicComponentsTier).toBeNull();
  });

  it("all steps follow the operator-selected Gemini tier (✨ / FLASH MAX)", () => {
    expect(resolveTechRiskV2Tiers("gemini-flash")).toEqual({
      facts: "gemini-flash",
      lv: "gemini-flash",
      qa: "gemini-flash",
      anthropicComponentsTier: null,
    });
    expect(resolveTechRiskV2Tiers("gemini").lv).toBe("gemini");
  });

  it("Claude tier is only a manual per-component hook; text and QA stay Gemini", () => {
    for (const tier of ["lite", "flash", "pro"] as const) {
      const t = resolveTechRiskV2Tiers(tier);
      expect(t.anthropicComponentsTier).toBe(tier);
      expect([t.facts, t.lv, t.qa].every((x) => isGeminiAdminTier(x))).toBe(true);
    }
  });

  it("parses Claude component list from operator notes", () => {
    expect(parseAnthropicComponentsFromOperatorNotes("labo stilu\nClaude: N57, ZF 8HP; xDrive")).toEqual([
      "N57",
      "ZF 8HP",
      "xDrive",
    ]);
    expect(parseAnthropicComponentsFromOperatorNotes("bez komandas")).toEqual([]);
  });
});
