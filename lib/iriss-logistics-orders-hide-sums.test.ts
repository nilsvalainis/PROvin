/**
 * Nakts 07.11 lomu tests: Loģistika un Serviss neredz auto cenu (priceEur) ne sarakstā, ne arī atbildē pēc
 * savām darbībām ("Paņemts", "Atvests", punkta piešķiršana, pickup datums, "+ Nopirkts").
 * Grāmatvede un administrators cenu redz.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IrissSection } from "@/lib/staff-roles";
import type { AdminOrStaffActor } from "@/lib/staff-auth";

const state = vi.hoisted(() => ({
  actor: null as unknown as AdminOrStaffActor,
  writes: [] as Record<string, unknown>[],
}));

const order = {
  id: "ord_1",
  workspace: "iriss",
  source: "auction",
  make: "BMW",
  model: "X5",
  vin: "WBA00000000000001",
  title: "BMW X5",
  priceEur: 18450,
  status: "organize_pickup",
  notes: "Samaksāts 18 450 €, atslēgas 2",
  nextAction: "Pārskaitīt 450€ par transportu",
  statusNote: "",
};

vi.mock("@/lib/staff-auth", () => ({
  requireLogisticsApi: async () => ({ ok: true, actor: state.actor }),
}));
vi.mock("@/lib/iriss-logistics-store", () => ({
  getLogisticsOrder: async () => ({ ...order }),
  setLogisticsOrderArchiveState: async () => ({ ...order, status: "picked_up" }),
  upsertLogisticsOrder: async (patch: Record<string, unknown>) => {
    state.writes.push(patch);
    return { ...order, ...patch };
  },
  removeManualLogisticsOrder: async () => "removed",
}));

function staff(sections: IrissSection[]): AdminOrStaffActor {
  return {
    kind: "staff",
    sessionId: "ses_x",
    user: { id: "usr_x", name: "Tests", email: "t@example.lv", role: "logistics", sections, status: "active" },
  } as unknown as AdminOrStaffActor;
}

function jsonReq(method: string, body: unknown) {
  return new Request("https://www.provin.lv/api/admin/iriss-logistics/orders/ord_1", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ctx = { params: Promise.resolve({ id: "ord_1" }) };

async function priceAfter(call: () => Promise<Response>): Promise<unknown> {
  const res = await call();
  expect(res.status).toBe(200);
  const body = (await res.json()) as { order?: { priceEur?: unknown } };
  return body.order?.priceEur;
}

describe("Loģistikas pasūtījumu API: cenas šaurām lomām", () => {
  beforeEach(() => {
    state.actor = staff(["logistika"]);
    state.writes = [];
  });

  for (const [name, sections] of [
    ["Loģistika", ["logistika"]],
    ["Serviss", ["serviss"]],
  ] as const) {
    it(`${name}: GET, PATCH (darbība un lauki) un POST atbildē cenas nav`, async () => {
      state.actor = staff([...sections]);
      const byId = await import("@/app/api/admin/iriss-logistics/orders/[id]/route");
      const list = await import("@/app/api/admin/iriss-logistics/orders/route");
      expect(await priceAfter(() => byId.GET(new Request("https://www.provin.lv/x"), ctx))).toBeNull();
      expect(await priceAfter(() => byId.PATCH(jsonReq("PATCH", { action: "picked_up" }), ctx))).toBeNull();
      expect(await priceAfter(() => byId.PATCH(jsonReq("PATCH", { pickupDate: "2026-11-08" }), ctx))).toBeNull();
      expect(await priceAfter(() => list.POST(jsonReq("POST", { make: "Audi", priceEur: 9000 })))).toBeNull();
    });
  }

  it("Grāmatvede un administrators cenu redz", async () => {
    const byId = await import("@/app/api/admin/iriss-logistics/orders/[id]/route");
    state.actor = staff(["gramatvede"]);
    expect(await priceAfter(() => byId.GET(new Request("https://www.provin.lv/x"), ctx))).toBe(18450);
    state.actor = { kind: "admin", name: "Nils" };
    expect(await priceAfter(() => byId.PATCH(jsonReq("PATCH", { action: "picked_up" }), ctx))).toBe(18450);
  });
});

describe("Loģistikas pasūtījumu API: € summas brīvtekstā (17.11 prod tests)", () => {
  beforeEach(() => {
    state.actor = staff(["logistika"]);
    state.writes = [];
  });

  it("Loģistika: piezīmēs un nākamajā solī summas aizstātas, pārējais teksts paliek", async () => {
    const byId = await import("@/app/api/admin/iriss-logistics/orders/[id]/route");
    const res = await byId.GET(new Request("https://www.provin.lv/x"), ctx);
    const body = (await res.json()) as { order: Record<string, unknown> };
    expect(body.order.notes).toBe("Samaksāts •• €, atslēgas 2");
    expect(body.order.nextAction).toBe("Pārskaitīt •• € par transportu");
    expect(JSON.stringify(body.order)).not.toMatch(/18 ?450|450€/);
  });

  it("Loģistika saglabā citus laukus ar nemainītu maskēto piezīmi - glabātās summas netiek pārrakstītas", async () => {
    const byId = await import("@/app/api/admin/iriss-logistics/orders/[id]/route");
    const res = await byId.PATCH(
      jsonReq("PATCH", { pickupDate: "2026-11-20", notes: "Samaksāts •• €, atslēgas 2", priceEur: null }),
      ctx,
    );
    expect(res.status).toBe(200);
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0]).toMatchObject({ pickupDate: "2026-11-20" });
    expect(state.writes[0]).not.toHaveProperty("notes");
    expect(state.writes[0]).not.toHaveProperty("priceEur");
  });

  it("Loģistika nevar saglabāt laboto piezīmi ar slēptu summu - 409, nekas netiek rakstīts", async () => {
    const byId = await import("@/app/api/admin/iriss-logistics/orders/[id]/route");
    const res = await byId.PATCH(jsonReq("PATCH", { notes: "Samaksāts •• €, atslēgas 3" }), ctx);
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toBe("hidden_sums_in_text");
    expect(state.writes).toHaveLength(0);
  });

  it("Loģistika var piezīmi pārrakstīt pilnībā (bez slēptās summas aizstājēja)", async () => {
    const byId = await import("@/app/api/admin/iriss-logistics/orders/[id]/route");
    const res = await byId.PATCH(jsonReq("PATCH", { notes: "Atslēgas pie vārtiem" }), ctx);
    expect(res.status).toBe(200);
    expect(state.writes[0]).toMatchObject({ notes: "Atslēgas pie vārtiem" });
  });

  it("Administrators piezīmes redz un raksta bez izmaiņām", async () => {
    state.actor = { kind: "admin", name: "Nils" } as unknown as AdminOrStaffActor;
    const byId = await import("@/app/api/admin/iriss-logistics/orders/[id]/route");
    const res = await byId.GET(new Request("https://www.provin.lv/x"), ctx);
    expect(((await res.json()) as { order: { notes: string } }).order.notes).toBe("Samaksāts 18 450 €, atslēgas 2");
    await byId.PATCH(jsonReq("PATCH", { notes: "Samaksāts •• €", priceEur: 19000 }), ctx);
    expect(state.writes[0]).toMatchObject({ notes: "Samaksāts •• €", priceEur: 19000 });
  });
});
