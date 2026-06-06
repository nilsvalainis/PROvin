import { describe, expect, it } from "vitest";
import { getStackBlocksViewState } from "@/lib/test-pricing-stack-blocks";

describe("getStackBlocksViewState", () => {
  it("premium lights up all blocks", () => {
    const s = getStackBlocksViewState("premium");
    expect(s.mini).toBe("active");
    expect(s.plus).toBe("active");
    expect(s.premium).toBe("active");
    expect(s.warningText).toBeUndefined();
  });

  it("plus fades premium block with warning", () => {
    const s = getStackBlocksViewState("plus");
    expect(s.premium).toBe("faded");
    expect(s.warningText).toContain("CarVertical");
  });

  it("mini fades plus and premium with warning", () => {
    const s = getStackBlocksViewState("mini");
    expect(s.plus).toBe("faded");
    expect(s.premium).toBe("faded");
    expect(s.warningText).toContain("Vēstures atskaites");
  });
});
