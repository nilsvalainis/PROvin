import { describe, expect, it } from "vitest";
import {
  geminiGenerationConfigPayload,
  geminiThinkingExtra,
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

function assertNoSampling(payload: object) {
  expect(payload).not.toHaveProperty("temperature");
  expect(payload).not.toHaveProperty("topP");
  expect(payload).not.toHaveProperty("topK");
  expect(payload).not.toHaveProperty("top_p");
  expect(payload).not.toHaveProperty("top_k");
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
        expect(
          [cfg.thinkingLevel, cfg.thinkingBudget].filter((v) => v !== undefined),
        ).toHaveLength(1);
      }
    }
  });

  it("gives Gemini 3 a capped thinking level, never a budget or unlimited default", () => {
    expect(thinkingConfig(GEMINI_MODEL_FLASH, true)).toEqual({ thinkingLevel: "minimal" });
    expect(thinkingConfig(GEMINI_MODEL_FLASH, false)).toEqual({ thinkingLevel: "minimal" });
  });

  it("retries Gemini 2.5 with thinkingBudget 0; Gemini 3 has no second thinking pass", () => {
    expect(geminiWantsThinking(GEMINI_MODEL_FLASH)).toBe(false);
    expect(geminiWantsThinking(GEMINI_MODEL_FLASH_25)).toBe(true);
    expect(geminiWantsThinking(GEMINI_MODEL_PRO)).toBe(true);
  });

  it("keeps Gemini 2.5 on thinkingBudget (generateContent does not accept thinkingLevel)", () => {
    expect(thinkingConfig(GEMINI_MODEL_FLASH_25, true)).toEqual({ thinkingBudget: 512 });
    expect(thinkingConfig(GEMINI_MODEL_FLASH_25, false)).toEqual({ thinkingBudget: 0 });
    expect(thinkingConfig(GEMINI_MODEL_PRO, true)).toEqual({ thinkingBudget: 512 });
    expect(thinkingConfig(GEMINI_MODEL_PRO, false)).toEqual({ thinkingBudget: 0 });
  });

  /**
   * Atkāpšanās „bez domāšanas” nedrīkst nozīmēt „bez ierobežojuma”: tieši tā
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

describe("geminiGenerationConfigPayload per-model shape", () => {
  const maxOutputTokens = 32_000;

  it("gemini-3-flash-preview: thinkingLevel minimal, no budget, no sampling", () => {
    const payload = geminiGenerationConfigPayload(GEMINI_MODEL_FLASH, true, { maxOutputTokens });
    expect(payload).toEqual({
      maxOutputTokens,
      thinkingConfig: { thinkingLevel: "minimal" },
    });
    expect(payload.thinkingConfig).not.toHaveProperty("thinkingBudget");
    assertNoSampling(payload);
  });

  it("gemini-2.5-flash: thinkingBudget 512 on / 0 off (Flash can disable thinking)", () => {
    expect(geminiGenerationConfigPayload(GEMINI_MODEL_FLASH_25, true, { maxOutputTokens })).toEqual({
      maxOutputTokens,
      thinkingConfig: { thinkingBudget: 512 },
    });
    expect(geminiGenerationConfigPayload(GEMINI_MODEL_FLASH_25, false, { maxOutputTokens })).toEqual({
      maxOutputTokens,
      thinkingConfig: { thinkingBudget: 0 },
    });
    const on = geminiGenerationConfigPayload(GEMINI_MODEL_FLASH_25, true, { maxOutputTokens });
    expect(on.thinkingConfig).not.toHaveProperty("thinkingLevel");
    assertNoSampling(on);
  });

  it("gemini-2.5-pro: thinkingBudget 512 on / 0 retry, never thinkingLevel", () => {
    const on = geminiGenerationConfigPayload(GEMINI_MODEL_PRO, true, { maxOutputTokens });
    const off = geminiGenerationConfigPayload(GEMINI_MODEL_PRO, false, { maxOutputTokens });
    expect(on).toEqual({
      maxOutputTokens,
      thinkingConfig: { thinkingBudget: 512 },
    });
    expect(off).toEqual({
      maxOutputTokens,
      thinkingConfig: { thinkingBudget: 0 },
    });
    expect(on.thinkingConfig).not.toHaveProperty("thinkingLevel");
    assertNoSampling(on);
    assertNoSampling(off);
  });

  it("gemini-2.0-flash: maxOutputTokens only (valid request, no thinking fields)", () => {
    const payload = geminiGenerationConfigPayload(GEMINI_MODEL_LEGACY_FLASH, true, {
      maxOutputTokens,
    });
    expect(payload).toEqual({ maxOutputTokens });
    expect(payload).not.toHaveProperty("thinkingConfig");
    assertNoSampling(payload);
  });

  it("JSON extras stay on the payload without sampling params", () => {
    const payload = geminiGenerationConfigPayload(GEMINI_MODEL_FLASH, false, {
      maxOutputTokens,
      responseMimeType: "application/json",
      responseSchema: { type: "object" },
    });
    expect(payload).toEqual({
      maxOutputTokens,
      responseMimeType: "application/json",
      responseSchema: { type: "object" },
      thinkingConfig: { thinkingLevel: "minimal" },
    });
    assertNoSampling(payload);
  });
});
