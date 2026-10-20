import { describe, expect, it } from "vitest";
import { emptyIrissScanRecord } from "@/lib/iriss-scan-types";
import {
  applyIrissScanSaveResult,
  irissScanEditorHref,
  irissScanSaveFailureMessage,
  irissScanSaveRequest,
} from "@/lib/iriss-scan-editor-save";

const rec = {
  ...emptyIrissScanRecord("8dc47497-a9ba-4108-acf3-b5244f5f89b5", "2026-10-20T12:00:00.000Z"),
  brandModel: "Mercedes-Benz Sprinter H2L4",
};

describe("iriss scan editor save", () => {
  it("posts a create from /new without a persisted id", () => {
    const req = irissScanSaveRequest(rec, "");
    expect(req).toEqual({
      isCreate: true,
      method: "POST",
      url: "/api/admin/iriss-scan",
      body: { record: rec },
    });
  });

  it("keeps the filled form on the first failed save", () => {
    const applied = applyIrissScanSaveResult({
      rec,
      persistId: "",
      status: 400,
      body: { error: "empty_record" },
    });
    expect(applied.ok).toBe(false);
    expect(applied.rec).toEqual(rec);
    expect(applied.persistId).toBe("");
    expect(applied.href).toBeNull();
    expect(applied.message).toBe(irissScanSaveFailureMessage(400, "empty_record"));
  });

  it("keeps local fields on a network-style failure and on 500", () => {
    const net = applyIrissScanSaveResult({ rec, persistId: "", status: 0, body: {} });
    expect(net.ok).toBe(false);
    expect(net.rec.brandModel).toBe(rec.brandModel);
    const server = applyIrissScanSaveResult({ rec, persistId: "", status: 500, body: { error: "store_disabled" } });
    expect(server.ok).toBe(false);
    expect(server.rec).toEqual(rec);
    expect(server.message).toBe("Kļūda 500");
  });

  it("applies the saved record and editor href after a successful first save", () => {
    const saved = { ...rec, workspaceRevision: 1, brandModel: rec.brandModel };
    const applied = applyIrissScanSaveResult({
      rec,
      persistId: "",
      status: 200,
      body: { id: saved.id, record: saved },
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.rec).toEqual(saved);
    expect(applied.persistId).toBe(saved.id);
    expect(applied.href).toBe(irissScanEditorHref(saved.id));
    expect(applied.message).toBe("Saglabāts");
  });
});
