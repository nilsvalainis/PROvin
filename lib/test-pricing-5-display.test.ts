import { describe, expect, it } from "vitest";
import { getTp5BlockRows, isTp5BlockLocked } from "@/lib/test-pricing-5-display";

describe("test-pricing-5 display", () => {
  it("locks plus and premium when mini is active", () => {
    expect(isTp5BlockLocked("mini", "mini")).toBe(false);
    expect(isTp5BlockLocked("plus", "mini")).toBe(true);
    expect(isTp5BlockLocked("premium", "mini")).toBe(true);
  });

  it("locks only premium when plus is active", () => {
    expect(isTp5BlockLocked("premium", "plus")).toBe(true);
    expect(isTp5BlockLocked("plus", "plus")).toBe(false);
  });

  it("shows inherit MINI row in plus block when plus is active", () => {
    const rows = getTp5BlockRows("plus", "plus");
    expect(rows.some((r) => r.kind === "inherit" && r.tierName === "MINI")).toBe(true);
  });

  it("shows native premium rows without inherit when premium is active", () => {
    const rows = getTp5BlockRows("premium", "premium");
    expect(rows.some((r) => r.kind === "inherit")).toBe(false);
    expect(rows.some((r) => r.kind === "bullet" && r.label.includes("carVertical"))).toBe(true);
  });
});
