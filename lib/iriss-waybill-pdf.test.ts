import { describe, expect, it } from "vitest";
import {
  waybillDropboxFileName,
  waybillPdfAllowed,
  waybillPdfDownloadHref,
  waybillPdfIndexId,
  waybillRequestHasPdf,
  withWaybillPdfAccess,
} from "@/lib/iriss-waybill-pdf";
import { parseWaybillRequest, type WaybillAivarsReply, type WaybillRequest } from "@/lib/iriss-waybill-requests";
import { waybillMobileRequestRows } from "@/lib/iriss-waybill-mobile-form";

function req(over: Partial<WaybillRequest> & Record<string, unknown>): WaybillRequest {
  const r = parseWaybillRequest({
    id: "wbr_a1",
    createdBy: "u_kolegis",
    createdAt: "2026-10-23T10:00:00.000Z",
    vehicle: { brandModel: "MB E250", plate: "B7627" },
    status: "issued",
    waybillNo: "P02813",
    pdfUrl: "/api/admin/iriss-pavadzimes/p02813/pdf",
    ...over,
  });
  if (!r) throw new Error("bad fixture");
  return r;
}

describe("waybill PDF file name (same as Aivars in Dropbox)", () => {
  it("builds <NUMBER>_<BRAND_MODEL>_<PLATE>.pdf with underscores", () => {
    expect(waybillDropboxFileName({ waybillNo: "P02813", brandModel: "MB E250", plate: "B7627" })).toBe("P02813_MB_E250_B762-7.pdf");
    expect(waybillDropboxFileName({ waybillNo: "p02806", brandModel: "Toyota Corolla", plate: "B193-7" })).toBe(
      "P02806_Toyota_Corolla_B193-7.pdf",
    );
  });

  it("strips path and unsafe characters, keeps Latvian letters", () => {
    expect(waybillDropboxFileName({ waybillNo: "P00745", brandModel: "VW / Touran ../x", plate: "B192-7" })).toBe(
      "P00745_VW_Touran_x_B192-7.pdf",
    );
    expect(waybillDropboxFileName({ waybillNo: "P00001", brandModel: "Škoda Kodiaq", plate: "" })).toBe("P00001_Škoda_Kodiaq.pdf");
  });

  it("no valid number - no file name", () => {
    expect(waybillDropboxFileName({ waybillNo: "", brandModel: "BMW", plate: "B193-7" })).toBe("");
    expect(waybillDropboxFileName({ waybillNo: "../P1", brandModel: "BMW", plate: "B193-7" })).toBe("");
  });
});

describe("who may save the PDF", () => {
  const colleague = { actorId: "u_kolegis", waybillOnly: true };
  const otherColleague = { actorId: "u_cits", waybillOnly: true };
  const admin = { actorId: "env-admin", waybillOnly: false };

  it("only after the waybill is issued and has a PDF", () => {
    expect(waybillPdfAllowed(req({}), admin)).toBe(true);
    for (const status of ["queued", "in_progress", "error", "cancelled"] as const) {
      expect(waybillPdfAllowed(req({ status }), admin)).toBe(false);
    }
    expect(waybillPdfAllowed(req({ pdfUrl: "", dropboxPath: "" }), admin)).toBe(false);
    expect(waybillPdfAllowed(req({ pdfUrl: "", dropboxPath: "/Pavadzīmes_IRISS/P02813_MB_E250_B762-7.pdf" }), admin)).toBe(true);
  });

  it("colleague (Pavadzīmes only) - only own requests", () => {
    expect(waybillPdfAllowed(req({}), colleague)).toBe(true);
    expect(waybillPdfAllowed(req({}), otherColleague)).toBe(false);
    expect(waybillPdfAllowed(req({}), { actorId: "", waybillOnly: true })).toBe(false);
  });

  it("does not trust external pdfUrl as our PDF", () => {
    expect(waybillPdfIndexId("/api/admin/iriss-pavadzimes/p02813/pdf")).toBe("p02813");
    expect(waybillPdfIndexId("https://evil.example/x.pdf")).toBe("");
    expect(waybillRequestHasPdf({ pdfUrl: "https://evil.example/x.pdf", dropboxPath: "" })).toBe(false);
  });

  it("payload: canSavePdf per viewer, colleague never sees Dropbox details", () => {
    const own = req({ dropboxError: "Dropbox 500" });
    const foreign = req({ id: "wbr_b2", createdBy: "u_cits" });
    const replies: WaybillAivarsReply[] = [own, foreign].map((r) => ({
      requestId: r.id,
      status: r.status,
      statusLabel: "Izdota",
      text: "",
      waybillNo: r.waybillNo,
      pdfUrl: r.pdfUrl,
      at: "",
    }));
    const forColleague = withWaybillPdfAccess({ requests: [own, foreign], replies }, colleague);
    expect(forColleague.replies.map((r) => r.canSavePdf)).toEqual([true, false]);
    expect(forColleague.replies[0]?.dropboxError).toBe("");
    expect(forColleague.requests[0]?.dropboxError).toBe("");
    const forAdmin = withWaybillPdfAccess({ requests: [own, foreign], replies }, admin);
    expect(forAdmin.replies.map((r) => r.canSavePdf)).toEqual([true, true]);
    expect(forAdmin.replies[0]?.dropboxError).toBe("Dropbox 500");
  });

  it("phone rows show 'Saglabāt PDF' only for issued + allowed", () => {
    const issued = req({});
    const waiting = req({ id: "wbr_c3", status: "queued", waybillNo: "", pdfUrl: "" });
    const base = (r: WaybillRequest): WaybillAivarsReply => ({
      requestId: r.id,
      status: r.status,
      statusLabel: "",
      text: "",
      waybillNo: r.waybillNo,
      pdfUrl: r.pdfUrl,
      at: "",
      canSavePdf: r.status === "issued",
    });
    const rows = waybillMobileRequestRows([issued, waiting], [base(issued), base(waiting)], 5, {
      nowMs: Date.parse("2026-10-23T11:00:00.000Z"),
      which: "all",
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get("wbr_a1")).toMatchObject({ savePdfHref: waybillPdfDownloadHref("wbr_a1"), pdfFileName: "P02813_MB_E250_B762-7.pdf" });
    expect(byId.get("wbr_c3")?.savePdfHref).toBe("");
    const denied = waybillMobileRequestRows([issued], [{ ...base(issued), canSavePdf: false }], 5, {
      nowMs: Date.parse("2026-10-23T11:00:00.000Z"),
      which: "all",
    });
    expect(denied[0]?.savePdfHref).toBe("");
  });
});
