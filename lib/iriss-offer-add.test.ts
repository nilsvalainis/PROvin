import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyIrissPasutijums, type IrissOfferRecord, type IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

const store = vi.hoisted(() => ({
  rec: null as IrissPasutijumsRecord | null,
  writes: [] as { record: IrissPasutijumsRecord; expected: number | null | undefined }[],
  staleOnce: false,
}));

vi.mock("@/lib/iriss-pasutijumi-store", () => ({
  readIrissPasutijums: vi.fn(async () => (store.rec ? structuredClone(store.rec) : null)),
  writeIrissPasutijums: vi.fn(async (record: IrissPasutijumsRecord, opts?: { expectedWorkspaceRevision?: number | null }) => {
    store.writes.push({ record, expected: opts?.expectedWorkspaceRevision });
    if (store.staleOnce) {
      store.staleOnce = false;
      store.rec = { ...store.rec!, workspaceRevision: (store.rec!.workspaceRevision ?? 0) + 1, notes: "cita cilne" };
      return { ok: false, error: "stale_revision", stale: true };
    }
    store.rec = { ...record, workspaceRevision: (record.workspaceRevision ?? 0) + 1 };
    return { ok: true, record: store.rec };
  }),
}));

import { addIrissOfferToOrder } from "@/lib/iriss-offer-add";

const OFFER_ID = "22222222-2222-4222-8222-222222222222";

function offer(): IrissOfferRecord {
  return { id: OFFER_ID, title: "Piedāvājums 1", brandModel: "BMW X5", attachments: [], sourceRef: "autoparks:car1" } as unknown as IrissOfferRecord;
}

beforeEach(() => {
  const base = emptyIrissPasutijums("11111111-1111-4111-8111-111111111111", "2026-10-20T10:00:00.000Z");
  store.rec = {
    ...base,
    clientFirstName: "Jānis",
    notes: "esošs",
    workspaceRevision: 4,
    offers: [{ ...offer(), id: "33333333-3333-4333-8333-333333333333", title: "Piedāvājums 1" }],
  };
  store.writes = [];
  store.staleOnce = false;
});

describe("addIrissOfferToOrder", () => {
  it("appends the offer, numbers it and keeps everything else", async () => {
    const r = await addIrissOfferToOrder(store.rec!.id, offer());
    expect(r).toMatchObject({ ok: true, offerId: OFFER_ID });
    expect(store.writes[0]?.expected).toBe(4);
    const saved = store.rec!;
    expect(saved.offers.map((o) => o.title)).toEqual(["Piedāvājums 1", "Piedāvājums 2"]);
    expect(saved.offers[1]?.sourceRef).toBe("autoparks:car1");
    expect(saved.clientFirstName).toBe("Jānis");
    expect(saved.notes).toBe("esošs");
  });

  it("retries on a concurrent save and keeps the other tab's changes", async () => {
    store.staleOnce = true;
    const r = await addIrissOfferToOrder(store.rec!.id, offer());
    expect(r.ok).toBe(true);
    expect(store.writes).toHaveLength(2);
    expect(store.rec!.notes).toBe("cita cilne");
    expect(store.rec!.offers).toHaveLength(2);
  });

  it("refuses duplicates, deleted orders and bad ids", async () => {
    await addIrissOfferToOrder(store.rec!.id, offer());
    expect(await addIrissOfferToOrder(store.rec!.id, offer())).toEqual({ ok: false, error: "exists" });
    store.rec = { ...store.rec!, deletedAt: "2026-10-21T00:00:00.000Z" };
    expect(await addIrissOfferToOrder(store.rec.id, { ...offer(), id: "44444444-4444-4444-8444-444444444444" })).toEqual({ ok: false, error: "not_found" });
    expect(await addIrissOfferToOrder("x", { ...offer(), id: "nav-uuid" })).toEqual({ ok: false, error: "invalid" });
  });
});
