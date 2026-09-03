import { describe, expect, it } from "vitest";
import {
  addSourceBlockWipe,
  dropSourceBlockWipe,
  parseSourceBlockWipes,
  sourceBlockWipesSnapshotField,
} from "@/lib/admin-source-block-wipes";

describe("parseSourceBlockWipes", () => {
  it("keeps unique valid source keys", () => {
    expect(parseSourceBlockWipes(["autodna", "autodna", "ltab", "nope", 1])).toEqual(["autodna", "ltab"]);
  });

  it("adds and drops keys", () => {
    expect(addSourceBlockWipe(["ltab"], "csdd")).toEqual(["ltab", "csdd"]);
    expect(dropSourceBlockWipe(["ltab", "csdd"], "ltab")).toEqual(["csdd"]);
  });

  it("omits empty snapshot field", () => {
    expect(sourceBlockWipesSnapshotField([])).toEqual({});
    expect(sourceBlockWipesSnapshotField(["tirgus"])).toEqual({ sourceBlockWipes: ["tirgus"] });
  });
});
