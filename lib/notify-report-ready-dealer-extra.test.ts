import { beforeEach, describe, expect, it, vi } from "vitest";

const SID = "manual_order_1700000000000_testbb";
const PDF_PATH = `admin-report-pdf/${SID}/1700000000001-OFICIALA_DILERA_DATI_WDC0000000TEST001.pdf`;
const MB = 1024 * 1024;

type Att = { filename: string; content: Buffer; contentType: string };

const m = vi.hoisted(() => ({
  send: vi.fn(async (input: unknown) => void input),
  get: vi.fn(),
  del: vi.fn(async () => undefined),
  fetchBlobs: vi.fn(async (...a: unknown[]) => (void a, [] as Att[])),
  delBlobUrls: vi.fn(async (...a: unknown[]) => void a),
  recordDealer: vi.fn(async (_sid: string, rec: unknown) => ({ dealerSends: [rec] })),
}));

vi.mock("@/lib/admin-auth", () => ({ getAdminSession: async () => true }));
vi.mock("@/lib/admin-orders", () => ({
  getCheckoutSessionDetail: async () => ({
    id: SID,
    vin: "WDC0000000TEST001",
    customerEmail: "klients@example.com",
    paymentStatus: "paid",
    isManual: true,
    notes: null,
    partnerId: null,
  }),
}));
vi.mock("@/lib/admin-order-draft-store", () => ({ readOrderDraft: async () => null }));
vi.mock("@/lib/b2b-partner-store", () => ({ getB2bPartnerByEmail: async () => null }));
vi.mock("@/lib/email/notify-blob-attachments-fetch", () => ({
  deleteNotifyBlobUrls: m.delBlobUrls,
  fetchNotifyBlobAttachmentsForEmail: m.fetchBlobs,
}));
vi.mock("@/lib/admin-notify-client-eligibility", () => ({ canNotifyClientOrder: () => true }));
vi.mock("@/lib/email/send-transactional", () => ({ isSmtpConfigured: () => true, sendReportReadyEmail: m.send }));
vi.mock("@/lib/email/dealer-email-context-server", () => ({ loadReportEmailExtras: async () => null }));
vi.mock("@/lib/partner-client-report-storage", () => ({ persistClientReportFromNotify: async () => true }));
vi.mock("@vercel/blob", () => ({ get: m.get, del: m.del }));
vi.mock("@/lib/client-report-sends", () => ({
  readClientReportSends: async () => [],
  recordClientReportSend: async (_s: string, e: object) => ({ ...e, version: 1 }),
  readClientReportCommentSnapshots: async () => [],
  recordClientReportCommentSnapshot: async () => undefined,
}));
vi.mock("@/lib/dropbox-client", () => ({ getDropboxClient: () => null }));
vi.mock("@/lib/admin-audit-complete-store", () => ({ setAuditDeadlineComplete: async () => ({ ok: true, completedAt: null }) }));
vi.mock("@/lib/review-ask-store", () => ({ enqueueReviewAskAfterReport: async () => true }));
vi.mock("@/lib/order-client-marks-store", () => ({ recordDealerSendOnServer: m.recordDealer }));

import { POST } from "@/app/api/admin/notify-report-ready/route";

const BLOB_URL = `https://abc.private.blob.vercel-storage.com/admin-notify-portfolio/${SID}/1-x.jpg`;

function req(body: object) {
  return new Request("https://www.provin.lv/api/admin/notify-report-ready", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: SID,
      serverPdfPathname: PDF_PATH,
      markComplete: true,
      customSubject: "Dīlera dati",
      customText: "Labdien!",
      dealerSend: { situation: "ready", offer: false, review: false },
      ...body,
    }),
  });
}

function pdfStream(bytes: number) {
  return new Response(new Uint8Array(bytes)).body;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  m.get.mockResolvedValue({ statusCode: 200, stream: pdfStream(3) });
  m.fetchBlobs.mockResolvedValue([]);
});

describe("dīlera «Sūtīt klientam» ar papildu failiem", () => {
  it("faili pievienoti aiz dīlera PDF ar oriģinālajiem nosaukumiem; žurnālā nosaukums un izmērs", async () => {
    m.fetchBlobs.mockResolvedValue([
      { filename: "Servisa grāmatiņa.jpg", content: Buffer.alloc(2000), contentType: "image/jpeg" },
      { filename: "rēķins.pdf", content: Buffer.alloc(500), contentType: "application/pdf" },
    ]);
    const res = await POST(req({ blobAttachments: [{ url: BLOB_URL, filename: "Servisa grāmatiņa.jpg" }, { url: BLOB_URL, filename: "rēķins.pdf" }] }));
    expect(res.status).toBe(200);
    expect((m.fetchBlobs.mock.calls[0] as unknown[])[3]).toEqual({ keepNames: true });
    const sent = m.send.mock.calls[0]![0] as { attachments: Att[] };
    expect(sent.attachments.map((a) => a.filename)).toEqual([
      "OFICIALA_DILERA_DATI_WDC0000000TEST001.pdf",
      "Servisa grāmatiņa.jpg",
      "rēķins.pdf",
    ]);
    const rec = m.recordDealer.mock.calls[0]![1] as { files: { name: string; bytes: number }[]; at: string };
    expect(rec.files).toEqual([
      { name: "Servisa grāmatiņa.jpg", bytes: 2000 },
      { name: "rēķins.pdf", bytes: 500 },
    ]);
    expect(typeof rec.at).toBe("string");
  });

  it("bez failiem - kā agrāk: tikai PDF, ierakstā nav `files`", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(200);
    expect((m.send.mock.calls[0]![0] as { attachments: Att[] }).attachments).toHaveLength(1);
    expect(m.recordDealer.mock.calls[0]![1]).not.toHaveProperty("files");
  });

  it("par daudz failu (>50): 413 ar skaidru tekstu, nekas netiek sūtīts, pagaidu faili dzēsti", async () => {
    m.fetchBlobs.mockResolvedValue(
      Array.from({ length: 51 }, (_, i) => ({ filename: `${i}.jpg`, content: Buffer.alloc(10), contentType: "image/jpeg" })),
    );
    const res = await POST(req({ blobAttachments: Array.from({ length: 11 }, () => ({ url: BLOB_URL })) }));
    const j = (await res.json()) as { error: string; message: string };
    expect(res.status).toBe(413);
    expect(j.message).toMatch(/līdz 50/);
    expect(m.send).not.toHaveBeenCalled();
    expect(m.delBlobUrls).toHaveBeenCalled();
  });

  it("PDF + faili > 18 MB: 413, nekas netiek sūtīts", async () => {
    m.get.mockResolvedValue({ statusCode: 200, stream: pdfStream(3 * MB) });
    m.fetchBlobs.mockResolvedValue([{ filename: "liela.jpg", content: Buffer.alloc(16 * MB), contentType: "image/jpeg" }]);
    const res = await POST(req({ blobAttachments: [{ url: BLOB_URL }] }));
    const j = (await res.json()) as { message: string };
    expect(res.status).toBe(413);
    expect(j.message).toMatch(/Par lielu e-pastam/);
    expect(m.send).not.toHaveBeenCalled();
  });

  it("neatbalstīts tips (piem. ZIP): 413, nesūta", async () => {
    m.fetchBlobs.mockResolvedValue([{ filename: "x.zip", content: Buffer.alloc(10), contentType: "application/zip" }]);
    const res = await POST(req({ blobAttachments: [{ url: BLOB_URL }] }));
    expect(res.status).toBe(413);
    expect(m.send).not.toHaveBeenCalled();
  });
});
