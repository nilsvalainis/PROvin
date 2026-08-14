import { describe, expect, it } from "vitest";
import {
  GEMINI_MODEL_FLASH,
  GEMINI_MODEL_LEGACY_FLASH,
  GEMINI_MODEL_PRO,
  geminiFailoverModels,
  isGeminiTransientError,
} from "@/lib/gemini-model-failover";

describe("geminiFailoverModels", () => {
  it("chains pro then flash then legacy", () => {
    expect(geminiFailoverModels(GEMINI_MODEL_PRO)).toEqual([
      GEMINI_MODEL_PRO,
      GEMINI_MODEL_FLASH,
      GEMINI_MODEL_LEGACY_FLASH,
    ]);
  });

  it("puts custom primary first without duplicates", () => {
    expect(geminiFailoverModels(GEMINI_MODEL_FLASH)).toEqual([
      GEMINI_MODEL_FLASH,
      GEMINI_MODEL_PRO,
      GEMINI_MODEL_LEGACY_FLASH,
    ]);
  });
});

describe("isGeminiTransientError", () => {
  it("detects 503 overload", () => {
    expect(isGeminiTransientError(new Error("[503 Service Unavailable] overloaded"))).toBe(true);
  });

  it("rejects invalid API key", () => {
    expect(isGeminiTransientError(new Error("API key not valid"))).toBe(false);
  });
});
