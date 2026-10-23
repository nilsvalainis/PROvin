/**
 * Route vārti pēc DZĪVAJĀM sadaļām (nevis sīkdatnes): partneris (tikai Pavadzīmes) nesaņem pilno pavadzīmju
 * arhīvu, augšupielādi, izmaiņu vēsturi; darbinieks bez Pasūtījumiem neredz pasūtījuma ID; VIN vēsture (PRO) -
 * tikai administratoram.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IrissSection } from "@/lib/staff-roles";
import type { WaybillRequest } from "@/lib/iriss-waybill-requests";

const state = vi.hoisted(() => ({
  admin: false,
  sections: ["pavadzimes"] as IrissSection[],
  uploads: 0,
  historyReads: 0,
  vinHistoryReads: 0,
}));

vi.mock("@/lib/admin-auth", () => ({
  getAdminSession: async () => (state.admin ? { ok: true } : null),
  adminActorLabel: () => "Nils",
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "token" }), set: () => undefined }),
  headers: async () => new Headers(),
}));
vi.mock("@/lib/staff-session-token", async (orig) => ({
  ...(await orig<typeof import("@/lib/staff-session-token")>()),
  verifyStaffSessionToken: async () => ({ typ: "staff", sid: "ses_abcdefgh", uid: "usr_abcdefgh", role: "logistics", sections: [], exp: Date.now() + 60_000 }),
}));
vi.mock("@/lib/staff-store", () => ({
  resolveLiveStaffSession: async () => ({
    user: { id: "usr_abcdefgh", name: "Partneris", email: "p@example.lv", role: "logistics", sections: state.sections, status: "active" },
  }),
  touchStaffSession: async () => undefined,
  revokeStaffSession: async () => undefined,
}));

const request = {
  id: "req_1",
  createdBy: "usr_abcdefgh",
  createdByName: "Partneris",
  vehicle: { brandModel: "BMW 540d", vin: "WBA00000000000001", plate: "AB1234", orderId: "ord_secret" },
  status: "queued",
} as unknown as WaybillRequest;

vi.mock("@/lib/iriss-waybill-requests-store", () => ({
  readWaybillRequestsDoc: async () => ({ version: 1, updatedAt: "", requests: [request], events: [] }),
  createWaybillRequest: async () => request,
  retryWaybillRequest: async () => request,
  cancelWaybillRequest: async () => ({ ok: true, request }),
}));
vi.mock("@/lib/iriss-waybill-vehicles", () => ({
  listWaybillVehicleChips: async () => [{ chip: "BMW", brandModel: "BMW 540d", vin: "WBA00000000000001", plate: "AB1234", orderId: "ord_secret" }],
}));
vi.mock("@/lib/iriss-pavadzimes-store", () => ({
  readIrissPavadzimesCached: async () => [],
  listIrissPavadzimes: async () => ({ rows: [], pendingParse: 0, dropboxConfigured: true, dropboxError: null }),
  uploadIrissPavadzime: async () => {
    state.uploads += 1;
    return { id: "x" };
  },
  restoreIrissPavadzimeSnapshot: async () => null,
}));
vi.mock("@/lib/iriss-pasutijumi-store", () => ({
  listIrissPasutijumi: async () => [],
  readIrissPasutijums: async () => null,
  writeIrissPasutijums: async () => ({ ok: false, error: "x" }),
}));
vi.mock("@/lib/admin-change-history-store", () => ({
  listAdminChangeHistory: async () => {
    state.historyReads += 1;
    return [];
  },
  loadAdminChangeSnapshot: async () => null,
}));
vi.mock("@/lib/vin-history", () => ({
  findVinHistory: async () => {
    state.vinHistoryReads += 1;
    return [{ kind: "order", id: "cs_1", who: "PRO klients" }];
  },
  reuseVehicleData: async () => ({ ok: true, copied: [], conflicts: [] }),
}));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => undefined }));
vi.mock("@/lib/iriss-aivars-wake", () => ({ wakeAivars: async () => undefined }));

function asStaff(sections: IrissSection[]) {
  state.admin = false;
  state.sections = sections;
}

describe("staff API pēc dzīvajām sadaļām", () => {
  beforeEach(() => {
    state.uploads = 0;
    state.historyReads = 0;
    state.vinHistoryReads = 0;
  });
  afterEach(() => vi.clearAllMocks());

  it("partneris saņem tikai aktīvās pavadzīmes, ne pilno arhīvu", async () => {
    asStaff(["pavadzimes"]);
    const { GET } = await import("@/app/api/admin/iriss-pavadzimes/route");
    expect((await GET(new Request("https://www.provin.lv/api/admin/iriss-pavadzimes"))).status).toBe(403);
    expect((await GET(new Request("https://www.provin.lv/api/admin/iriss-pavadzimes?active=1"))).status).toBe(200);
    asStaff(["pavadzimes", "logistika"]);
    expect((await GET(new Request("https://www.provin.lv/api/admin/iriss-pavadzimes"))).status).toBe(200);
  });

  it("partneris nevar augšupielādēt PDF", async () => {
    asStaff(["pavadzimes"]);
    const { POST } = await import("@/app/api/admin/iriss-pavadzimes/upload/route");
    const res = await POST(new Request("https://www.provin.lv/api/admin/iriss-pavadzimes/upload", { method: "POST", body: new FormData() }));
    expect(res.status).toBe(403);
    expect(state.uploads).toBe(0);
  });

  it("partneris neredz un neatjauno izmaiņu vēsturi; darbinieks ar Pavadzīmēm + citu sadaļu - var", async () => {
    asStaff(["pavadzimes"]);
    const { GET } = await import("@/app/api/admin/change-history/route");
    const url = "https://www.provin.lv/api/admin/change-history?kind=iriss-waybill&id=abc12345";
    expect((await GET(new Request(url))).status).toBe(403);
    expect(state.historyReads).toBe(0);
    asStaff(["pavadzimes", "logistika"]);
    expect((await GET(new Request(url))).status).not.toBe(403);
  });

  it("pavadzīmju pieprasījumos nav pasūtījuma ID darbiniekam bez Pasūtījumiem", async () => {
    asStaff(["pavadzimes"]);
    const { GET } = await import("@/app/api/admin/iriss/waybill-requests/route");
    const json = JSON.stringify(await (await GET(new Request("https://www.provin.lv/api/admin/iriss/waybill-requests"))).json());
    expect(json).not.toContain("ord_secret");
    expect(json).toContain("WBA00000000000001");

    const byId = await import("@/app/api/admin/iriss/waybill-requests/[id]/route");
    const one = await byId.GET(new Request("https://www.provin.lv/x"), { params: Promise.resolve({ id: "req_1" }) });
    expect(JSON.stringify(await one.json())).not.toContain("ord_secret");
    for (const action of ["retry", "cancel"]) {
      const res = await byId.POST(new Request("https://www.provin.lv/x", { method: "POST", body: JSON.stringify({ action }) }), {
        params: Promise.resolve({ id: "req_1" }),
      });
      expect(res.status, action).toBe(200);
      expect(JSON.stringify(await res.json()), action).not.toContain("ord_secret");
    }

    asStaff(["pavadzimes", "pasutijumi"]);
    const withOrders = JSON.stringify(await (await GET(new Request("https://www.provin.lv/api/admin/iriss/waybill-requests"))).json());
    expect(withOrders).toContain("ord_secret");
  });

  it("VIN vēsture (PRO pasūtījumi un klienti) ir tikai administratoram, arī darbiniekam ar VIN pārbaudi", async () => {
    asStaff(["vin", "pavadzimes", "pasutijumi"]);
    const { GET, POST } = await import("@/app/api/admin/vin-history/route");
    expect((await GET(new Request("https://www.provin.lv/api/admin/vin-history?vin=WBA00000000000001"))).status).toBe(403);
    const post = await POST(
      new Request("https://www.provin.lv/api/admin/vin-history", { method: "POST", body: JSON.stringify({ sessionId: "cs_test_123", fromId: "x" }) }),
    );
    expect(post.status).toBe(403);
    expect(state.vinHistoryReads).toBe(0);
    state.admin = true;
    expect((await GET(new Request("https://www.provin.lv/api/admin/vin-history?vin=WBA00000000000001"))).status).toBe(200);
  });
});
