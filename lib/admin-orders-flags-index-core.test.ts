import { describe, expect, it } from "vitest";
import {
  missingOrderFlagIds,
  needsOrderFlagsRebuild,
  parseOrderFlagsIndex,
  withOrderFlagEntries,
  withoutOrderFlagEntry,
} from "@/lib/admin-orders-flags-index-core";

const e = (complete: boolean) => ({ complete, color: null, upsell: [] });

describe("orders flags index core", () => {
  it("missing ids: all when no doc, only absent otherwise", () => {
    expect(missingOrderFlagIds(null, ["a", "b"])).toEqual(["a", "b"]);
    const doc = withOrderFlagEntries(null, { a: e(true) }, "2026-10-14T07:00:00Z");
    expect(missingOrderFlagIds(doc, ["a", "b"])).toEqual(["b"]);
  });
  it("invalidate removes entry so next read goes to source", () => {
    const doc = withOrderFlagEntries(null, { a: e(true), b: e(false) }, "2026-10-14T07:00:00Z");
    expect(missingOrderFlagIds(withoutOrderFlagEntry(doc, "a"), ["a", "b"])).toEqual(["a"]);
  });
  it("rebuild after 10 min; partial add keeps builtAt", () => {
    const doc = withOrderFlagEntries(null, {}, "2026-10-14T07:00:00Z", true);
    expect(needsOrderFlagsRebuild(doc, Date.parse("2026-10-14T07:05:00Z"))).toBe(false);
    expect(needsOrderFlagsRebuild(doc, Date.parse("2026-10-14T07:11:00Z"))).toBe(true);
    expect(withOrderFlagEntries(doc, { x: e(false) }, "2026-10-14T07:09:00Z").builtAt).toBe("2026-10-14T07:00:00Z");
    expect(needsOrderFlagsRebuild(null, 0)).toBe(true);
  });
  it("parse rejects junk", () => {
    expect(parseOrderFlagsIndex({ v: 2 })).toBeNull();
    expect(parseOrderFlagsIndex(null)).toBeNull();
  });
});
