import { beforeEach, describe, expect, it, vi } from "vitest";

const SID = "manual_order_1700000000000_testaa";
const PDF_PATH = `admin-report-pdf/${SID}/1700000000001-PROVIN_AUDITS_WDC0000000TEST001.pdf`;

const m = vi.hoisted(() => ({
  send: vi.fn(async (_input: unknown) => undefined),
  get: vi.fn(),
  del: vi.fn(async () => undefined),
  readSends: vi.fn(async () => [] as { version: number }[]),
  recordSend: vi.fn(async (_sid: string, e: object) => ({ ...e, version: 1 })),
  saveDropbox: vi.fn(async () => ({ path: "/_PROv/Mercedes GLE 2000 WDC0000000TEST001/PROVIN_AUDITS_WDC0000000TEST001.pdf", name: "x", size: 3, folderCreated: false })),
  complete: vi.fn(async () => ({ ok: true as const, completedAt: "2026-11-17T20:00:00.000Z", durable: true })),
  persist: vi.fn(async () => true),
  order: vi.fn(),
  draft: vi.fn(async () => null as unknown),
  partnerByEmail: vi.fn(async (_e: string) => null as { id: string } | null),
  delBlobUrls: vi.fn(async () => undefined),
}));

const BASE_ORDER = { id: SID, vin: "WDC0000000TEST001", customerEmail: "klients@example.com", paymentStatus: "paid", isManual: true, notes: null as string | null, partnerId: null as string | null };
const PARTNER_ID = "ptr_0000000000000001";

vi.mock("@/lib/admin-auth", () => ({ getAdminSession: async () => true }));
vi.mock("@/lib/admin-orders", () => ({ getCheckoutSessionDetail: m.order }));
vi.mock("@/lib/admin-order-draft-store", () => ({ readOrderDraft: m.draft }));
vi.mock("@/lib/b2b-partner-store", () => ({ getB2bPartnerByEmail: m.partnerByEmail }));
vi.mock("@/lib/email/notify-blob-attachments-fetch", () => ({
  deleteNotifyBlobUrls: m.delBlobUrls,
  fetchNotifyBlobAttachmentsForEmail: async () => [],
}));
vi.mock("@/lib/admin-notify-client-eligibility", () => ({ canNotifyClientOrder: () => true }));
vi.mock("@/lib/email/send-transactional", () => ({ isSmtpConfigured: () => true, sendReportReadyEmail: m.send }));
vi.mock("@/lib/partner-client-report-storage", () => ({ persistClientReportFromNotify: m.persist }));
vi.mock("@vercel/blob", () => ({ get: m.get, del: m.del }));
vi.mock("@/lib/client-report-sends", () => ({ readClientReportSends: m.readSends, recordClientReportSend: m.recordSend }));
vi.mock("@/lib/dropbox-client", () => ({ getDropboxClient: () => ({}) }));
vi.mock("@/lib/ltab-dropbox", () => ({ saveFileToProvOrderFolder: m.saveDropbox }));
// Vecs pasūtījums bez mapes ieraksta - kopija mapē pēc VIN (`saveFileToProvOrderFolder`).
vi.mock("@/lib/order-dropbox", () => ({
  saveFileToOrderFolderOrLegacy: async (_s: string, _n: string, _b: Uint8Array, legacy: () => Promise<{ path: string }>) => ({
    path: (await legacy()).path,
    duplicate: false,
    legacy: true,
  }),
}));
vi.mock("@/lib/admin-audit-complete-store", () => ({ setAuditDeadlineComplete: m.complete }));

import { POST } from "@/app/api/admin/notify-report-ready/route";

function req(body: object) {
  return new Request("https://www.provin.lv/api/admin/notify-report-ready", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: SID, ...body }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  m.readSends.mockResolvedValue([]);
  m.order.mockResolvedValue({ ...BASE_ORDER });
  m.draft.mockResolvedValue(null);
  m.partnerByEmail.mockResolvedValue(null);
  delete process.env.REPORT_RECIPIENT_BLOCKLIST;
  m.get.mockResolvedValue({ statusCode: 200, stream: new Response(new Uint8Array([37, 80, 68])).body });
});

describe("Sūtīt atskaiti ar servera PDF", () => {
  it("atskaite ir pirmais pielikums, kopija Dropbox, versija, «Izpildīts», pagaidu PDF dzēsts", async () => {
    const res = await POST(req({ serverPdfPathname: PDF_PATH, markComplete: true }));
    const j = (await res.json()) as { ok: boolean; serverSend: { version: number; dropboxPath: string; completedAt: string } };
    expect(res.status).toBe(200);
    const sent = m.send.mock.calls[0]![0] as unknown as { attachments: { filename: string }[]; corrected: boolean; to: string };
    expect(sent.attachments[0]!.filename).toBe("PROVIN_AUDITS_WDC0000000TEST001.pdf");
    expect(sent.corrected).toBe(false);
    expect(sent.to).toBe("klients@example.com");
    expect(m.saveDropbox).toHaveBeenCalledTimes(1);
    expect((m.saveDropbox.mock.calls[0] as unknown[])[2]).toBe("PROVIN_AUDITS_WDC0000000TEST001.pdf");
    expect(m.complete).toHaveBeenCalledWith(SID, true);
    expect(m.del).toHaveBeenCalledWith(PDF_PATH);
    expect(j.serverSend).toMatchObject({ version: 1, completedAt: "2026-11-17T20:00:00.000Z" });
    expect(j.serverSend.dropboxPath).toContain("/_PROv/");
  });

  it("atkārtots sūtījums: tēmā «labota», Dropbox fails ar _v2, bez «Izpildīts», ja nav prasīts", async () => {
    m.readSends.mockResolvedValue([{ version: 1 }]);
    const res = await POST(req({ serverPdfPathname: PDF_PATH }));
    expect(res.status).toBe(200);
    expect((m.send.mock.calls[0]![0] as unknown as { corrected: boolean }).corrected).toBe(true);
    expect((m.saveDropbox.mock.calls[0] as unknown[])[2]).toBe("PROVIN_AUDITS_WDC0000000TEST001_v2.pdf");
    expect(m.complete).not.toHaveBeenCalled();
  });

  it("bez Dropbox ķekša kopiju nesaglabā, bet sūta un ieraksta versiju", async () => {
    const res = await POST(req({ serverPdfPathname: PDF_PATH, saveDropbox: false }));
    expect(res.status).toBe(200);
    expect(m.saveDropbox).not.toHaveBeenCalled();
    expect(m.send).toHaveBeenCalledTimes(1);
    expect(m.recordSend).toHaveBeenCalledTimes(1);
  });

  it("cita pasūtījuma PDF ceļu nepieņem un neko nesūta", async () => {
    const res = await POST(req({ serverPdfPathname: "admin-report-pdf/cs_live_cits123/1-x.pdf" }));
    expect(res.status).toBe(400);
    expect(m.send).not.toHaveBeenCalled();
  });

  it("bez servera PDF vecā plūsma: nav Dropbox, versiju un «Izpildīts»", async () => {
    const res = await POST(req({ attachmentsBase64: [{ filename: "PROVIN_AUDITS_X.pdf", data: Buffer.from("%PDF").toString("base64"), mimeType: "application/pdf" }] }));
    expect(res.status).toBe(200);
    expect(m.saveDropbox).not.toHaveBeenCalled();
    expect(m.recordSend).not.toHaveBeenCalled();
    expect(m.complete).not.toHaveBeenCalled();
  });
});

describe("Sūtīt atskaiti: adresāta aizsardzība", () => {
  it("pieprasījuma e-pasts atšķiras no saglabātā: 409 ar maskētām adresēm, nekas netiek sūtīts", async () => {
    m.draft.mockResolvedValue({ orderEdits: { customerEmail: "klients@example.com" } });
    const res = await POST(req({ serverPdfPathname: PDF_PATH, customerEmail: "partneris@test.example" }));
    const j = (await res.json()) as { error: string; stored: string; requested: string };
    expect(res.status).toBe(409);
    expect(j.error).toBe("recipient_mismatch");
    expect(j.stored).toBe("kl***@example.com");
    expect(j.requested).toBe("pa***@test.example");
    expect(JSON.stringify(j)).not.toContain("klients@example.com");
    expect(m.send).not.toHaveBeenCalled();
    expect(m.del).not.toHaveBeenCalled();
  });

  it("lielie/mazie burti un atstarpes nav atšķirība", async () => {
    const res = await POST(req({ serverPdfPathname: PDF_PATH, customerEmail: "  Klients@Example.com " }));
    expect(res.status).toBe(200);
    expect(m.send).toHaveBeenCalledTimes(1);
    expect((m.recordSend.mock.calls[0] as unknown[])[1]).not.toHaveProperty("recipientOverride");
  });

  it("ar apstiprinājumu sūta uz jauno adresi un žurnālā atzīmē recipientOverride", async () => {
    const res = await POST(
      req({ serverPdfPathname: PDF_PATH, customerEmail: "jauns@example.com", confirmRecipientOverride: true }),
    );
    expect(res.status).toBe(200);
    expect((m.send.mock.calls[0]![0] as unknown as { to: string }).to).toBe("jauns@example.com");
    expect((m.recordSend.mock.calls[0] as unknown[])[1]).toMatchObject({
      to: "jauns@example.com",
      recipientOverride: true,
      previousRecipientMasked: "kl***@example.com",
    });
  });

  it("B2B partnera e-pasts klienta pasūtījumā: 409 arī ar apstiprinājumu", async () => {
    m.draft.mockResolvedValue({ orderEdits: { customerEmail: "partneris@test.example" } });
    m.partnerByEmail.mockResolvedValue({ id: PARTNER_ID });
    const res = await POST(
      req({ serverPdfPathname: PDF_PATH, customerEmail: "partneris@test.example", confirmRecipientOverride: true }),
    );
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toBe("partner_email_on_client_order");
    expect(m.send).not.toHaveBeenCalled();
  });

  it("partnera paša pasūtījums (partner_id piezīmēs): sūta partnerim", async () => {
    m.order.mockResolvedValue({ ...BASE_ORDER, customerEmail: null, notes: `partner_id=${PARTNER_ID} checkout_line=dealer` });
    m.draft.mockResolvedValue({ orderEdits: { customerEmail: "partneris@test.example" } });
    m.partnerByEmail.mockResolvedValue({ id: PARTNER_ID });
    const res = await POST(req({ serverPdfPathname: PDF_PATH, customerEmail: "partneris@test.example" }));
    expect(res.status).toBe(200);
    expect((m.send.mock.calls[0]![0] as unknown as { to: string }).to).toBe("partneris@test.example");
  });

  it("partnera pasūtījums ar partnerId laukā: sūta partnerim", async () => {
    m.order.mockResolvedValue({ ...BASE_ORDER, customerEmail: "partneris@test.example", partnerId: PARTNER_ID });
    m.partnerByEmail.mockResolvedValue({ id: PARTNER_ID });
    const res = await POST(req({ serverPdfPathname: PDF_PATH }));
    expect(res.status).toBe(200);
    expect(m.send).toHaveBeenCalledTimes(1);
  });

  it("nav ne saglabātā, ne pieprasījuma e-pasta: 400", async () => {
    m.order.mockResolvedValue({ ...BASE_ORDER, customerEmail: null });
    const res = await POST(req({ serverPdfPathname: PDF_PATH }));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("no_customer_email");
    expect(m.send).not.toHaveBeenCalled();
  });

  it("bloķēto sarakstā (domēns): 409 recipient_blocked", async () => {
    process.env.REPORT_RECIPIENT_BLOCKLIST = "kads@cits.example, @example.com";
    const res = await POST(req({ serverPdfPathname: PDF_PATH, confirmRecipientOverride: true }));
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toBe("recipient_blocked");
    expect(m.send).not.toHaveBeenCalled();
  });

  it("409 gadījumā pagaidu portfeļa Blob failus dzēš, servera PDF paliek", async () => {
    m.draft.mockResolvedValue({ orderEdits: { customerEmail: "klients@example.com" } });
    const prev = process.env.BLOB_READ_WRITE_TOKEN;
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    try {
      const res = await POST(
        req({
          serverPdfPathname: PDF_PATH,
          customerEmail: "cits@example.org",
          blobAttachments: [{ url: "https://x.public.blob.vercel-storage.com/a.pdf" }],
        }),
      );
      expect(res.status).toBe(409);
      expect(m.delBlobUrls).toHaveBeenCalledWith(["https://x.public.blob.vercel-storage.com/a.pdf"], "test-token");
      expect(m.del).not.toHaveBeenCalled();
    } finally {
      if (prev === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
      else process.env.BLOB_READ_WRITE_TOKEN = prev;
    }
  });
});
