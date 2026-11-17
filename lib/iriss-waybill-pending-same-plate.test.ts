/**
 * FABLE 25.10: divi pieprasījumi vienam numuram, kamēr pirmais vēl "Gaida" (dubults klikšķis / divas ierīces),
 * abi nonāca rindā. Tagad otro noraida zem tās pašas slēdzenes (409 ar skaidru tekstu).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateWaybillInput } from "@/lib/iriss-waybill-create";
import { pendingWaybillRequestForPlate, WaybillPendingSamePlateError, type WaybillRequest } from "@/lib/iriss-waybill-requests";

const mem = vi.hoisted(() => ({ doc: null as unknown }));
vi.mock("@/lib/b2b-json-doc-store", () => ({
  createJsonDocStore: (opts: { parse: (raw: unknown) => unknown; empty: () => unknown }) => ({
    read: async () => opts.parse(mem.doc ?? opts.empty()),
    update: async (_key: string, fn: (doc: unknown) => Promise<{ value: unknown; next?: unknown }>) => {
      const decision = await fn(opts.parse(mem.doc ?? opts.empty()));
      if (decision.next !== undefined) mem.doc = JSON.parse(JSON.stringify(decision.next));
      return decision.value;
    },
  }),
}));
vi.mock("@/lib/staff-store", () => ({ appendStaffAudit: async () => {} }));
vi.mock("@/lib/admin-push", () => ({ sendAdminPush: vi.fn(async () => ({ sent: 0, removed: 0 })) }));
vi.mock("@/lib/iriss-waybill-csdd-plates-store", () => ({ saveCsddPlatesReport: vi.fn() }));

const { createWaybillRequest, readWaybillRequestsDoc, cancelWaybillRequest } = await import("@/lib/iriss-waybill-requests-store");

const future = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
const payload = (over: Partial<CreateWaybillInput> = {}): CreateWaybillInput => ({
  vin: "WVGZZZE2ZNP009103",
  plate: "B193-7",
  brandModel: "VW TIGUAN",
  orderId: "",
  routeFrom: "",
  routeTo: "",
  validFrom: new Date().toISOString(),
  validUntil: future(1),
  validDays: 1,
  validHours: 1,
  noteUntrusted: "",
  tradeAct: false,
  representative: "",
  ...over,
});
const create = (over: Partial<CreateWaybillInput> = {}) =>
  createWaybillRequest({ createdBy: "usr_1", createdByName: "Nils", payload: payload(over) });

beforeEach(() => {
  mem.doc = null;
});

describe("viens gaidošs pieprasījums uz numuru", () => {
  it("otrs uz to pašu numuru (arī cits formāts B1937) tiek noraidīts; rindā paliek viens", async () => {
    await create();
    await expect(create({ plate: "B1937" })).rejects.toBeInstanceOf(WaybillPendingSamePlateError);
    expect((await readWaybillRequestsDoc()).requests).toHaveLength(1);
  });

  it("vienlaicīgi divi - izdodas tikai viens", async () => {
    const results = await Promise.allSettled([create(), create()]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await readWaybillRequestsDoc()).requests).toHaveLength(1);
  });

  it("cits numurs - atļauts; pēc atcelšanas - atkal atļauts", async () => {
    const first = await create();
    await create({ plate: "B762-7" });
    await cancelWaybillRequest({ id: first.id, actorId: "usr_1", actorName: "Nils" });
    await create();
    expect((await readWaybillRequestsDoc()).requests).toHaveLength(3);
  });

  it("novecojis (24 h bez virzības) gaidošais neaizņem", () => {
    const old = new Date(Date.now() - 30 * 3_600_000).toISOString();
    const stale = { status: "queued", createdAt: old, updatedAt: old, validUntil: future(5), vehicle: { plate: "B193-7" } } as WaybillRequest;
    expect(pendingWaybillRequestForPlate([stale], "B193-7")).toBeNull();
  });
});
