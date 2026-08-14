import { describe, expect, it } from "vitest";
import {
  GEMINI_MODEL_FLASH,
  GEMINI_MODEL_FLASH_25,
  GEMINI_MODEL_LEGACY_FLASH,
  GEMINI_MODEL_PRO,
  geminiFailoverModels,
  isGeminiTransientError,
} from "@/lib/gemini-model-failover";

describe("geminiFailoverModels", () => {
  it("chains pro then 3 Flash then 2.5 Flash", () => {
    expect(geminiFailoverModels(GEMINI_MODEL_PRO)).toEqual([
      GEMINI_MODEL_PRO,
      GEMINI_MODEL_FLASH,
      GEMINI_MODEL_FLASH_25,
    ]);
  });

  it("does not upgrade Flash to Pro", () => {
    expect(geminiFailoverModels(GEMINI_MODEL_FLASH)).toEqual([
      GEMINI_MODEL_FLASH,
      GEMINI_MODEL_FLASH_25,
      GEMINI_MODEL_LEGACY_FLASH,
    ]);
  });
});

describe("isGeminiTransientError", () => {
  it("detects 503 overload", () => {
    expect(isGeminiTransientError(new Error("[503 Service Unavailable] overloaded"))).toBe(true);
  });

  it("failovers when a preview model id is missing", () => {
    expect(
      isGeminiTransientError(new Error("404 models/gemini-3-flash-preview is not found for API version v1beta")),
    ).toBe(true);
  });

  it("rejects invalid API key", () => {
    expect(isGeminiTransientError(new Error("API key not valid"))).toBe(false);
  });
});
