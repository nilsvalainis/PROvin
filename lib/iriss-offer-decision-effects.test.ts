import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@vercel/blob", () => ({
  get: vi.fn(async () => {
    throw new Error("blob disabled in test");
  }),
  put: vi.fn(async () => {
    throw new Error("blob disabled in test");
  }),
  del: vi.fn(async () => undefined),
  list: vi.fn(async () => ({ blobs: [] })),
}));

import { emptyIrissOfferRecord, emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const OFFER_ID = "22222222-2222-4222-8222-222222222222";

describe("IRISS offer decision effects", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
    dirs.length = 0;
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  async function load() {
    const dir = mkdtempSync(path.join(os.tmpdir(), "iriss-offer-effects-"));
    dirs.push(dir);
    vi.unstubAllEnvs();
    vi.stubEnv("ADMIN_IRISS_PASUTIJUMI_DIR", dir);
    vi.stubEnv("VERCEL", "");
    vi.resetModules();
    const effects = await import("@/lib/iriss-offer-decision-effects");
    const orders = await import("@/lib/iriss-pasutijumi-store");
    return { effects, orders };
  }

  function sampleOrder(status: "active" | "inactive" | "reserved" | "completed") {
    const order = emptyIrissPasutijums(ORDER_ID, "2026-10-20T08:00:00.000Z");
    order.listStatus = status;
    order.clientFirstName = "Jānis";
    order.offers = [emptyIrissOfferRecord(OFFER_ID, order.createdAt, "Piedāvājums 1")];
    return order;
  }

  it("sets Rezervēts after approval and writes the status history", async () => {
    const { effects, orders } = await load();
    expect((await orders.writeIrissPasutijums(sampleOrder("inactive"))).ok).toBe(true);
    await effects.runIrissOfferDecisionEffects({
      orderId: ORDER_ID,
      offerId: OFFER_ID,
      decision: "approve",
      decidedAt: "2026-10-24T08:00:00.000Z",
    });
    const after = await orders.readIrissPasutijums(ORDER_ID);
    expect(after?.listStatus).toBe("reserved");
    expect(after?.statusChangedAt).toBe("2026-10-24T08:00:00.000Z");
    expect(after?.statusHistory?.at(-1)).toMatchObject({ from: "inactive", to: "reserved", by: effects.IRISS_OFFER_DECISION_ACTOR });
    expect(after?.clientFirstName).toBe("Jānis");
    expect(after?.offers).toHaveLength(1);
  });

  it("does not touch the order on decline", async () => {
    const { effects, orders } = await load();
    expect((await orders.writeIrissPasutijums(sampleOrder("active"))).ok).toBe(true);
    const before = await orders.readIrissPasutijums(ORDER_ID);
    await effects.runIrissOfferDecisionEffects({
      orderId: ORDER_ID,
      offerId: OFFER_ID,
      decision: "decline",
      decidedAt: "2026-10-24T08:00:00.000Z",
    });
    const after = await orders.readIrissPasutijums(ORDER_ID);
    expect(after?.listStatus).toBe("active");
    expect(after?.workspaceRevision).toBe(before?.workspaceRevision);
  });

  it("keeps Rezervēts and Izpildīts as they are", () => {
    return load().then(({ effects }) => {
      expect(effects.irissOrderAfterOfferApproval(sampleOrder("completed"), "2026-10-24T08:00:00.000Z")).toBeNull();
      expect(effects.irissOrderAfterOfferApproval(sampleOrder("reserved"), "2026-10-24T08:00:00.000Z")).toBeNull();
      const deleted = { ...sampleOrder("active"), deletedAt: "2026-10-21T08:00:00.000Z" };
      expect(effects.irissOrderAfterOfferApproval(deleted, "2026-10-24T08:00:00.000Z")).toBeNull();
      expect(effects.irissOrderAfterOfferApproval(sampleOrder("active"), "2026-10-24T08:00:00.000Z")?.listStatus).toBe("reserved");
    });
  });
});
