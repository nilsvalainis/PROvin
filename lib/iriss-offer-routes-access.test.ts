/**
 * F6 testu matrica: piedāvājuma veidošanas maršrutu tiesības (Nila atbilde 5 - tikai ar Pasūtījumu tiesību),
 * avota sadaļa (Autoparks / Loģistika), Loģistikas summas paslēptas lomām logistika/serviss,
 * grāmatvede redz tikai piešķirtos auto. Datu krātuve - aizstāta (nekas netiek rakstīts).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IrissSection } from "@/lib/staff-roles";

const state = vi.hoisted(() => ({
  actor: null as null | { kind: "admin"; name: string } | { kind: "staff"; user: { id: string; name: string; email: string; sections: IrissSection[] } },
  seedCalls: [] as { ref: unknown; opts: unknown }[],
  photoCalls: 0,
  addCalls: 0,
  rules: [] as unknown[],
}));

vi.mock("@/lib/staff-auth", async () => {
  const { NextResponse } = await import("next/server");
  return {
    requireIrissSectionApi: async (section: IrissSection) => {
      const a = state.actor;
      if (!a) return { ok: false, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
      if (a.kind === "admin" || a.user.sections.includes(section)) return { ok: true, actor: a };
      return { ok: false, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
    },
  };
});
vi.mock("@/lib/iriss-logistics-cabinet-store", () => ({ listCabinetAccessRules: async () => state.rules }));
vi.mock("@/lib/iriss-offer-source", () => ({
  loadOfferSeed: async (ref: unknown, opts: unknown) => {
    state.seedCalls.push({ ref, opts });
    return { sourceRef: "x", fields: {}, autoFields: [], attachments: [], photosNote: "" };
  },
  readOfferSourcePhoto: async () => {
    state.photoCalls += 1;
    return Buffer.from([0xff, 0xd8]);
  },
}));
vi.mock("@/lib/iriss-autoparks-store", () => ({
  readAutoparksState: async () => ({
    cars: [{ id: "car1", make: "BMW", model: "X5", year: "2021", color: "melna", vin: "WBA1", status: "for_sale", archivedAt: "", purchasePriceEur: 30000, salePriceEur: 39000 }],
  }),
}));
vi.mock("@/lib/iriss-logistics-store", () => ({
  listLogisticsOrders: async () => [{ id: "log1", make: "Audi", model: "A6", title: "", vin: "WAU1", stockNo: "S1", archived: false, status: "ready", priceEur: 15400 }],
}));
vi.mock("@/lib/iriss-offer-add", () => ({
  addIrissOfferToOrder: async () => {
    state.addCalls += 1;
    return { ok: true, offerId: "22222222-2222-4222-8222-222222222222" };
  },
}));

import { GET as seedGET } from "@/app/api/admin/iriss-offer-seed/route";
import { GET as photoGET } from "@/app/api/admin/iriss-offer-seed/photo/route";
import { GET as carsGET } from "@/app/api/admin/iriss-offer-seed/cars/route";
import { POST as offersPOST } from "@/app/api/admin/iriss-pasutijumi/[id]/offers/route";

const ORDER = "11111111-1111-4111-8111-111111111111";
const staff = (sections: IrissSection[]) => ({ kind: "staff" as const, user: { id: "usr_abcdefgh", name: "Darbinieks", email: "d@example.lv", sections } });
const seed = (from: string) => seedGET(new Request(`http://x/api/admin/iriss-offer-seed?from=${encodeURIComponent(from)}`));
const photo = (from: string) => photoGET(new Request(`http://x/api/admin/iriss-offer-seed/photo?from=${encodeURIComponent(from)}&id=id:abcdefgh1234`));
const cars = (kind: string) => carsGET(new Request(`http://x/api/admin/iriss-offer-seed/cars?kind=${kind}`));
const addOffer = () =>
  offersPOST(
    new Request(`http://x/api/admin/iriss-pasutijumi/${ORDER}/offers`, {
      method: "POST",
      body: JSON.stringify({ offer: { id: "22222222-2222-4222-8222-222222222222", title: "Piedāvājums 1", attachments: [] } }),
    }),
    { params: Promise.resolve({ id: ORDER }) },
  );

beforeEach(() => {
  state.actor = null;
  state.seedCalls = [];
  state.photoCalls = 0;
  state.addCalls = 0;
  state.rules = [];
});

describe("piedāvājuma maršrutu tiesības", () => {
  it("bez sesijas - 401, nekas netiek nolasīts", async () => {
    expect((await seed("autoparks:car1")).status).toBe(401);
    expect((await photo("autoparks:car1")).status).toBe(401);
    expect((await cars("autoparks")).status).toBe(401);
    expect((await addOffer()).status).toBe(401);
    expect(state.seedCalls.length + state.photoCalls + state.addCalls).toBe(0);
  });

  it("darbinieks bez Pasūtījumu tiesības - 403 visur (arī ar Autoparku/Loģistiku)", async () => {
    state.actor = staff(["logistika", "ap_pamatdati"]);
    expect((await seed("logistics:log1")).status).toBe(403);
    expect((await photo("autoparks:car1")).status).toBe(403);
    expect((await cars("logistics")).status).toBe(403);
    expect((await addOffer()).status).toBe(403);
    expect(state.seedCalls.length + state.photoCalls + state.addCalls).toBe(0);
  });

  it("Pasūtījumi bez avota sadaļas - avota dati un bildes netiek doti", async () => {
    state.actor = staff(["pasutijumi"]);
    expect((await seed("autoparks:car1")).status).toBe(403);
    expect((await seed("logistics:log1")).status).toBe(403);
    expect((await photo("logistics:log1")).status).toBe(403);
    expect((await cars("autoparks")).status).toBe(403);
    expect(state.seedCalls.length + state.photoCalls).toBe(0);
    expect((await addOffer()).status).toBe(200);
  });

  it("Loģistikas loma redz auto, bet ne cenu; admins - ar cenu", async () => {
    state.actor = staff(["pasutijumi", "logistika"]);
    expect((await seed("logistics:log1")).status).toBe(200);
    expect(state.seedCalls.at(-1)?.opts).toEqual({ hideSums: true });
    state.actor = { kind: "admin", name: "Nils" };
    expect((await seed("logistics:log1")).status).toBe(200);
    expect(state.seedCalls.at(-1)?.opts).toEqual({ hideSums: false });
  });

  it("grāmatvede (bez Loģistikas sadaļas) Loģistikas auto datus nesaņem", async () => {
    state.actor = staff(["pasutijumi", "gramatvede"] as IrissSection[]);
    expect((await seed("logistics:log1")).status).toBe(403);
    expect((await photo("logistics:log1")).status).toBe(403);
    expect(state.seedCalls.length + state.photoCalls).toBe(0);
  });

  it("auto saraksts bez summām", async () => {
    state.actor = { kind: "admin", name: "Nils" };
    const ap = (await (await cars("autoparks")).json()) as { rows: Record<string, unknown>[] };
    const lo = (await (await cars("logistics")).json()) as { rows: Record<string, unknown>[] };
    expect(ap.rows).toEqual([{ id: "car1", title: "BMW X5", sub: "2021 · melna", search: expect.any(String) }]);
    expect(JSON.stringify(ap.rows) + JSON.stringify(lo.rows)).not.toMatch(/30000|39000|15400|Price/);
    expect((await cars("cits")).status).toBe(400);
  });
});
