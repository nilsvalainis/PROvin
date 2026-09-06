import { describe, expect, it } from "vitest";
import { geminiThinkingExtra, geminiWantsThinking } from "@/lib/gemini-thinking-config";
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
  /** Abi lauki kopā = 400 „You can only set only one of thinking budget and thinking level”. */
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
        expect(
          [cfg.thinkingLevel, cfg.thinkingBudget].filter((v) => v !== undefined),
        ).toHaveLength(1);
      }
    }
  });

  it("gives Gemini 3 a thinking level, never a budget", () => {
    expect(thinkingConfig(GEMINI_MODEL_FLASH, true)).toEqual({ thinkingLevel: "low" });
    expect(thinkingConfig(GEMINI_MODEL_FLASH, false)).toEqual({ thinkingLevel: "minimal" });
  });

  it("gives Gemini 2.5 a budget, never a level", () => {
    expect(thinkingConfig(GEMINI_MODEL_FLASH_25, true)).toEqual({ thinkingBudget: 512 });
    expect(thinkingConfig(GEMINI_MODEL_FLASH_25, false)).toEqual({ thinkingBudget: 0 });
    expect(thinkingConfig(GEMINI_MODEL_PRO, true)).toEqual({ thinkingBudget: 512 });
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
