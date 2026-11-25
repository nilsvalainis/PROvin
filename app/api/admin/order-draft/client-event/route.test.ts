import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-auth", () => ({ getAdminSession: async () => true }));
vi.mock("@/lib/admin-order-draft-store", () => ({
  isSafeOrderDraftSessionId: (id: string) => /^[a-zA-Z0-9_]+$/.test(id),
}));

import { POST } from "./route";

afterEach(() => vi.restoreAllMocks());

function req(body: unknown) {
  return new Request("http://x/api/admin/order-draft/client-event", { method: "POST", body: JSON.stringify(body) });
}

describe("client-event beacon", () => {
  it("žurnālē tikai sid, iemeslu un skaitļus - ne saturu", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const res = await POST(
      req({ sessionId: "cs_live_a1", event: "unsaved_not_sent", reason: "not_hydrated", fields: 3, blocks: 2, unsavedMs: 12000, iriss: "SLEPENS TEKSTS" }),
    );
    expect(res.status).toBe(204);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toBe("[workspace:client_unsaved_not_sent]");
    expect(JSON.stringify(warn.mock.calls[0])).not.toContain("SLEPENS");
    expect(warn.mock.calls[0]![1]).toMatchObject({ sessionId: "cs_live_a1", reason: "not_hydrated", fields: 3, blocks: 2 });
  });

  it("nezināmu notikumu vai sliktu sid ignorē", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await POST(req({ sessionId: "../x", event: "unsaved_not_sent" }));
    await POST(req({ sessionId: "cs_1", event: "drop_tables" }));
    expect(warn).not.toHaveBeenCalled();
  });
});
