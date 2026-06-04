import { describe, expect, it } from "vitest";
import {
  parseAuditCompleteIds,
  serializeAuditCompleteIds,
  toggleAuditCompleteInSet,
} from "@/lib/admin-audit-deadline-complete";

describe("admin-audit-deadline-complete", () => {
  it("parses and serializes session ids", () => {
    const ids = new Set(["cs_test_a", "cs_test_b"]);
    const raw = serializeAuditCompleteIds(ids);
    expect(parseAuditCompleteIds(raw)).toEqual(ids);
  });

  it("toggles membership", () => {
    const a = toggleAuditCompleteInSet(new Set(), "cs_x");
    expect(a.has("cs_x")).toBe(true);
    const b = toggleAuditCompleteInSet(a, "cs_x");
    expect(b.has("cs_x")).toBe(false);
  });
});
