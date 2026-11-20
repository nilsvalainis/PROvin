/**
 * P3 (IRISS audits 20.11): Loģistikas kartīte lasa kopējos auto laukus no saistītā Autoparka auto,
 * labojums raksta Autoparkā (ne Loģistikā); bez «Pamatdati» tiesības - tikai lasīt. Summu maska paliek.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyCarV2, type AutoparksCarV2 } from "@/lib/iriss-autoparks-v2";
import type { IrissSection } from "@/lib/staff-roles";
import type { AdminOrStaffActor } from "@/lib/staff-auth";

const VIN = "WBA5R1C0XLFH42873";

const state = vi.hoisted(() => ({
  actor: null as unknown as AdminOrStaffActor,
  logisticsWrites: [] as Record<string, unknown>[],
  v2: {} as Record<string, unknown>,
  linked: true,
}));

const order = {
  id: "ord_1",
  workspace: "iriss",
  source: "auction",
  make: "BMW",
  model: "3 sērija",
  vin: "",
  title: "BMW 3 sērija",
  priceEur: 18450,
  mileageKm: 90000,
  status: "organize_pickup",
  notes: "Samaksāts 18 450 €",
  nextAction: "",
  statusNote: "",
  pickupDate: "",
};

vi.mock("@/lib/staff-auth", () => ({
  requireLogisticsApi: async () => ({ ok: true, actor: state.actor }),
}));
vi.mock("@/lib/iriss-logistics-store", () => ({
  getLogisticsOrder: async () => ({ ...order }),
  setLogisticsOrderArchiveState: async () => ({ ...order }),
  upsertLogisticsOrder: async (patch: Record<string, unknown>) => {
    state.logisticsWrites.push(patch);
    return { ...order, ...patch };
  },
  removeManualLogisticsOrder: async () => "removed",
}));
vi.mock("@/lib/iriss-autoparks-store", () => ({
  readAutoparksState: async () => ({
    cars: state.linked
      ? [{ id: "ap-1", orderId: "ord_1", vin: VIN, make: "BMW", model: "320d", year: "2019", color: "Melna", mileageKm: 91500, status: "in_transit" }]
      : [],
  }),
  syncAutoparksCarWithLogisticsAction: async () => null,
}));
vi.mock("@/lib/iriss-autoparks-v2-store", () => ({
  readAutoparksV2State: async () => ({ cars: state.v2, history: [] }),
  updateCarV2: async (carId: string, edit: (c: AutoparksCarV2) => { result: unknown; write?: boolean }) => {
    const c = structuredClone((state.v2[carId] as AutoparksCarV2 | undefined) ?? emptyCarV2());
    const out = edit(c);
    if (out.write !== false) state.v2[carId] = c;
    return out.result;
  },
}));

function staff(sections: IrissSection[]): AdminOrStaffActor {
  return {
    kind: "staff",
    sessionId: "ses_x",
    user: { id: "usr_x", name: "Tests", email: "t@example.lv", role: "logistics", sections, status: "active" },
  } as unknown as AdminOrStaffActor;
}
const admin = { kind: "admin", name: "Nils" } as unknown as AdminOrStaffActor;

function patchReq(body: unknown) {
  return new Request("https://www.provin.lv/api/admin/iriss-logistics/orders/ord_1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
const ctx = { params: Promise.resolve({ id: "ord_1" }) };

describe("P3 viens avots: Loģistikas pasūtījuma API", () => {
  beforeEach(() => {
    state.actor = admin;
    state.logisticsWrites = [];
    state.v2 = {};
    state.linked = true;
    process.env.IRISS_AUTOPARKS_V2_STAFF = "1";
  });

  it("GET: kopējie lauki no Autoparka, Loģistikai cena joprojām slēpta", async () => {
    state.actor = staff(["logistika"]);
    const { GET } = await import("@/app/api/admin/iriss-logistics/orders/[id]/route");
    const body = (await (await GET(new Request("https://x"), ctx)).json()) as { order: Record<string, unknown> };
    expect(body.order).toMatchObject({ vin: VIN, model: "320d", title: "BMW 320d", mileageKm: 91500, year: "2019", color: "Melna", autoparksCarId: "ap-1" });
    expect(body.order.carFieldsReadOnly).toBe(true);
    expect(body.order.priceEur).toBeNull();
  });

  it("PATCH (admins): modelis/km tiek rakstīti Autoparkā, nevis Loģistikā", async () => {
    const { PATCH } = await import("@/app/api/admin/iriss-logistics/orders/[id]/route");
    const res = await PATCH(patchReq({ model: "330e", mileageKm: 92000, pickupDate: "2026-11-21" }), ctx);
    expect(res.status).toBe(200);
    const v2 = state.v2["ap-1"] as AutoparksCarV2;
    expect(v2.fields.model).toBe("330e");
    expect(v2.tech.mileageKm).toBe(92000);
    expect(state.logisticsWrites).toEqual([{ pickupDate: "2026-11-21", id: "ord_1" }]);
    const body = (await res.json()) as { order: Record<string, unknown> };
    expect(body.order).toMatchObject({ model: "330e", title: "BMW 330e", mileageKm: 92000 });
  });

  it("PATCH: Loģistika bez ap_pamatdati auto laukus labot nedrīkst (403), transportu - drīkst", async () => {
    state.actor = staff(["logistika"]);
    const { PATCH } = await import("@/app/api/admin/iriss-logistics/orders/[id]/route");
    const denied = await PATCH(patchReq({ model: "330e" }), ctx);
    expect(denied.status).toBe(403);
    expect(((await denied.json()) as { error: string }).error).toBe("car_fields_read_only");
    expect(state.v2["ap-1"]).toBeUndefined();
    expect(state.logisticsWrites).toEqual([]);
    const ok = await PATCH(patchReq({ pickupDate: "2026-11-22", model: "320d" }), ctx);
    expect(ok.status).toBe(200);
    expect(state.logisticsWrites).toEqual([{ pickupDate: "2026-11-22", id: "ord_1" }]);
  });

  it("PATCH: Loģistika ar ap_pamatdati labo Autoparka auto", async () => {
    state.actor = staff(["logistika", "ap_pamatdati"]);
    const { PATCH } = await import("@/app/api/admin/iriss-logistics/orders/[id]/route");
    const res = await PATCH(patchReq({ color: "Balta" }), ctx);
    expect(res.status).toBe(200);
    expect((state.v2["ap-1"] as AutoparksCarV2).fields.color).toBe("Balta");
    expect(state.logisticsWrites).toEqual([]);
  });

  it("bez saistīta auto - kā līdz šim (Loģistikas lauki)", async () => {
    state.linked = false;
    state.actor = staff(["logistika"]);
    const { PATCH } = await import("@/app/api/admin/iriss-logistics/orders/[id]/route");
    const res = await PATCH(patchReq({ model: "330e" }), ctx);
    expect(res.status).toBe(200);
    expect(state.logisticsWrites).toEqual([{ model: "330e", id: "ord_1" }]);
    const body = (await res.json()) as { order: Record<string, unknown> };
    expect(body.order.autoparksCarId).toBeUndefined();
  });
});
