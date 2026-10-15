import { describe, expect, it } from "vitest";
import { IRISS_STALE_REVISION, mergeIrissScanRecords, prepareIrissScanWrite } from "@/lib/iriss-scan-save-safety";
import { emptyIrissScanRecord } from "@/lib/iriss-scan-types";

describe("prepareIrissScanWrite", () => {
  it("bumps revision on first write", () => {
    const incoming = emptyIrissScanRecord("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", "2026-10-14T10:00:00.000Z");
    const r = prepareIrissScanWrite(null, incoming, null, "2026-10-15T10:00:00.000Z");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.record.workspaceRevision).toBe(1);
    expect(r.record.updatedAt).toBe("2026-10-15T10:00:00.000Z");
  });

  it("returns stale_revision when expected revision does not match", () => {
    const existing = {
      ...emptyIrissScanRecord("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", "2026-10-14T10:00:00.000Z"),
      workspaceRevision: 3,
      brandModel: "Servera Golf",
    };
    const incoming = { ...existing, brandModel: "Lokālais Golf", workspaceRevision: 2 };
    const r = prepareIrissScanWrite(existing, incoming, 2, "2026-10-15T10:00:00.000Z");
    expect(r).toEqual({ ok: false, error: IRISS_STALE_REVISION, record: existing });
  });

  it("accepts a matching expected revision", () => {
    const existing = {
      ...emptyIrissScanRecord("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", "2026-10-14T10:00:00.000Z"),
      workspaceRevision: 3,
    };
    const incoming = { ...existing, vin: "1HGCM82633A004352" };
    const r = prepareIrissScanWrite(existing, incoming, 3, "2026-10-15T10:00:00.000Z");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.record.workspaceRevision).toBe(4);
    expect(r.record.vin).toBe("1HGCM82633A004352");
    expect(r.record.createdAt).toBe(existing.createdAt);
  });

  it("merges filled local fields over empty server ones", () => {
    const server = {
      ...emptyIrissScanRecord("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", "2026-10-14T10:00:00.000Z"),
      workspaceRevision: 2,
      brandModel: "Golf",
    };
    const local = {
      ...emptyIrissScanRecord("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", "2026-10-14T10:00:00.000Z"),
      vin: "1HGCM82633A004352",
      listingLinkAuto1: ["https://auto1.com/x"],
    };
    const merged = mergeIrissScanRecords(server, local);
    expect(merged.brandModel).toBe("Golf");
    expect(merged.vin).toBe("1HGCM82633A004352");
    expect(merged.listingLinkAuto1).toEqual(["https://auto1.com/x"]);
    expect(merged.workspaceRevision).toBe(2);
  });
});
