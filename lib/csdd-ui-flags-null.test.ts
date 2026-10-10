import { describe, expect, it } from "vitest";
import { getInsuranceValidUntilUiFlag, getVinMismatchUiFlag } from "@/lib/csdd-ui-flags";

describe("csdd ui flags tolerate old/missing data", () => {
  it("does not throw on null/undefined", () => {
    expect(getVinMismatchUiFlag(undefined, null)).toBe("none");
    expect(getVinMismatchUiFlag("WBA12345678901234", null)).toBe("none");
    expect(getInsuranceValidUntilUiFlag(undefined)).toBe("none");
  });
});
