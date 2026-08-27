import { describe, expect, it } from "vitest";
import { mergePdfVisibility } from "@/lib/pdf-visibility";

describe("mergePdfVisibility", () => {
  it("does not let saved unified flags hide the history hub", () => {
    const vis = mergePdfVisibility({ unifiedMileage: false, unifiedIncidents: false });
    expect(vis.unifiedMileage).toBe(true);
    expect(vis.unifiedIncidents).toBe(true);
  });
});
