import { describe, expect, it } from "vitest";
import { learningEntryIsInjectable } from "@/lib/admin-audit-learnings-types";

describe("learningEntryIsInjectable", () => {
  it("injects all entries when v2 is off", () => {
    expect(learningEntryIsInjectable({ status: "candidate" }, false)).toBe(true);
    expect(learningEntryIsInjectable({ status: "approved" }, false)).toBe(true);
    expect(learningEntryIsInjectable({}, false)).toBe(true);
  });

  it("injects only approved entries when v2 is on", () => {
    expect(learningEntryIsInjectable({ status: "approved" }, true)).toBe(true);
    expect(learningEntryIsInjectable({ status: "candidate" }, true)).toBe(false);
    expect(learningEntryIsInjectable({}, true)).toBe(false);
  });
});
