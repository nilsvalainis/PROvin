import { describe, expect, it } from "vitest";
import {
  isAutoSourcesComparisonEnabled,
  PREPARE_DRAFT_SOURCES_COMPARISON_OFF_DETAIL,
} from "@/lib/admin-sources-comparison-config";

function env(partial: Record<string, string>): NodeJS.ProcessEnv {
  return { NODE_ENV: "test", ...partial } as NodeJS.ProcessEnv;
}

describe("PROVIN_AUTO_SOURCES_COMPARISON", () => {
  it("is off by default and reports izslēgts", () => {
    expect(isAutoSourcesComparisonEnabled(env({}))).toBe(false);
    expect(isAutoSourcesComparisonEnabled(env({ PROVIN_AUTO_SOURCES_COMPARISON: "0" }))).toBe(false);
    expect(isAutoSourcesComparisonEnabled(env({ PROVIN_AUTO_SOURCES_COMPARISON: "1" }))).toBe(true);
    expect(PREPARE_DRAFT_SOURCES_COMPARISON_OFF_DETAIL).toBe("izslēgts");
  });
});
