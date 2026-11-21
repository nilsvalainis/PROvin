import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryConditionalStore } from "@/lib/conditional-write";

vi.mock("server-only", () => ({}));

const mem = createMemoryConditionalStore<string>();

vi.mock("@/lib/admin-order-draft-store", () => ({
  getOrderDraftBlobConfig: () => ({ token: "t", prefix: "drafts/" }),
  getOrderDraftStorageDir: () => null,
  isSafeOrderDraftSessionId: (id: string) => /^[a-zA-Z0-9_]+$/.test(id),
}));

vi.mock("@/lib/blob-read", () => ({
  readPrivateBlobText: async ({ pathname }: { pathname: string }) => {
    const snap = await mem.read(pathname);
    return snap.value == null ? { state: "missing" } : { state: "ok", text: snap.value, etag: snap.etag, rawEtag: snap.etag };
  },
}));

vi.mock("@/lib/blob-if-match-put", () => ({
  BLOB_CAS_ATTEMPTS: 6,
  putBlobBodyIfMatch: async (o: { pathname: string; body: string; etag: string | null }) => {
    await mem.write(o.pathname, o.body, o.etag);
    return { etag: null };
  },
}));

import { recordDealerSendOnServer } from "@/lib/order-client-marks-store";

describe("order-client-marks-store CAS", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL", "1");
  });

  it("parallel server sends keep both records", async () => {
    const at = "2026-11-21T10:00:00.000Z";
    await Promise.all([
      recordDealerSendOnServer("cs_a", { at, channel: "email", situation: "ready", offer: false, review: false }),
      recordDealerSendOnServer("cs_a", { at, channel: "whatsapp", situation: "ready", offer: false, review: true }),
    ]);
    const stored = JSON.parse(mem.peek("drafts/client_marks/cs_a.json") ?? "{}");
    expect(stored.dealerSends).toHaveLength(2);
    expect(stored.reviewRequestedAt).toBe(at);
    expect(JSON.stringify(stored)).not.toContain("@");
  });

  it("rejects unsafe session ids", async () => {
    expect(
      await recordDealerSendOnServer("../x", { at: "x", channel: "email", situation: "ready", offer: false, review: false }),
    ).toBeNull();
  });
});
