/**
 * Nils 20.11: transporta izmaksas (`transportCostEur`, Auto1 transporta rēķina summa) redz un labo tikai admins.
 * Loģistika, Serviss un Grāmatvede tās neredz nevienā atbildē un nevar pārrakstīt.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cabinetActorSeesTransportCost,
  maskOrderSums,
  stripAdminOnlyOrderFields,
} from "@/lib/iriss-logistics-cabinet-access";
import { ENV_ADMIN_USER_ID } from "@/lib/staff-roles";
import type { AdminOrStaffActor } from "@/lib/staff-auth";

const h = vi.hoisted(() => ({ actor: null as unknown, upserts: [] as Record<string, unknown>[] }));

vi.mock("@/lib/staff-auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/staff-auth")>()),
  requireLogisticsApi: async () => ({ ok: true, actor: h.actor }),
}));
vi.mock("next/server", async (orig) => {
  const mod = await orig<typeof import("next/server")>();
  return { ...mod, after: () => undefined };
});

const order = {
  id: "o-1",
  priceEur: 12500,
  transportCostEur: 240,
  transportCostAuto: true,
  notes: "",
  nextAction: "",
  statusNote: "",
  listingParsed: null,
  archivedState: "",
};

vi.mock("@/lib/iriss-logistics-store", () => ({
  getIrissLogisticsStorageState: () => ({ enabled: true, reason: "" }),
  listLogisticsOrders: async () => [order],
  listLogisticsPoints: async () => [],
  listPreviousLogisticsPoints: async () => [],
  getLogisticsOrder: async () => order,
  setLogisticsOrderArchiveState: async () => ({ ...order }),
  upsertLogisticsOrder: async (patch: Record<string, unknown>) => {
    h.upserts.push(patch);
    return { ...order, ...patch };
  },
}));
vi.mock("@/lib/iriss-logistics-cabinet-store", () => ({ listCabinetAccessRules: async () => [] }));

const ADMIN: AdminOrStaffActor = { kind: "admin", name: "Admins" };
function staff(sections: string[]): AdminOrStaffActor {
  return { kind: "staff", sessionId: "s", user: { id: `u-${sections.join("-")}`, name: "T", email: "t@x", sections } } as unknown as AdminOrStaffActor;
}
const LOGISTIKA = staff(["logistika"]);
const SERVISS = staff(["serviss"]);
const GRAMATVEDE = staff(["gramatvede"]);

const idCtx = { params: Promise.resolve({ id: "o-1" }) };
const patchReq = (body: unknown) =>
  new Request("http://x/api/admin/iriss-logistics/orders/o-1", { method: "PATCH", body: JSON.stringify(body) });

beforeEach(() => {
  h.actor = ADMIN;
  h.upserts.length = 0;
});

describe("transporta izmaksas - helperi", () => {
  it("tikai admins redz transporta izmaksas", () => {
    expect(cabinetActorSeesTransportCost({ userId: ENV_ADMIN_USER_ID, roles: [] })).toBe(true);
    for (const roles of [["logistika"], ["serviss"], ["gramatvede"]] as const) {
      expect(cabinetActorSeesTransportCost({ userId: "u-1", roles: [...roles] })).toBe(false);
    }
  });

  it("maskOrderSums slēpj transporta izmaksas arī bez hideSums (Grāmatvede)", () => {
    const masked = maskOrderSums(order, false, true);
    expect(masked.transportCostEur).toBeNull();
    expect(masked.transportCostAuto).toBe(false);
    expect(masked.priceEur).toBe(12500);
    expect(order.transportCostEur).toBe(240);
    expect(maskOrderSums(order, false, false)).toBe(order);
  });

  it("stripAdminOnlyOrderFields izmet transporta laukus", () => {
    expect(stripAdminOnlyOrderFields({ notes: "a", transportCostEur: 1, transportCostAuto: false })).toEqual({ notes: "a" });
  });
});

describe("API atbildes", () => {
  it("GET /orders/[id]: admins redz, Loģistika/Serviss/Grāmatvede - nē", async () => {
    const { GET } = await import("@/app/api/admin/iriss-logistics/orders/[id]/route");
    h.actor = ADMIN;
    let body = (await (await GET(new Request("http://x"), idCtx)).json()) as { order: typeof order };
    expect(body.order.transportCostEur).toBe(240);
    for (const actor of [LOGISTIKA, SERVISS, GRAMATVEDE]) {
      h.actor = actor;
      body = (await (await GET(new Request("http://x"), idCtx)).json()) as { order: typeof order };
      expect(body.order.transportCostEur).toBeNull();
      expect(body.order.transportCostAuto).toBe(false);
    }
  });

  it("GET saraksts: Loģistikai bez transporta izmaksām, adminam ar", async () => {
    const { GET } = await import("@/app/api/admin/iriss-logistics/route");
    h.actor = LOGISTIKA;
    let body = (await (await GET(new Request("http://x/api/admin/iriss-logistics?view=all"))).json()) as { orders: (typeof order)[] };
    expect(body.orders.length).toBeGreaterThan(0);
    expect(body.orders.every((o) => o.transportCostEur === null)).toBe(true);
    h.actor = ADMIN;
    body = (await (await GET(new Request("http://x/api/admin/iriss-logistics?view=all"))).json()) as { orders: (typeof order)[] };
    expect(body.orders[0]?.transportCostEur).toBe(240);
  });

  it("PATCH: Loģistika nevar pārrakstīt transporta izmaksas, admins var", async () => {
    const { PATCH } = await import("@/app/api/admin/iriss-logistics/orders/[id]/route");
    h.actor = LOGISTIKA;
    let res = await PATCH(patchReq({ notes: "x", transportCostEur: 1, transportCostAuto: false }), idCtx);
    expect(res.status).toBe(200);
    expect(h.upserts.at(-1)).not.toHaveProperty("transportCostEur");
    expect(h.upserts.at(-1)).not.toHaveProperty("transportCostAuto");
    expect(((await res.json()) as { order: typeof order }).order.transportCostEur).toBeNull();

    h.actor = ADMIN;
    res = await PATCH(patchReq({ transportCostEur: 300, transportCostAuto: false }), idCtx);
    expect(h.upserts.at(-1)).toMatchObject({ transportCostEur: 300, transportCostAuto: false });
    expect(((await res.json()) as { order: typeof order }).order.transportCostEur).toBe(300);
  });
});
