import { beforeEach, describe, expect, it, vi } from "vitest";

/** AUDITS «Sūtīt atskaiti» (jaunā forma, Nils 27.11): servera ceļš ar auditSend - B2B diskrēts, konsultācija, žurnāls. */
const SID = "manual_order_1700000000000_testau";
const VIN = "WAUZZZ4G7FN012345";
const PDF_PATH = `admin-report-pdf/${SID}/1700000000001-PROVIN_AUDITS_${VIN}.pdf`;

type Att = { filename: string; content: Buffer; contentType: string };

const m = vi.hoisted(() => ({
  send: vi.fn(async (input: unknown) => void input),
  get: vi.fn(),
  order: { notes: null as string | null, partnerId: null as string | null, isDemo: false },
  fetchBlobs: vi.fn(async (...a: unknown[]) => (void a, [] as Att[])),
  recordAudit: vi.fn(async (_sid: string, rec: unknown) => ({ auditSends: [rec] })),
  recordDealer: vi.fn(async () => null),
  review: vi.fn(async () => true),
}));

vi.mock("@/lib/admin-auth", () => ({ getAdminSession: async () => true }));
vi.mock("@/lib/admin-orders", () => ({
  getCheckoutSessionDetail: async () => ({
    id: SID,
    vin: VIN,
    customerEmail: "klients@example.com",
    paymentStatus: "paid",
    isManual: true,
    ...m.order,
  }),
}));
vi.mock("@/lib/admin-order-draft-store", () => ({ readOrderDraft: async () => null }));
vi.mock("@/lib/b2b-partner-store", () => ({ getB2bPartnerByEmail: async () => null }));
vi.mock("@/lib/email/notify-blob-attachments-fetch", () => ({
  deleteNotifyBlobUrls: async () => undefined,
  fetchNotifyBlobAttachmentsForEmail: m.fetchBlobs,
}));
vi.mock("@/lib/admin-notify-client-eligibility", () => ({ canNotifyClientOrder: () => true }));
vi.mock("@/lib/email/send-transactional", () => ({ isSmtpConfigured: () => true, sendReportReadyEmail: m.send }));
vi.mock("@/lib/email/dealer-email-context-server", () => ({ loadReportEmailExtras: async () => null }));
vi.mock("@/lib/partner-client-report-storage", () => ({ persistClientReportFromNotify: async () => true }));
vi.mock("@vercel/blob", () => ({ get: m.get, del: async () => undefined }));
vi.mock("@/lib/client-report-sends", () => ({
  readClientReportSends: async () => [],
  recordClientReportSend: async (_s: string, e: object) => ({ ...e, version: 1 }),
  readClientReportCommentSnapshots: async () => [],
  recordClientReportCommentSnapshot: async () => undefined,
}));
vi.mock("@/lib/dropbox-client", () => ({ getDropboxClient: () => null }));
vi.mock("@/lib/admin-audit-complete-store", () => ({ setAuditDeadlineComplete: async () => ({ ok: true, completedAt: "x" }) }));
vi.mock("@/lib/review-ask-store", () => ({ enqueueReviewAskAfterReport: m.review }));
vi.mock("@/lib/order-client-marks-store", () => ({ recordDealerSendOnServer: m.recordDealer, recordAuditSendOnServer: m.recordAudit }));

import { POST } from "@/app/api/admin/notify-report-ready/route";

function req(auditSend: object, extra: object = {}) {
  return new Request("https://www.provin.lv/api/admin/notify-report-ready", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: SID,
      serverPdfPathname: PDF_PATH,
      markComplete: true,
      customSubject: "Temats",
      customText: "Labdien!",
      lang: "de",
      auditSend,
      ...extra,
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  m.order.notes = null;
  m.order.partnerId = null;
  m.order.isDemo = false;
  m.get.mockResolvedValue({ statusCode: 200, stream: new Response(new Uint8Array(3)).body });
});

describe("notify-report-ready ar auditSend", () => {
  it("B2B partneris: diskrēts e-pasts (b2bClient), bez konsultācijas, bez atsauksmes lūguma; žurnālā auditSend", async () => {
    m.order.partnerId = "p_1";
    m.order.notes = "partner_id=p_1";
    const res = await POST(req({ situation: "fixed", b2b: true, consult: true }));
    expect(res.status).toBe(200);
    const sent = m.send.mock.calls[0]![0] as { b2bClient: boolean; audit: object; custom: object; lang: string };
    expect(sent.b2bClient).toBe(true);
    expect(sent.audit).toEqual({ discreet: true, corrected: true, consult: false });
    expect(sent.custom).toEqual({ subject: "Temats", text: "Labdien!" });
    expect(m.review).not.toHaveBeenCalled();
    const rec = m.recordAudit.mock.calls[0]![1] as Record<string, unknown>;
    expect(rec).toMatchObject({ channel: "email", situation: "fixed", b2b: true, lang: "de", consult: false, version: 1 });
    expect(m.recordDealer).not.toHaveBeenCalled();
    expect(((await res.json()) as { auditMarks?: unknown }).auditMarks).toBeTruthy();
  });

  it("PROVIN paraugs (isDemo) - arī B2B diskrēts", async () => {
    m.order.isDemo = true;
    await POST(req({ situation: "ready", b2b: false, consult: true }));
    const sent = m.send.mock.calls[0]![0] as { b2bClient: boolean; audit: { discreet: boolean } };
    expect(sent.b2bClient).toBe(true);
    expect(sent.audit.discreet).toBe(true);
  });

  it("B2C: konsultācijas bloks pēc ķekša, atsauksmes lūgums rindā, portfeļa faili ar nosaukumiem", async () => {
    m.fetchBlobs.mockResolvedValue([{ filename: "Servisa vēsture.pdf", content: Buffer.alloc(100), contentType: "application/pdf" }]);
    const res = await POST(
      req({ situation: "ready", b2b: false, consult: true }, { blobAttachments: [{ url: `https://abc.private.blob.vercel-storage.com/admin-notify-portfolio/${SID}/1-x.pdf` }] }),
    );
    expect(res.status).toBe(200);
    expect((m.fetchBlobs.mock.calls[0] as unknown[])[3]).toEqual({ keepNames: true });
    const sent = m.send.mock.calls[0]![0] as { b2bClient: boolean; audit: object; attachments: Att[] };
    expect(sent.b2bClient).toBe(false);
    expect(sent.audit).toEqual({ discreet: false, corrected: false, consult: true });
    expect(sent.attachments.map((a) => a.filename)).toEqual([`PROVIN_AUDITS_${VIN}.pdf`, "Servisa vēsture.pdf"]);
    expect(m.review).toHaveBeenCalled();
    expect((m.recordAudit.mock.calls[0]![1] as { files: unknown }).files).toEqual([{ name: "Servisa vēsture.pdf", bytes: 100 }]);
  });

  it("bez auditSend - vecais ceļš nemainās (nav audit, nav žurnāla)", async () => {
    await POST(req(undefined as never));
    const sent = m.send.mock.calls[0]![0] as { audit?: unknown };
    expect(sent.audit).toBeUndefined();
    expect(m.recordAudit).not.toHaveBeenCalled();
  });
});
