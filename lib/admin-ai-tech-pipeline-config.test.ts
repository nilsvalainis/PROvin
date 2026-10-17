import { describe, expect, it } from "vitest";
import {
  allowCostBands,
  isTechRiskV2Enabled,
  TECH_PIPELINE,
} from "@/lib/admin-ai-tech-pipeline-config";

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

  it("uses cheap facts, Gemini 2.5 Pro for LV, Flash for QA, never Opus", () => {
    expect(TECH_PIPELINE.technical_risks.facts).toBe("lite");
    expect(TECH_PIPELINE.technical_risks.lv).toBe("gemini");
    expect(TECH_PIPELINE.technical_risks.qa).toBe("gemini-flash");
    expect(TECH_PIPELINE.technical_risks.facts).not.toBe("pro");
    expect(TECH_PIPELINE.technical_risks.lv).not.toBe("pro");
    expect(TECH_PIPELINE.technical_risks.qa).not.toBe("pro");
  });
});
