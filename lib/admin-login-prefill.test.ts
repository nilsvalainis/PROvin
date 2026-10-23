import { describe, expect, it } from "vitest";
import { resolveLoginEmailPrefill } from "@/lib/admin-login-prefill";

describe("resolveLoginEmailPrefill", () => {
  it("returns a trimmed plausible email", () => {
    expect(resolveLoginEmailPrefill(" toms.paraugs@example.lv ")).toBe("toms.paraugs@example.lv");
  });

  it("ignores missing, non-string and implausible values", () => {
    expect(resolveLoginEmailPrefill(undefined)).toBeNull();
    expect(resolveLoginEmailPrefill(["a@b.lv"])).toBeNull();
    expect(resolveLoginEmailPrefill("admin")).toBeNull();
    expect(resolveLoginEmailPrefill("a@b")).toBeNull();
    expect(resolveLoginEmailPrefill(`${"a".repeat(250)}@example.lv`)).toBeNull();
  });
});
