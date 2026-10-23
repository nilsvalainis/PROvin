/**
 * T5 testu matrica: divas cilnes / divas servera instances vienlaikus, pilns cikls
 * "termiņš beidzies -> Pagarināt -> Apstiprināt" un saraksta zīme. Krātuve - pagaidu mape (fs).
 */
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

import { irissOfferListBadge } from "@/lib/iriss-offer-deadline-ui";
import { emptyIrissOfferRecord, emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const OFFER_ID = "22222222-2222-4222-8222-222222222222";
const H = 3_600_000;

describe("T5 matrica", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  async function setup(deadlineAt: string) {
    const dir = mkdtempSync(path.join(os.tmpdir(), "j24-t5-"));
    dirs.push(dir);
    vi.stubEnv("ADMIN_IRISS_PASUTIJUMI_DIR", dir);
    vi.stubEnv("VERCEL", "");
    vi.resetModules();
    const store = await import("@/lib/iriss-offer-client-link-store");
    const orders = await import("@/lib/iriss-pasutijumi-store");
    const extend = await import("@/lib/iriss-offer-extend");
    const order = emptyIrissPasutijums(ORDER_ID, "2026-10-20T10:00:00.000Z");
    const offer = { ...emptyIrissOfferRecord(OFFER_ID, order.createdAt, "Piedāvājums 1"), validUntilAt: deadlineAt };
    expect((await orders.writeIrissPasutijums({ ...order, offers: [offer] }, { expectedWorkspaceRevision: 0 })).ok).toBe(true);
    const created = await store.createIrissOfferClientLink({ orderId: ORDER_ID, offerId: OFFER_ID, expiresInDays: null, deadlineAt });
    if (!created.ok) throw new Error("link");
    return { store, extend, hash: created.record.tokenHash };
  }

  it("divas cilnes: Apstiprināt un Noraidīt vienlaikus - uzvar viens, otrs saņem to pašu lēmumu", async () => {
    const deadline = new Date(Date.now() + 24 * H).toISOString();
    const { store, hash } = await setup(deadline);
    const [a, b] = await Promise.all([
      store.respondIrissOfferClientLink(hash, "approve", "", Date.now(), { deadlineAt: deadline }),
      store.respondIrissOfferClientLink(hash, "decline", "", Date.now(), { deadlineAt: deadline }),
    ]);
    if (!a.ok || !b.ok) throw new Error("respond");
    expect([a.won, b.won].filter(Boolean)).toHaveLength(1);
    expect(a.record.decision).toBe(b.record.decision);
  });

  it("divas servera instances: lēmuma fails tiek izveidots tikai vienreiz (pirmais uzvar)", async () => {
    const deadline = new Date(Date.now() + 24 * H).toISOString();
    const { store, hash } = await setup(deadline);
    const at = new Date().toISOString();
    const [a, b] = await Promise.all([store.claimIrissOfferDecision(hash, "approve", at), store.claimIrissOfferDecision(hash, "decline", at)]);
    if (!a.ok || !b.ok) throw new Error("claim");
    expect([a.won, b.won].filter(Boolean)).toHaveLength(1);
    expect(a.claimed.decision).toBe(b.claimed.decision);
    expect((await store.readIrissOfferClaimedDecision(hash))?.decision).toBe(a.claimed.decision);
  });

  it("beidzies -> Pagarināt -> klients var apstiprināt; zīme sarakstā seko", async () => {
    const past = new Date(Date.now() - H).toISOString();
    const { store, extend, hash } = await setup(past);
    const late = await store.respondIrissOfferClientLink(hash, "approve", "", Date.now(), { deadlineAt: past });
    expect(late).toMatchObject({ ok: false, error: "expired" });
    expect(irissOfferListBadge((await store.readIrissOfferLinkSummary())[ORDER_ID], Date.now())?.label).toBe("Beidzies");
    const next = new Date(Date.now() + 26 * H).toISOString();
    const ext = await extend.extendIrissOfferDeadline(ORDER_ID, OFFER_ID, next);
    expect(ext.ok).toBe(true);
    expect(irissOfferListBadge((await store.readIrissOfferLinkSummary())[ORDER_ID], Date.now())?.tone).toBe("time");
    const ok = await store.respondIrissOfferClientLink(hash, "approve", "", Date.now(), { deadlineAt: next });
    if (!ok.ok) throw new Error("approve");
    expect(ok.won).toBe(true);
    await store.recordIrissOfferDecisionSummary(ok.record, next);
    expect(irissOfferListBadge((await store.readIrissOfferLinkSummary())[ORDER_ID], Date.now())?.label).toBe("Apstiprināts");
  });

  it("veca saite bez termiņa: nav zīmes, lēmums strādā kā līdz šim", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "j24-t5-old-"));
    dirs.push(dir);
    vi.stubEnv("ADMIN_IRISS_PASUTIJUMI_DIR", dir);
    vi.stubEnv("VERCEL", "");
    vi.resetModules();
    const store = await import("@/lib/iriss-offer-client-link-store");
    const created = await store.createIrissOfferClientLink({ orderId: ORDER_ID, offerId: OFFER_ID, expiresInDays: 14 });
    if (!created.ok) throw new Error("link");
    expect(irissOfferListBadge((await store.readIrissOfferLinkSummary())[ORDER_ID], Date.now())).toBeNull();
    const r = await store.respondIrissOfferClientLink(created.record.tokenHash, "decline", "", Date.now(), { deadlineAt: "" });
    expect(r.ok && r.won).toBe(true);
  });
});
