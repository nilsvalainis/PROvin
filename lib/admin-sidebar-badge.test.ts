import { describe, expect, it } from "vitest";
import { finiteBadgeCount } from "@/lib/admin-sidebar-badge";

describe("finiteBadgeCount", () => {
  it("keeps a finite irissMatchCount and drops anything else", () => {
    expect(finiteBadgeCount(3)).toBe(3);
    expect(finiteBadgeCount(3.8)).toBe(3);
    expect(finiteBadgeCount(0)).toBe(0);
    expect(finiteBadgeCount(-2)).toBe(0);
    expect(finiteBadgeCount(Number.NaN)).toBe(0);
    expect(finiteBadgeCount(null)).toBe(0);
    expect(finiteBadgeCount(undefined)).toBe(0);
    expect(finiteBadgeCount({ unseenCount: 4 })).toBe(0);
    expect(finiteBadgeCount("12")).toBe(0);
  });
});
