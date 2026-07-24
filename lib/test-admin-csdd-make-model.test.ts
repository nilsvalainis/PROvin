import { describe, expect, it } from "vitest";
import { extractCsddMakeModelFromWorkspace } from "@/lib/admin-csdd-make-model";

describe("extractCsddMakeModelFromWorkspace", () => {
  it("returns trimmed makeModel from CSDD block", () => {
    expect(
      extractCsddMakeModelFromWorkspace({
        sourceBlocks: { csdd: { makeModel: "  MERCEDES BENZ E220  " } },
      }),
    ).toBe("MERCEDES BENZ E220");
  });

  it("returns null when missing or empty", () => {
    expect(extractCsddMakeModelFromWorkspace(null)).toBeNull();
    expect(extractCsddMakeModelFromWorkspace({})).toBeNull();
    expect(extractCsddMakeModelFromWorkspace({ sourceBlocks: { csdd: { makeModel: "  " } } })).toBeNull();
  });
});
