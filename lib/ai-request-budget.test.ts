import { describe, expect, it } from "vitest";
import {
  AI_RETRY_MIN_BUDGET_MS,
  aiAttemptTimeoutMs,
  aiBudgetAllowsRetry,
  aiBudgetRemainingMs,
  createAiRequestBudget,
} from "@/lib/ai-request-budget";

describe("ai request budget", () => {
  it("caps a single attempt to the remaining time", () => {
    const budget = { endsAt: Date.now() + 12_000 };
    expect(aiAttemptTimeoutMs(budget, 88_000)).toBeLessThanOrEqual(12_000);
    expect(aiAttemptTimeoutMs(undefined, 280_000)).toBe(280_000);
  });

  it("refuses another paid retry when the route is almost out of time", () => {
    expect(aiBudgetAllowsRetry({ endsAt: Date.now() + 5_000 })).toBe(false);
    expect(aiBudgetAllowsRetry({ endsAt: Date.now() + AI_RETRY_MIN_BUDGET_MS + 1_000 })).toBe(true);
    expect(aiBudgetAllowsRetry(undefined)).toBe(true);
  });

  it("leaves a reserve under the route maxDuration", () => {
    const budget = createAiRequestBudget(300_000);
    expect(aiBudgetRemainingMs(budget)).toBeLessThan(300_000);
    expect(aiBudgetRemainingMs(budget)).toBeGreaterThan(280_000);
  });
});
