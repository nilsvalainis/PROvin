import { describe, expect, it } from "vitest";
import { estimateAiUsd, formatAiUsd, formatAiUsageLine, summarizeAiUsage } from "@/lib/ai-usage";

describe("estimateAiUsd", () => {
  it("prices a short Sonnet call in fractions of a cent", () => {
    const usd = estimateAiUsd({
      model: "claude-sonnet-5",
      inputTokens: 2000,
      outputTokens: 400,
    });
    expect(usd).toBeGreaterThan(0);
    expect(usd).toBeLessThan(0.02);
  });

  it("makes cache reads much cheaper than fresh input", () => {
    const fresh = estimateAiUsd({
      model: "claude-opus-5",
      inputTokens: 20_000,
      outputTokens: 0,
    });
    const cached = estimateAiUsd({
      model: "claude-opus-5",
      inputTokens: 0,
      outputTokens: 0,
      cacheReadInputTokens: 20_000,
    });
    expect(cached).toBeLessThan(fresh * 0.2);
  });

  it("uses Gemini 3 Flash rates below Sonnet", () => {
    const gemini = estimateAiUsd({
      model: "gemini-3-flash-preview",
      inputTokens: 10_000,
      outputTokens: 800,
    });
    const sonnet = estimateAiUsd({
      model: "claude-sonnet-5",
      inputTokens: 10_000,
      outputTokens: 800,
    });
    expect(gemini).toBeLessThan(sonnet);
  });

  it("does not double-count Gemini cached prompt tokens", () => {
    const noCache = estimateAiUsd({
      model: "gemini-3-flash-preview",
      inputTokens: 10_000,
      outputTokens: 0,
    });
    const withCache = estimateAiUsd({
      model: "gemini-3-flash-preview",
      inputTokens: 2_000,
      outputTokens: 0,
      cacheReadInputTokens: 8_000,
    });
    expect(withCache).toBeLessThan(noCache);
  });
});

describe("formatAiUsageLine", () => {
  it("renders a compact Latvian line", () => {
    const line = formatAiUsageLine(
      summarizeAiUsage([
        {
          provider: "google",
          model: "gemini-3-flash-preview",
          inputTokens: 1000,
          outputTokens: 200,
          cacheCreationInputTokens: 0,
          cacheReadInputTokens: 0,
          usdEstimate: 0.002,
        },
      ]),
    );
    expect(line).toMatch(/≈/);
    expect(line).toMatch(/gemini-3-flash-preview/);
  });

  it("formats tiny amounts without scientific notation", () => {
    expect(formatAiUsd(0.0004)).toBe("<0,001 $");
    expect(formatAiUsd(0.004)).toMatch(/0,004/);
  });
});
