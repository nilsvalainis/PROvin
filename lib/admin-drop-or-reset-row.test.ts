import { describe, expect, it } from "vitest";
import { dropOrResetRow } from "@/lib/admin-drop-or-reset-row";

describe("dropOrResetRow", () => {
  it("resets the last remaining row instead of leaving an empty table", () => {
    expect(dropOrResetRow([{ n: 1 }], 0, () => ({ n: 0 }))).toEqual([{ n: 0 }]);
  });

  it("removes a middle row when others remain", () => {
    expect(dropOrResetRow([{ n: 1 }, { n: 2 }, { n: 3 }], 1, () => ({ n: 0 }))).toEqual([{ n: 1 }, { n: 3 }]);
  });
});
