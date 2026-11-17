import { beforeEach, describe, expect, it, vi } from "vitest";

const SID = "manual_order_1793913865501_efsnoj";
const PDF_PATH = `admin-report-pdf/${SID}/1794938333505-PROVIN_AUDITS_WDC1671191A002835.pdf`;

const m = vi.hoisted(() => ({
  send: vi.fn(async () => undefined),
  get: vi.fn(),
  del: vi.fn(async () => undefined),
  readSends: vi.fn(async () => [] as { version: number }[]),
  recordSend: vi.fn(async (_sid: string, e: object) => ({ ...e, version: 1 })),
  saveDropbox: vi.fn(async () => ({ path: "/_PROv/Mercedes GLE 2019 WDC1671191A002835/PROVIN_AUDITS_WDC1671191A002835.pdf", name: "x", size: 3, folderCreated: false })),
  complete: vi.fn(async () => ({ ok: true as const, completedAt: "2026-11-17T20:00:00.000Z", durable: true })),
  persist: vi.fn(async () => true),
}));

vi.mock("@/lib/admin-auth", () => ({ getAdminSession: async () => true }));
vi.mock("@/lib/admin-orders", () => ({
  getCheckoutSessionDetail: async () => ({ id: SID, vin: "WDC1671191A002835", customerEmail: "gustavs.ansons@gmail.com", paymentStatus: "paid", isManual: true }),
}));
vi.mock("@/lib/admin-order-draft-store", () => ({ readOrderDraft: async () => null }));
vi.mock("@/lib/admin-notify-client-eligibility", () => ({ canNotifyClientOrder: () => true }));
vi.mock("@/lib/email/send-transactional", () => ({ isSmtpConfigured: () => true, sendReportReadyEmail: m.send }));
vi.mock("@/lib/partner-client-report-storage", () => ({ persistClientReportFromNotify: m.persist }));
vi.mock("@vercel/blob", () => ({ get: m.get, del: m.del }));
vi.mock("@/lib/client-report-sends", () => ({ readClientReportSends: m.readSends, recordClientReportSend: m.recordSend }));
vi.mock("@/lib/dropbox-client", () => ({ getDropboxClient: () => ({}) }));
vi.mock("@/lib/ltab-dropbox", () => ({ saveFileToProvOrderFolder: m.saveDropbox }));
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
  m.get.mockResolvedValue({ statusCode: 200, stream: new Response(new Uint8Array([37, 80, 68])).body });
});

describe("Sūtīt atskaiti ar servera PDF", () => {
  it("atskaite ir pirmais pielikums, kopija Dropbox, versija, «Izpildīts», pagaidu PDF dzēsts", async () => {
    const res = await POST(req({ serverPdfPathname: PDF_PATH, markComplete: true }));
    const j = (await res.json()) as { ok: boolean; serverSend: { version: number; dropboxPath: string; completedAt: string } };
    expect(res.status).toBe(200);
    const sent = m.send.mock.calls[0]![0] as unknown as { attachments: { filename: string }[]; corrected: boolean; to: string };
    expect(sent.attachments[0]!.filename).toBe("PROVIN_AUDITS_WDC1671191A002835.pdf");
    expect(sent.corrected).toBe(false);
    expect(sent.to).toBe("gustavs.ansons@gmail.com");
    expect(m.saveDropbox).toHaveBeenCalledTimes(1);
    expect((m.saveDropbox.mock.calls[0] as unknown[])[2]).toBe("PROVIN_AUDITS_WDC1671191A002835.pdf");
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
    expect((m.saveDropbox.mock.calls[0] as unknown[])[2]).toBe("PROVIN_AUDITS_WDC1671191A002835_v2.pdf");
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
