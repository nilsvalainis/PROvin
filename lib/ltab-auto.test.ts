import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LtabAutoStatus } from "@/lib/ltab-auto-types";

const store = new Map<string, LtabAutoStatus>();
const pushes: Array<{ title: string; body: string }> = [];
const uploads: string[] = [];
let draftCsdd: Record<string, unknown> = {};

vi.mock("@/lib/ltab-auto-store", () => ({
  readLtabAutoStatus: async (id: string) => store.get(id) ?? null,
  writeLtabAutoStatus: async (id: string, s: LtabAutoStatus) => {
    store.set(id, s);
    return { ok: true };
  },
}));
vi.mock("@/lib/admin-push", () => ({
  sendAdminPush: async (m: { title: string; body: string }) => {
    pushes.push(m);
    return { sent: 1, removed: 0 };
  },
}));
vi.mock("@/lib/source-health-store", () => ({ recordSourceOutcomes: async () => undefined }));
vi.mock("@/lib/admin-order-draft-store", () => ({
  readOrderDraft: async () => ({ orderEdits: {}, workspace: { sourceBlocks: { csdd: draftCsdd } } }),
  isSafeOrderDraftSessionId: (id: string) => /^[A-Za-z0-9_-]{6,120}$/.test(id),
}));
vi.mock("@/lib/copilot-vendor-pdf-agent", () => ({
  runLtabPdfAgent: async ({ buffer }: { buffer: ArrayBuffer }) => {
    const text = new TextDecoder().decode(buffer);
    if (text.includes("NOCLAIMS")) {
      return {
        actions: [
          {
            type: "set_ltab_certificate",
            source: "ltab",
            confidence: "high",
            certificate: { issuedAt: "", vehicleLine: "", makeModel: "BMW 640I", year: "2012", plate: "AB1234", accidentCount: "0", insuredFrom: "", insuredTo: "", insuredDays: "", claims: [], footerNote: "" },
          },
        ],
      };
    }
    return {
      actions: [
        {
          type: "set_ltab_certificate",
          source: "ltab",
          confidence: "high",
          certificate: {
            issuedAt: "23.10.2026 10:00",
            vehicleLine: "",
            makeModel: "BMW 640I",
            year: "2012",
            plate: "AB1234",
            accidentCount: "1",
            insuredFrom: "",
            insuredTo: "",
            insuredDays: "",
            claims: [{ date: "12.03.2021", time: "10:15", status: "Cietušais", amount: "2930.00" }],
            footerNote: "",
          },
        },
      ],
    };
  },
}));
vi.mock("@/lib/dropbox-client", () => ({
  getDropboxClient: () => ({
    async listAll() {
      return { entries: [{ tag: "folder", id: "id:f", name: "BMW 640i 2012 WBALW3C59CC891863", pathLower: "", pathDisplay: "/_PROv/BMW 640i 2012 WBALW3C59CC891863", rev: "", size: 0, contentHash: "", serverModified: "" }], cursor: "" };
    },
    async ensureFolder(p: string) {
      return { tag: "folder", id: "id:new", name: p, pathLower: "", pathDisplay: p, rev: "", size: 0, contentHash: "", serverModified: "" };
    },
    async upload(p: string, bytes: Uint8Array) {
      uploads.push(p);
      return { tag: "file", id: "id:pdf", name: p.split("/").pop(), pathLower: "", pathDisplay: p, rev: "", size: bytes.byteLength, contentHash: "", serverModified: "" };
    },
    async getMetadata() {
      const p = uploads.at(-1)!;
      return { tag: "file", id: "id:pdf", name: p.split("/").pop(), pathLower: "", pathDisplay: p, rev: "", size: 0, contentHash: "", serverModified: "" };
    },
  }),
}));

const { handleLtabRelayEvent } = await import("@/lib/ltab-auto");

const SID = "cs_test_ltab_001";
const pdfB64 = (s: string) => Buffer.from(`%PDF-1.4 ${s}`).toString("base64");

beforeEach(() => {
  store.clear();
  pushes.length = 0;
  uploads.length = 0;
  draftCsdd = { vin: "WBALW3C59CC891863", makeModel: "BMW 640I", modelYear: "2012", registrationNumber: "AB1234" };
  store.set(SID, { state: "queued", jobId: "job-1", plate: "AB1234", updatedAt: "2026-10-23T09:00:00.000Z" });
});

describe("LTAB atzvans no releja", () => {
  it("pushes the Smart-ID control code to Nils", async () => {
    const out = await handleLtabRelayEvent({ jobId: "job-1", ref: SID, plate: "AB1234", state: "awaiting_smartid", verificationCode: "4821" });
    expect(out.ok && out.status.state).toBe("awaiting_smartid");
    expect(pushes[0]?.body).toContain("4821");
  });

  it("claims: saves the ORIGINAL PDF into the order's Dropbox folder and keeps the certificate", async () => {
    const out = await handleLtabRelayEvent({ jobId: "job-1", ref: SID, plate: "AB1234", state: "result", found: true, pdfBase64: pdfB64("CLAIMS") });
    expect(out.ok).toBe(true);
    const s = store.get(SID)!;
    expect(s.state).toBe("claims");
    expect(s.pdf?.dropboxPath).toBe("/_PROv/BMW 640i 2012 WBALW3C59CC891863/LTAB - AB1234.pdf");
    expect(s.certificate?.claims).toHaveLength(1);
    expect(s.mismatch).toBeUndefined();
    expect(uploads).toHaveLength(1);
    expect(pushes.at(-1)?.title).toMatch(/negadījumi/);
  });

  it("no claims: nothing is uploaded, status says OCTA gadījumu nav", async () => {
    await handleLtabRelayEvent({ jobId: "job-1", ref: SID, plate: "AB1234", state: "result", found: false });
    expect(store.get(SID)?.state).toBe("no_claims");
    await handleLtabRelayEvent({ jobId: "job-1", ref: SID, plate: "AB1234", state: "result", found: false, pdfBase64: pdfB64("NOCLAIMS") });
    expect(store.get(SID)?.state).toBe("no_claims");
    expect(uploads).toHaveLength(0);
  });

  it("marks a certificate for another car as mismatch (not auto-applied)", async () => {
    draftCsdd = { ...draftCsdd, makeModel: "AUDI A6" };
    await handleLtabRelayEvent({ jobId: "job-1", ref: SID, plate: "AB1234", state: "result", found: true, pdfBase64: pdfB64("CLAIMS") });
    expect(store.get(SID)?.mismatch).toMatch(/AUDI/);
  });

  it("rejects events from an older job and non-PDF payloads", async () => {
    const stale = await handleLtabRelayEvent({ jobId: "job-0", ref: SID, plate: "AB1234", state: "result", found: true, pdfBase64: pdfB64("CLAIMS") });
    expect(stale).toMatchObject({ ok: false, error: "stale_job" });
    await handleLtabRelayEvent({ jobId: "job-1", ref: SID, plate: "AB1234", state: "result", found: true, pdfBase64: Buffer.from("<html>").toString("base64") });
    expect(store.get(SID)?.state).toBe("error");
    expect(uploads).toHaveLength(0);
  });
});
