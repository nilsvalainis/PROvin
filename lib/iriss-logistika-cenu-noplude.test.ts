/**
 * Drošība (20.11): IRISS «Loģistika» loma (hideSums) API atbildēs neredz cenas, rēķinus un tāmes.
 * Admins un Grāmatvede redz visu kā līdz šim.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeAutoparksCar, normalizeAutoparksFile, type AutoparksFile } from "@/lib/iriss-autoparks";
import { maskOrderSums } from "@/lib/iriss-logistics-cabinet-access";
import type { AdminOrStaffActor } from "@/lib/staff-auth";

const h = vi.hoisted(() => ({ actor: null as unknown }));

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
  notes: "samaksāts 12 500 €",
  nextAction: "",
  statusNote: "",
  listingParsed: { make: "Volvo", model: "XC60", vin: "", priceEur: 12500, mileageKm: 100000, address: "", source: "x", parsedAt: "" },
  archivedState: "",
};

vi.mock("@/lib/iriss-logistics-store", () => ({
  listLogisticsOrders: async () => [order],
  getLogisticsOrder: async () => order,
  setLogisticsOrderArchiveState: async () => ({ ...order }),
}));
vi.mock("@/lib/iriss-logistics-archive", () => ({ isLogisticsOrderActive: () => true }));
vi.mock("@/lib/iriss-logistics-cabinet-store", () => ({
  listCabinetDocuments: async () => [],
  listCabinetPickups: async () => [],
  upsertCabinetPickup: async () => undefined,
  listCabinetAccessRules: async () => [],
  listLiveCabinetDocuments: async () => [],
}));
vi.mock("@/lib/iriss-logistics-cargo-store", () => ({
  loadCargoPlanForActiveOrders: async () => ({ cars: [] }),
  listRouteTemplates: async () => [],
  saveCargoPlanForActiveOrders: async () => ({ cars: [] }),
}));

const car = normalizeAutoparksCar({ id: "ap-1", make: "Volvo", model: "XC60", purchasePriceEur: 9000, salePriceEur: 14000 })!;
const file = (id: string, kind: string): AutoparksFile =>
  normalizeAutoparksFile({ id, carId: "ap-1", stage: "service", kind, title: id, fileName: `${id}.pdf`, contentType: "application/pdf", size: 10, blobPath: `b/${id}`, createdAt: "2026-11-20T10:00:00Z" })!;
const files = [file("f-inv", "invoice"), file("f-est", "estimate"), file("f-con", "contract"), file("f-oth", "other")];
const merged: string[][] = [];

vi.mock("@/lib/iriss-autoparks-store", () => ({
  getAutoparksRoom: async () => ({ car, files, notes: [], work: [{ id: "w", carId: "ap-1", title: "Eļļa", qty: 1, priceEur: 80, done: false, createdAt: "" }], events: [] }),
  findAutoparksFile: async (id: string) => {
    const f = files.find((x) => x.id === id);
    return f ? { file: f, car } : null;
  },
  readAutoparksFileBytes: async (id: string) => {
    const f = files.find((x) => x.id === id);
    return f ? { file: f, car, bytes: Buffer.from(id), contentType: "application/pdf" } : null;
  },
  patchAutoparksFile: async (id: string) => files.find((x) => x.id === id) ?? null,
  softDeleteAutoparksFile: async (id: string) => files.find((x) => x.id === id) ?? null,
  ensureAutoparksCarFromOrder: async () => ({ car, created: true }),
  markAutoparksCarArrived: async () => car,
  createAutoparksCar: async () => car,
  readAutoparksState: async () => ({ version: 1, cars: [car], files, notes: [], work: [], events: [] }),
  addAutoparksNote: async () => undefined,
  deleteAutoparksCar: async () => undefined,
  patchAutoparksCar: async () => car,
  replaceAutoparksWork: async () => undefined,
  setAutoparksArchived: async () => undefined,
}));
vi.mock("@/lib/iriss-autoparks-pdf", () => ({
  mergePdfs: async (bytes: Buffer[]) => {
    merged.push(bytes.map((b) => b.toString()));
    return { bytes: Buffer.from("%PDF"), skipped: 0 };
  },
}));
vi.mock("@/lib/iriss-autoparks-files", () => ({
  autoparksTemporaryLink: async () => null,
  readAutoparksThumbnail: async () => null,
}));
vi.mock("@/lib/iriss-autoparks-dropbox-sync", () => ({ linkAutoparksCarToDropbox: async () => undefined }));

const ADMIN: AdminOrStaffActor = { kind: "admin", name: "Admins" };
function staff(sections: string[]): AdminOrStaffActor {
  return { kind: "staff", sessionId: "s", user: { id: `u-${sections.join("-")}`, name: "T", email: "t@x", sections } } as unknown as AdminOrStaffActor;
}
const LOGISTIKA = staff(["logistika"]);
const GRAMATVEDE = staff(["gramatvede"]);
const SERVISS = staff(["serviss"]);

const idCtx = { params: Promise.resolve({ id: "ap-1" }) };
const fileCtx = (fileId: string) => ({ params: Promise.resolve({ fileId }) });

beforeEach(() => {
  h.actor = ADMIN;
  merged.length = 0;
});

describe("maskOrderSums", () => {
  it("masko arī listingParsed.priceEur; bez hideSums nemaina neko", () => {
    const masked = maskOrderSums(order, true, true);
    expect(masked.priceEur).toBeNull();
    expect(masked.listingParsed.priceEur).toBeNull();
    expect(masked.listingParsed.mileageKm).toBe(100000);
    expect(masked.notes).not.toContain("12 500");
    expect(order.listingParsed.priceEur).toBe(12500);
    expect(maskOrderSums(order, false, false)).toBe(order);
  });
});

describe("GET /cargo-plan", () => {
  it("neatdod pasūtījumus nevienai lomai", async () => {
    const { GET } = await import("@/app/api/admin/iriss-logistics/cargo-plan/route");
    for (const actor of [ADMIN, LOGISTIKA]) {
      h.actor = actor;
      const body = (await (await GET()).json()) as Record<string, unknown>;
      expect(body.ok).toBe(true);
      expect(body).not.toHaveProperty("orders");
      expect(JSON.stringify(body)).not.toContain("12500");
      expect(body).toHaveProperty("docCounts");
    }
  });
});

describe("Autoparka istaba - faili", () => {
  it("Loģistika neredz rēķinus/tāmes un cenas; Serviss redz failus bez cenām; admins un grāmatvede redz visu", async () => {
    const { GET } = await import("@/app/api/admin/iriss-logistics/autoparks/[id]/route");
    h.actor = LOGISTIKA;
    const lg = (await (await GET(new Request("http://x"), idCtx)).json()) as { room: { car: Record<string, unknown>; files: AutoparksFile[]; work: Array<{ priceEur: unknown }> } };
    expect(lg.room.files.map((f) => f.id).sort()).toEqual(["f-con", "f-oth"]);
    expect(lg.room.car.purchasePriceEur).toBeNull();
    expect(lg.room.work[0].priceEur).toBeNull();

    h.actor = SERVISS;
    const sv = (await (await GET(new Request("http://x"), idCtx)).json()) as { room: { car: Record<string, unknown>; files: AutoparksFile[] } };
    expect(sv.room.files).toHaveLength(4);
    expect(sv.room.car.purchasePriceEur).toBeNull();

    for (const actor of [ADMIN, GRAMATVEDE]) {
      h.actor = actor;
      const full = (await (await GET(new Request("http://x"), idCtx)).json()) as { room: { car: Record<string, unknown>; files: AutoparksFile[] } };
      expect(full.room.files).toHaveLength(4);
      expect(full.room.car.purchasePriceEur).toBe(9000);
    }
  });

  it("lejupielāde/sīktēls/labošana/dzēšana: Loģistikai rēķins un tāme 403, Servisam un adminam OK", async () => {
    const route = await import("@/app/api/admin/iriss-logistics/autoparks/files/[fileId]/route");
    h.actor = LOGISTIKA;
    for (const id of ["f-inv", "f-est"]) {
      expect((await route.GET(new Request("http://x?dl=1"), fileCtx(id))).status).toBe(403);
      expect((await route.GET(new Request("http://x?thumb=1"), fileCtx(id))).status).toBe(403);
      expect((await route.PATCH(new Request("http://x", { method: "PATCH", body: JSON.stringify({ kind: "other" }) }), fileCtx(id))).status).toBe(403);
      expect((await route.DELETE(new Request("http://x", { method: "DELETE" }), fileCtx(id))).status).toBe(403);
    }
    expect((await route.GET(new Request("http://x"), fileCtx("f-con"))).status).toBe(200);
    h.actor = SERVISS;
    expect((await route.GET(new Request("http://x"), fileCtx("f-inv"))).status).toBe(200);
    expect((await route.GET(new Request("http://x?dl=1"), fileCtx("f-est"))).status).toBe(200);
    h.actor = ADMIN;
    expect((await route.GET(new Request("http://x"), fileCtx("f-inv"))).status).toBe(200);
    expect((await route.PATCH(new Request("http://x", { method: "PATCH", body: JSON.stringify({}) }), fileCtx("f-inv"))).status).toBe(200);
  });

  it("PDF kopfails: Loģistikai bez rēķiniem/tāmēm, Servisam un adminam visi", async () => {
    const { GET } = await import("@/app/api/admin/iriss-logistics/autoparks/[id]/bundle/route");
    h.actor = LOGISTIKA;
    expect((await GET(new Request("http://x"), idCtx)).status).toBe(200);
    expect(merged.at(-1)!.sort()).toEqual(["f-con", "f-oth"]);
    h.actor = SERVISS;
    expect((await GET(new Request("http://x"), idCtx)).status).toBe(200);
    expect(merged.at(-1)).toHaveLength(4);
    h.actor = ADMIN;
    expect((await GET(new Request("http://x"), idCtx)).status).toBe(200);
    expect(merged.at(-1)).toHaveLength(4);
  });
});

describe("POST /autoparks ar fromOrderId", () => {
  const post = () =>
    import("@/app/api/admin/iriss-logistics/autoparks/route").then(({ POST }) =>
      POST(new Request("http://x", { method: "POST", body: JSON.stringify({ fromOrderId: "o-1" }) })),
    );

  it("Loģistikai auto un pasūtījums bez cenām", async () => {
    h.actor = LOGISTIKA;
    const body = (await (await post()).json()) as { car: Record<string, unknown>; order: typeof order };
    expect(body.car.purchasePriceEur).toBeNull();
    expect(body.car.salePriceEur).toBeNull();
    expect(body.order.priceEur).toBeNull();
    expect(body.order.listingParsed.priceEur).toBeNull();
  });

  it("adminam cenas paliek", async () => {
    const body = (await (await post()).json()) as { car: Record<string, unknown>; order: typeof order };
    expect(body.car.purchasePriceEur).toBe(9000);
    expect(body.order.priceEur).toBe(12500);
  });
});
