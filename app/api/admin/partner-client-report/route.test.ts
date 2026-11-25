import { beforeEach, describe, expect, it, vi } from "vitest";

const { persist, fetchBlob, del } = vi.hoisted(() => ({
  persist: vi.fn(async () => true),
  fetchBlob: vi.fn(),
  del: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-auth", () => ({ getAdminSession: async () => ({ user: "admin" }) }));
vi.mock("@/lib/admin-orders", () => ({ getCheckoutSessionDetail: async () => ({ id: "cs_test_partner_1" }) }));
vi.mock("@/lib/partner-client-report-storage", () => ({ persistClientReportFromNotify: persist }));
vi.mock("@/lib/email/notify-blob-attachments-fetch", () => ({
  fetchNotifyBlobAttachmentsForEmail: fetchBlob,
  deleteNotifyBlobUrls: del,
}));

import { POST } from "@/app/api/admin/partner-client-report/route";

const SID = "cs_test_partner_1";
const OWN = `https://abc.private.blob.vercel-storage.com/admin-notify-portfolio/${SID}/1-PROVIN.pdf`;

function jsonReq(body: unknown) {
  return new Request("http://localhost/api/admin/partner-client-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  persist.mockClear();
  fetchBlob.mockReset();
  del.mockClear();
  process.env.BLOB_READ_WRITE_TOKEN = "test-token";
});

describe("POST /api/admin/partner-client-report (Blob)", () => {
  it("lasa PDF no Blob, saglabā arhīvā un izdzēš pagaidu failu", async () => {
    fetchBlob.mockResolvedValue([{ filename: "PROVIN.pdf", content: Buffer.from("%PDF-1.4"), contentType: "application/pdf" }]);
    const res = await POST(jsonReq({ sessionId: SID, blobUrl: OWN, filename: "PROVIN.pdf" }));
    expect(res.status).toBe(200);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledWith([OWN], "test-token");
  });

  it("svešu saiti neņem un nedzēš", async () => {
    const res = await POST(jsonReq({ sessionId: SID, blobUrl: "https://abc.private.blob.vercel-storage.com/admin-notify-portfolio/cs_other_9/x.pdf" }));
    expect(res.status).toBe(400);
    expect(fetchBlob).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });

  it("par lielu -> 413 ar skaidru tekstu", async () => {
    fetchBlob.mockRejectedValue(new Error("attachments_too_large"));
    const res = await POST(jsonReq({ sessionId: SID, blobUrl: OWN }));
    expect(res.status).toBe(413);
    expect(((await res.json()) as { message: string }).message).toMatch(/^PDF ir par lielu/);
    expect(del).toHaveBeenCalled();
  });
});
