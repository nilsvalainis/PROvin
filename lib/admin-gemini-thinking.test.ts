import { describe, expect, it } from "vitest";
import {
  geminiThinkingExtra,
  geminiThinkingLevelForBudget,
  geminiWantsThinking,
} from "@/lib/gemini-thinking-config";
import {
  GEMINI_MODEL_FLASH,
  GEMINI_MODEL_FLASH_25,
  GEMINI_MODEL_LEGACY_FLASH,
  GEMINI_MODEL_PRO,
} from "@/lib/gemini-model-failover";

type ThinkingConfig = { thinkingLevel?: string; thinkingBudget?: number };

function thinkingConfig(model: string, enabled: boolean): ThinkingConfig | undefined {
  return (geminiThinkingExtra(model, enabled) as { thinkingConfig?: ThinkingConfig }).thinkingConfig;
}

describe("geminiThinkingExtra", () => {
  it("never sends thinking level and thinking budget together", () => {
    for (const model of [
      GEMINI_MODEL_FLASH,
      GEMINI_MODEL_FLASH_25,
      GEMINI_MODEL_PRO,
      GEMINI_MODEL_LEGACY_FLASH,
    ]) {
      for (const enabled of [true, false]) {
        const cfg = thinkingConfig(model, enabled);
        if (!cfg) continue;
        expect(cfg.thinkingBudget).toBeUndefined();
        expect(cfg.thinkingLevel).toEqual(expect.any(String));
      }
    }
  });

  it("gives Gemini 3 a capped thinking level, never a budget or unlimited default", () => {
    expect(thinkingConfig(GEMINI_MODEL_FLASH, true)).toEqual({ thinkingLevel: "minimal" });
    expect(thinkingConfig(GEMINI_MODEL_FLASH, false)).toEqual({ thinkingLevel: "minimal" });
  });

  it("does not retry when enabled and disabled configs are the same", () => {
    expect(geminiWantsThinking(GEMINI_MODEL_FLASH)).toBe(false);
    expect(geminiWantsThinking(GEMINI_MODEL_FLASH_25)).toBe(false);
    expect(geminiWantsThinking(GEMINI_MODEL_PRO)).toBe(false);
  });

  it("maps Gemini 2.5 former budgets onto thinkingLevel low (no minimal on 2.5)", () => {
    expect(thinkingConfig(GEMINI_MODEL_FLASH_25, true)).toEqual({ thinkingLevel: "low" });
    expect(thinkingConfig(GEMINI_MODEL_FLASH_25, false)).toEqual({ thinkingLevel: "low" });
    expect(thinkingConfig(GEMINI_MODEL_PRO, true)).toEqual({ thinkingLevel: "low" });
    expect(thinkingConfig(GEMINI_MODEL_PRO, false)).toEqual({ thinkingLevel: "low" });
  });

  it("maps former thinking budgets onto supported levels", () => {
    expect(geminiThinkingLevelForBudget(GEMINI_MODEL_FLASH, 0)).toBe("minimal");
    expect(geminiThinkingLevelForBudget(GEMINI_MODEL_FLASH, 512)).toBe("minimal");
    expect(geminiThinkingLevelForBudget(GEMINI_MODEL_FLASH, 24576)).toBe("minimal");
    expect(geminiThinkingLevelForBudget(GEMINI_MODEL_FLASH_25, 0)).toBe("low");
    expect(geminiThinkingLevelForBudget(GEMINI_MODEL_FLASH_25, 512)).toBe("low");
    expect(geminiThinkingLevelForBudget(GEMINI_MODEL_PRO, 512)).toBe("low");
    expect(geminiThinkingLevelForBudget(GEMINI_MODEL_FLASH_25, 4096)).toBe("medium");
    expect(geminiThinkingLevelForBudget(GEMINI_MODEL_PRO, 24576)).toBe("high");
  });

  /**
   * Atkāpšanās „bez domāšanas” nedrīkst nozīmēt „bez ierobežojuma” — tieši tā
   * domāšana apēda izeju un lauks palika tukšs par pilnu cenu.
   */
  it("keeps the no-thinking pass explicitly capped for thinking models", () => {
    expect(thinkingConfig(GEMINI_MODEL_FLASH, false)).toBeDefined();
    expect(thinkingConfig(GEMINI_MODEL_FLASH_25, false)).toBeDefined();
  });

  it("sends no thinking config to models without thinking", () => {
    expect(geminiWantsThinking(GEMINI_MODEL_LEGACY_FLASH)).toBe(false);
    expect(geminiThinkingExtra(GEMINI_MODEL_LEGACY_FLASH, true)).toEqual({});
    expect(geminiThinkingExtra(GEMINI_MODEL_LEGACY_FLASH, false)).toEqual({});
  });
});
