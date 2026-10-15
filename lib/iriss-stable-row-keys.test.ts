import { describe, expect, it } from "vitest";
import { nextStableRowKeys } from "@/lib/iriss-stable-row-keys";

describe("nextStableRowKeys", () => {
  it("keeps surviving keys when a middle row is removed", () => {
    const prev = ["a", "b", "c"];
    expect(nextStableRowKeys(prev, 2, 1)).toEqual(["a", "c"]);
  });

  it("appends a new key when a row is added", () => {
    const next = nextStableRowKeys(["a"], 2);
    expect(next).toHaveLength(2);
    expect(next[0]).toBe("a");
    expect(next[1]).toBeTruthy();
    expect(next[1]).not.toBe("a");
  });
});
