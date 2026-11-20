import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeAutoparksCar } from "@/lib/iriss-autoparks";
import { emptyCarV2, type AutoparksCarV2 } from "@/lib/iriss-autoparks-v2";

const mem: { v2: AutoparksCarV2; history: Array<{ field: string; from: unknown; to: unknown }> } = { v2: emptyCarV2(), history: [] };
const car = normalizeAutoparksCar({ id: "ap-1", make: "Volvo", model: "XC60", year: "2013", status: "in_transit" })!;

vi.mock("@/lib/iriss-autoparks-v2-access", async () => {
  const { NextResponse } = await import("next/server");
  return {
    requireAutoparksV2Api: async () => ({ ok: true, perms: {}, actorId: "admin", actorName: "Admins" }),
    autoparksV2Json: (body: unknown, status = 200) => NextResponse.json(body, { status }),
  };
});
vi.mock("@/lib/iriss-autoparks-v2-store", () => ({
  readAutoparksV2Car: async (id: string) => (id === "ap-1" ? { car, v2: mem.v2 } : null),
  refreshAutoparksV2Tech: async (_c: unknown, v2: AutoparksCarV2) => v2,
  updateCarV2: async (_id: string, edit: (c: AutoparksCarV2) => { result: AutoparksCarV2; history?: Array<{ field: string; from: unknown; to: unknown }> }) => {
    const c = structuredClone(mem.v2);
    const out = edit(c);
    mem.v2 = c;
    mem.history.push(...(out.history ?? []));
    return out.result;
  },
}));

import { PATCH } from "@/app/api/admin/iriss-autoparks-v2/pamatdati/[id]/route";

function patch(body: unknown) {
  return PATCH(new Request("http://x", { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({ id: "ap-1" }) });
}

describe("PATCH Pamatdati - atslēgas, īpašnieki, otrs disku komplekts, TA/HU", () => {
  beforeEach(() => {
    mem.v2 = emptyCarV2();
    mem.history = [];
  });

  it("saglabā un atgriež pamatdatos, ar vēstures rindām", async () => {
    const res = await patch({ keysCount: 2, ownersCount: "3", secondWheels: " Ziemas uz diskiem ", inspectionUntil: "4/2028" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { basics: { extras: unknown } };
    expect(body.basics.extras).toEqual({ keysCount: 2, ownersCount: 3, secondWheels: "Ziemas uz diskiem", inspectionUntil: "04.2028" });
    expect(mem.history.map((h) => h.field).sort()).toEqual(["tech.inspectionUntil", "tech.keysCount", "tech.ownersCount", "tech.secondWheels"]);
  });

  it("notīrīšana ar tukšu vērtību", async () => {
    await patch({ keysCount: 2 });
    const res = await patch({ keysCount: "" });
    expect(((await res.json()) as { basics: { extras: { keysCount: unknown } } }).basics.extras.keysCount).toBeNull();
  });

  it("nederīga ievade - 400, nekas netiek mainīts", async () => {
    expect((await patch({ keysCount: "daudz" })).status).toBe(400);
    expect((await patch({ ownersCount: 1000 })).status).toBe(400);
    expect((await patch({ inspectionUntil: "13.2028" })).status).toBe(400);
    expect(mem.v2.tech.keysCount).toBeNull();
    expect(mem.history).toHaveLength(0);
  });
});

describe("PATCH Pamatdati - cenu lapas obligātie lauki (Nils 20.11)", () => {
  beforeEach(() => {
    mem.v2 = emptyCarV2();
    mem.history = [];
  });

  it("TL veids, degviela, sēdvietas, pilna masa, CO2, akta numurs - saglabā ar roku", async () => {
    const res = await patch({ vehicleType: "Vieglais plašlietojuma", fuel: "Dīzeļdegviela", seats: "5", grossMassKg: "2 530", co2GKm: 189, tradeActNo: "gdz00287" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { basics: { sale: Record<string, { value: unknown; csdd: boolean }> } };
    expect(body.basics.sale.vehicleType).toEqual({ value: "Vieglais plašlietojuma", csdd: false });
    expect(body.basics.sale.seats.value).toBe(5);
    expect(body.basics.sale.grossMassKg.value).toBe(2530);
    expect(body.basics.sale.co2GKm.value).toBe(189);
    expect(body.basics.sale.tradeActNo.value).toBe("GDZ00287");
    expect(mem.history.map((h) => h.field)).toContain("tech.tradeActNo");
  });

  it("neticama vērtība - 400; tukšs notīra", async () => {
    expect((await patch({ seats: "999" })).status).toBe(400);
    expect((await patch({ grossMassKg: "daudz" })).status).toBe(400);
    await patch({ seats: 7 });
    expect(mem.v2.tech.seats).toBe(7);
    await patch({ seats: "" });
    expect(mem.v2.tech.seats).toBeNull();
  });
});
