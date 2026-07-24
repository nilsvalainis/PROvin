import { describe, expect, it } from "vitest";
import {
  ADMIN_AUDIT_COMPLETE_STORAGE_KEY,
  parseAuditCompleteIds,
  serializeAuditCompleteIds,
  setAuditCompleteInLocalCache,
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

  it("setAuditCompleteInLocalCache writes expected set", () => {
    const store = new Map<string, string>();
    setAuditCompleteInLocalCache(
      "cs_1",
      true,
      (k) => store.get(k) ?? null,
      (k, v) => {
        store.set(k, v);
      },
    );
    expect(parseAuditCompleteIds(store.get(ADMIN_AUDIT_COMPLETE_STORAGE_KEY) ?? null).has("cs_1")).toBe(
      true,
    );
    setAuditCompleteInLocalCache(
      "cs_1",
      false,
      (k) => store.get(k) ?? null,
      (k, v) => {
        store.set(k, v);
      },
    );
    expect(parseAuditCompleteIds(store.get(ADMIN_AUDIT_COMPLETE_STORAGE_KEY) ?? null).has("cs_1")).toBe(
      false,
    );
  });
});
