import { describe, expect, it, vi } from "vitest";

const audit = { calls: 0, fail: false };

vi.mock("@/lib/iriss-logistics-access", () => ({
  requireIrissLogisticsApi: async () => ({ ok: true, actor: { kind: "admin" } }),
  irissLogisticsScopeHeader: () => ({}),
  logisticsCabinetAccessQuery: (_actor: unknown, carId: string) => ({ userId: "admin", role: "admin", carId, admin: true }),
}));
vi.mock("@/lib/iriss-logistics-store", () => ({
  getLogisticsOrder: async (id: string) => (id === "lo-1" ? { id, status: "organize_pickup", pickupRef: "", pickupDate: "", updatedAt: "" } : null),
}));
vi.mock("@/lib/iriss-logistics-cabinet-store", () => ({
  listLiveCabinetDocuments: async () => [{ id: "d1", carId: "lo-1", section: "B", type: "pickup_pdf", deletedAt: "" }],
  getCabinetPickup: async () => null,
  listCabinetAccessRules: async () => [],
  appendCabinetAudit: async () => {
    audit.calls += 1;
    if (audit.fail) throw new Error("blob_write_failed");
  },
}));
vi.mock("@/lib/iriss-logistics-cabinet-access", () => ({
  buildCabinetAccessView: () => ({ write: true, hideSums: false, admin: true, sections: ["A", "B", "C"] }),
  filterDocumentsByCabinetAccess: (docs: unknown[]) => docs,
}));

import { GET } from "@/app/api/admin/iriss-logistics/orders/[id]/cabinet/route";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("GET Loģistikas kabinets", () => {
  it("skatījuma žurnāla kļūda nebloķē kabinetu (tiesības un dokumenti atnāk)", async () => {
    audit.fail = true;
    const res = await GET(new Request("http://x"), ctx("lo-1"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { access?: { write: boolean }; documents?: unknown[] };
    expect(body.access?.write).toBe(true);
    expect(body.documents).toHaveLength(1);
    expect(audit.calls).toBe(1);
  });

  it("nezināms auto - 404", async () => {
    const res = await GET(new Request("http://x"), ctx("lo-404"));
    expect(res.status).toBe(404);
  });
});
