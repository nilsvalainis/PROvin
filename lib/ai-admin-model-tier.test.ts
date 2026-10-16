import { describe, expect, it } from "vitest";
import { parseAiModelTier } from "@/lib/ai-admin-model-tier";

describe("parseAiModelTier", () => {
  it("maps haiku aliases to lite", () => {
    expect(parseAiModelTier("lite")).toBe("lite");
    expect(parseAiModelTier("Haiku")).toBe("lite");
    expect(parseAiModelTier("eco")).toBe("lite");
  });

  it("maps Gemini aliases", () => {
    expect(parseAiModelTier("gemini")).toBe("gemini");
    expect(parseAiModelTier("gemini-pro")).toBe("gemini");
    expect(parseAiModelTier("gemini-flash")).toBe("gemini-flash");
    expect(parseAiModelTier("gflash")).toBe("gemini-flash");
  });

  it("maps sonnet aliases to flash", () => {
    expect(parseAiModelTier("flash")).toBe("flash");
    expect(parseAiModelTier("sonnet")).toBe("flash");
  });

  it("maps only explicit pro/opus to pro", () => {
    expect(parseAiModelTier("pro")).toBe("pro");
    expect(parseAiModelTier("opus")).toBe("pro");
  });

  it("defaults unknown values to gemini-flash, not opus", () => {
    expect(parseAiModelTier(undefined)).toBe("gemini-flash");
    expect(parseAiModelTier("")).toBe("gemini-flash");
    expect(parseAiModelTier("unknown-tier")).toBe("gemini-flash");
    expect(parseAiModelTier(123)).toBe("gemini-flash");
  });
});
