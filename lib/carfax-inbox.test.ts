import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { CARFAX_FIXTURE_SE } from "@/lib/carfax-report-parse.fixtures";
import {
  carfaxPreviewUrl,
  carfaxPurchasePending,
  carfaxVinFromFileName,
  matchCarfaxPdfOrder,
  normalizeCarfaxPurchaseRequest,
  parseCarfaxInboxChunk,
} from "@/lib/carfax-inbox-logic";

/* ------------------------------------------------------------------ */
/* Mocks: krātuve atmiņā, pasūtījumi, melnraksti, PDF teksts           */
/* ------------------------------------------------------------------ */

const store = new Map<string, Uint8Array>();
const drafts = new Map<string, { workspace: unknown; workspaceRevision: number; orderEdits?: Record<string, string> }>();
let orders: Array<Record<string, unknown>> = [];
const pdfText = new Map<string, string>();
const pushes: string[] = [];
const patches: string[] = [];

vi.mock("@/lib/carvertical-auto-store", () => ({
  readVendorAutoRaw: async (rel: string) => store.get(rel) ?? null,
  writeVendorAutoRaw: async (rel: string, body: string | Uint8Array) => {
    store.set(rel, typeof body === "string" ? new TextEncoder().encode(body) : body);
    return { ok: true };
  },
}));
vi.mock("@vercel/blob", () => ({ del: async () => undefined }));
vi.mock("@/lib/admin-push", () => ({
  sendAdminPush: async (m: { title: string }) => {
    pushes.push(m.title);
    return { sent: 1, removed: 0 };
  },
}));
vi.mock("@/lib/admin-orders", () => ({ listAdminOrders: async () => ({ rows: orders, stripeError: null }) }));
vi.mock("@/lib/admin-order-draft-store", () => ({
  getOrderDraftBlobConfig: () => null,
  isSafeOrderDraftSessionId: (id: string) => /^[A-Za-z0-9_-]+$/.test(id),
  readOrderDraft: async (id: string) => drafts.get(id) ?? null,
  patchOrderDraft: async (id: string, patch: { workspace: unknown }, opts: { expectedWorkspaceRevision?: number }) => {
    const prev = drafts.get(id);
    if (prev && opts.expectedWorkspaceRevision != null && opts.expectedWorkspaceRevision !== prev.workspaceRevision) {
      return { ok: false, error: "stale_revision" };
    }
    patches.push(id);
    drafts.set(id, { ...prev, workspace: patch.workspace, workspaceRevision: (prev?.workspaceRevision ?? 0) + 1 });
    return { ok: true };
  },
}));
vi.mock("@/lib/carfax-pdf-store", () => ({
  saveCarfaxOriginalPdf: async (a: { sessionId: string; vin: string; bytes: Uint8Array }) => ({
    meta: { name: `CARFAX - ${a.vin}.pdf`, size: a.bytes.byteLength, savedAt: new Date().toISOString(), blobPath: `carfax/${a.sessionId}.pdf` },
    notes: [],
  }),
}));
vi.mock("@/lib/pdf-text-extract-server", () => ({
  extractPdfTextDetailed: async (buf: ArrayBuffer) => {
    const key = createHash("md5").update(new Uint8Array(buf)).digest("hex");
    return { text: pdfText.get(key) ?? "" };
  },
}));

const { ingestCarfaxInboxPdf, receiveCarfaxInboxChunk, attachUnmatchedCarfaxPdf, listCarfaxUnmatched } = await import("@/lib/carfax-inbox");
const { mergeSourceBlocksWithDefaults } = await import("@/lib/admin-source-blocks");

const VIN = "WAUZZZ4G0JN000001";
const DAY = 24 * 60 * 60_000;

function fakePdf(text: string, salt = ""): { bytes: Uint8Array; md5: string } {
  const bytes = new TextEncoder().encode(`%PDF-1.7\n${"x".repeat(200)}${salt}`);
  const md5 = createHash("md5").update(bytes).digest("hex");
  pdfText.set(md5, text);
  return { bytes, md5 };
}

function order(id: string, createdMs: number, vin: string | null) {
  return { id, created: Math.floor(createdMs / 1000), vin, paymentStatus: "paid", checkoutLine: "audit" };
}

function carfaxBlock(id: string) {
  return mergeSourceBlocksWithDefaults((drafts.get(id)?.workspace as { sourceBlocks?: object })?.sourceBlocks ?? {}).carfax;
}

beforeEach(() => {
  store.clear();
  drafts.clear();
  pdfText.clear();
  pushes.length = 0;
  patches.length = 0;
  orders = [];
});

/* ------------------------------------------------------------------ */

describe("carfax-inbox-logic", () => {
  it("VIN no pielikuma nosaukuma", () => {
    expect(carfaxVinFromFileName(`CARFAX - ${VIN}.pdf`)).toBe(VIN);
    expect(carfaxVinFromFileName(`carfax-${VIN.toLowerCase()}.pdf`)).toBe(VIN);
    expect(carfaxVinFromFileName("Rekins 2026153492.pdf")).toBe("");
    expect(carfaxVinFromFileName(`CARFAX - ${VIN}.docx`)).toBe("");
  });

  it("priekšskatījuma URL ar VIN; nederīgs VIN -> null", () => {
    expect(carfaxPreviewUrl(` ${VIN.toLowerCase()} `)).toBe(`https://www.carfax.eu/preview-page?vin=${VIN}`);
    expect(carfaxPreviewUrl("RO8544")).toBeNull();
  });

  it("purchase normalizācija un «Gaida PDF» stāvoklis", () => {
    expect(normalizeCarfaxPurchaseRequest({ requestedAt: "nav", vin: VIN })).toBeUndefined();
    const purchase = normalizeCarfaxPurchaseRequest({ requestedAt: "2026-11-25T10:00:00.000Z", vin: VIN.toLowerCase() })!;
    expect(purchase.vin).toBe(VIN);
    const t = Date.parse(purchase.requestedAt);
    expect(carfaxPurchasePending({ purchase }, t + 60_000)).toBe(true);
    expect(carfaxPurchasePending({ purchase, report: { pdf: { savedAt: new Date(t + 120_000).toISOString() } } }, t + 180_000)).toBe(false);
    expect(carfaxPurchasePending({ purchase, report: { pdf: { savedAt: new Date(t - DAY).toISOString() } } }, t + 60_000)).toBe(true);
    expect(carfaxPurchasePending({ purchase }, t + 2 * DAY)).toBe(false);
  });

  it("pasūtījuma izvēle: nesens klikšķis > jaunākais pasūtījums; cits VIN - nē", () => {
    const now = Date.parse("2026-11-25T12:00:00Z");
    const c = [
      { id: "old", createdMs: now - 20 * DAY, vins: [VIN] },
      { id: "new", createdMs: now - DAY, vins: [VIN.toLowerCase()] },
      { id: "other", createdMs: now - 60_000, vins: ["WVWZZZ1KZ0W000002"] },
    ];
    expect(matchCarfaxPdfOrder(c, VIN, now)).toEqual({ orderId: "new", reason: "newest" });
    const clicked = c.map((x) => (x.id === "old" ? { ...x, purchase: { requestedAt: new Date(now - 600_000).toISOString(), vin: VIN } } : x));
    expect(matchCarfaxPdfOrder(clicked, VIN, now)).toEqual({ orderId: "old", reason: "purchase_click" });
    const staleClick = c.map((x) => (x.id === "old" ? { ...x, purchase: { requestedAt: new Date(now - 5 * DAY).toISOString(), vin: VIN } } : x));
    expect(matchCarfaxPdfOrder(staleClick, VIN, now)?.orderId).toBe("new");
    expect(matchCarfaxPdfOrder(c, "1FTEX15N0SK000003", now)).toBeNull();
    expect(matchCarfaxPdfOrder([{ id: "ancient", createdMs: now - 200 * DAY, vins: [VIN] }], VIN, now)).toBeNull();
  });

  it("daļas pieprasījuma validācija", () => {
    const base = { md5: "a".repeat(32), fileName: `CARFAX - ${VIN}.pdf`, chunkIndex: 0, chunkCount: 1, chunkBase64: Buffer.from("%PDF-").toString("base64") };
    expect("error" in parseCarfaxInboxChunk(base)).toBe(false);
    expect(parseCarfaxInboxChunk({ ...base, md5: "x" })).toEqual({ error: "invalid_md5" });
    expect(parseCarfaxInboxChunk({ ...base, chunkIndex: 1 })).toEqual({ error: "invalid_chunk" });
    expect(parseCarfaxInboxChunk({ ...base, chunkBase64: "" })).toEqual({ error: "invalid_chunk_size" });
  });
});

describe("CARFAX PDF no pasta -> pasūtījums", () => {
  const now = Date.now();

  it("piesaista pēc VIN, saglabā servera pusē tikai CARFAX bloku; tas pats PDF otrreiz -> duplicate", async () => {
    orders = [order("ord_a", now - DAY, VIN), order("ord_b", now - 2 * DAY, "WVWZZZ1KZ0W000002")];
    const csddKept = { vin: VIN, registrationNumber: "AB1234" };
    drafts.set("ord_a", { workspace: { sourceBlocks: { csdd: csddKept } }, workspaceRevision: 4 });
    const pdf = fakePdf(CARFAX_FIXTURE_SE);

    const res = await ingestCarfaxInboxPdf({ ...pdf, fileName: `CARFAX - ${VIN}.pdf` });
    expect(res).toEqual({ status: "attached", orderId: "ord_a", reason: "newest" });
    const block = carfaxBlock("ord_a");
    expect(block.report?.vin).toBe(VIN);
    expect(block.report?.pdf?.md5).toBe(pdf.md5);
    expect(block.report?.pdf?.via).toBe("email");
    const ws = drafts.get("ord_a")!.workspace as { sourceBlocks: { csdd: { registrationNumber: string } } };
    expect(ws.sourceBlocks.csdd.registrationNumber).toBe("AB1234");
    expect(drafts.get("ord_a")!.workspaceRevision).toBe(5);

    const again = await ingestCarfaxInboxPdf({ ...pdf, fileName: `CARFAX - ${VIN}.pdf` });
    expect(again).toEqual({ status: "duplicate", orderId: "ord_a" });
    expect(patches).toEqual(["ord_a"]);
  });

  it("vairāki pasūtījumi ar šo VIN -> tas, kurā nesen spiests «Pirkt CARFAX»", async () => {
    orders = [order("ord_new", now - DAY, VIN), order("ord_clicked", now - 10 * DAY, VIN)];
    drafts.set("ord_clicked", {
      workspace: { sourceBlocks: { carfax: { purchase: { requestedAt: new Date(now - 5 * 60_000).toISOString(), vin: VIN } } } },
      workspaceRevision: 1,
    });
    const res = await ingestCarfaxInboxPdf({ ...fakePdf(CARFAX_FIXTURE_SE), fileName: `CARFAX - ${VIN}.pdf` });
    expect(res).toEqual({ status: "attached", orderId: "ord_clicked", reason: "purchase_click" });
    expect(carfaxBlock("ord_clicked").purchase?.vin).toBe(VIN);
  });

  it("nav pasūtījuma -> nepiesaistīts (saglabāts, push vienreiz), vēlāk pievienojams adminā", async () => {
    const pdf = fakePdf(CARFAX_FIXTURE_SE);
    const res = await ingestCarfaxInboxPdf({ ...pdf, fileName: `CARFAX - ${VIN}.pdf` });
    expect(res).toEqual({ status: "unmatched", vin: VIN });
    expect((await listCarfaxUnmatched()).map((x) => x.md5)).toEqual([pdf.md5]);
    expect(pushes).toEqual(["CARFAX PDF bez pasūtījuma"]);
    await ingestCarfaxInboxPdf({ ...pdf, fileName: `CARFAX - ${VIN}.pdf` });
    expect(pushes).toHaveLength(1);
    expect(await listCarfaxUnmatched()).toHaveLength(1);

    const blocks = mergeSourceBlocksWithDefaults({});
    const att = await attachUnmatchedCarfaxPdf({ sessionId: "ord_late", md5: pdf.md5, prevBlock: blocks.carfax, csdd: blocks.csdd });
    expect(att.ok).toBe(true);
    if (att.ok) expect(att.block.report?.pdf?.md5).toBe(pdf.md5);
    expect(await listCarfaxUnmatched()).toHaveLength(0);
    // Pēc pievienošanas tas pats PDF no pasta vairs netiek ielikts citur.
    orders = [order("ord_x", now - DAY, VIN)];
    expect(await ingestCarfaxInboxPdf({ ...pdf, fileName: `CARFAX - ${VIN}.pdf` })).toEqual({ status: "duplicate", orderId: "ord_late" });
  });

  it("nav CARFAX PDF -> noraida, neko nesaglabā", async () => {
    orders = [order("ord_a", now - DAY, VIN)];
    const res = await ingestCarfaxInboxPdf({ ...fakePdf("Rēķins Nr. 2026153492\nSumma 219,00 EUR"), fileName: `CARFAX - ${VIN}.pdf` });
    expect(res.status).toBe("not_carfax");
    const notPdf = new TextEncoder().encode("hello".repeat(40));
    const res2 = await ingestCarfaxInboxPdf({ bytes: notPdf, md5: createHash("md5").update(notPdf).digest("hex"), fileName: "x.pdf" });
    expect(res2).toEqual({ status: "not_carfax", reason: "not_pdf" });
    expect(patches).toHaveLength(0);
    expect(await listCarfaxUnmatched()).toHaveLength(0);
  });

  it("PDF daļās: saliek, pārbauda md5, piesaista", async () => {
    orders = [order("ord_a", now - DAY, VIN)];
    const pdf = fakePdf(CARFAX_FIXTURE_SE, "y".repeat(500));
    const half = Math.floor(pdf.bytes.length / 2);
    const parts = [pdf.bytes.slice(0, half), pdf.bytes.slice(half)];
    const mk = (i: number) => ({ md5: pdf.md5, fileName: `CARFAX - ${VIN}.pdf`, index: i, count: 2, bytes: parts[i], receivedAt: "", messageId: "m1" });
    expect(await receiveCarfaxInboxChunk(mk(0))).toEqual({ status: "chunk_saved", index: 0 });
    expect(await receiveCarfaxInboxChunk(mk(1))).toEqual({ status: "attached", orderId: "ord_a", reason: "newest" });
    const bad = { ...mk(1), md5: "b".repeat(32) };
    expect(await receiveCarfaxInboxChunk(bad)).toEqual({ status: "chunk_missing" });
  });
});
