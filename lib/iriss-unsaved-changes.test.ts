import { describe, expect, it } from "vitest";
import { irissInternalAdminHref, irissRecordIsDirty } from "@/lib/iriss-unsaved-changes";

describe("iriss unsaved changes", () => {
  it("treats different snapshots as dirty", () => {
    expect(irissRecordIsDirty("{}", "{}")).toBe(false);
    expect(irissRecordIsDirty('{"a":1}', '{"a":2}')).toBe(true);
  });

  it("keeps same-origin admin paths and drops external links", () => {
    expect(irissInternalAdminHref("/admin/iriss/pasutijumi")).toBe("/admin/iriss/pasutijumi");
    expect(irissInternalAdminHref("#x")).toBeNull();
    expect(irissInternalAdminHref("https://example.com/admin")).toBeNull();
  });
});
