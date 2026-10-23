import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
const pushes: { msg: { title: string; body: string }; only?: string }[] = [];
const mails: { subject: string; to: string }[] = [];
vi.mock("@/lib/admin-push", () => ({
  sendAdminPush: vi.fn(async (msg: { title: string; body: string }, only?: string) => {
    pushes.push({ msg, only });
    return { sent: 1, removed: 0 };
  }),
}));
vi.mock("@/lib/email/send-transactional", () => ({
  sendAdminIrissOfferDecisionEmail: vi.fn(async (mail: { subject: string }, to: string) => {
    mails.push({ subject: mail.subject, to });
    return true;
  }),
}));

import { emptyIrissOfferRecord, emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const OFFER_ID = "22222222-2222-4222-8222-222222222222";
const DEADLINE = "2026-10-26T16:00:00.000Z";

describe("IRISS offer deadline notices", () => {
  const dirs: string[] = [];

  beforeEach(() => {
    pushes.length = 0;
    mails.length = 0;
  });

  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
    dirs.length = 0;
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  async function setup() {
    const dir = mkdtempSync(path.join(os.tmpdir(), "iriss-offer-expiry-"));
    dirs.push(dir);
    vi.unstubAllEnvs();
    vi.stubEnv("ADMIN_IRISS_PASUTIJUMI_DIR", dir);
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("ADMIN_NOTIFY_EMAIL", "nils@example.test");
    vi.resetModules();
    const orders = await import("@/lib/iriss-pasutijumi-store");
    const store = await import("@/lib/iriss-offer-client-link-store");
    const run = await import("@/lib/iriss-offer-expiry-run");
    const effects = await import("@/lib/iriss-offer-decision-effects");
    const order = emptyIrissPasutijums(ORDER_ID, "2026-10-20T08:00:00.000Z");
    order.clientFirstName = "Jānis";
    order.clientLastName = "Bērziņš";
    order.phone = "+37120000000";
    const offer = emptyIrissOfferRecord(OFFER_ID, order.createdAt, "Piedāvājums 1");
    offer.brandModel = "Audi A6";
    offer.vin = "WAUZZZ4G0EN123456";
    offer.validUntilAt = DEADLINE;
    order.offers = [offer];
    expect((await orders.writeIrissPasutijums(order)).ok).toBe(true);
    const link = await store.createIrissOfferClientLink({
      orderId: ORDER_ID,
      offerId: OFFER_ID,
      expiresInDays: null,
      deadlineAt: DEADLINE,
      nowMs: Date.parse("2026-10-20T09:00:00.000Z"),
    });
    if (!link.ok) throw new Error("link");
    return { orders, store, run, effects, link: link.record };
  }

  it("pushes once to Nils when the deadline passes without an answer (no e-mail)", async () => {
    const { run, store } = await setup();
    expect((await store.listIrissOfferDeadlines()).map((e) => e.deadlineAt)).toEqual([DEADLINE]);
    expect(await run.runIrissOfferExpiryNotices(Date.parse(DEADLINE) - 1)).toMatchObject({ checked: 0, notified: 0 });
    expect(pushes).toHaveLength(0);
    expect(await run.runIrissOfferExpiryNotices(Date.parse(DEADLINE) + 60_000)).toMatchObject({ notified: 1 });
    expect(pushes).toHaveLength(1);
    expect(pushes[0]?.only).toBe("admin");
    expect(pushes[0]?.msg.title).toBe("Piedāvājuma termiņš beidzies");
    expect(JSON.stringify(pushes)).not.toContain("Jānis");
    expect(JSON.stringify(pushes)).not.toContain("+3712");
    expect(mails).toHaveLength(0);
    expect(await run.runIrissOfferExpiryNotices(Date.parse(DEADLINE) + 16 * 60_000)).toMatchObject({ notified: 0 });
    expect(pushes).toHaveLength(1);
  });

  it("stays quiet when the client already decided or the link was revoked", async () => {
    const { run, store, link } = await setup();
    const decided = await store.respondIrissOfferClientLink(link.tokenHash, "decline", "", Date.parse(DEADLINE) - 5000, {
      deadlineAt: DEADLINE,
    });
    expect(decided.ok).toBe(true);
    expect(await run.runIrissOfferExpiryNotices(Date.parse(DEADLINE) + 60_000)).toMatchObject({ notified: 0, removed: 1 });
    expect(pushes).toHaveLength(0);
    expect(await store.listIrissOfferDeadlines()).toHaveLength(0);
  });

  it("waits for an extended deadline", async () => {
    const { run, orders, store } = await setup();
    const order = await orders.readIrissPasutijums(ORDER_ID);
    const later = "2026-10-28T16:00:00.000Z";
    order!.offers[0]!.validUntilAt = later;
    expect((await orders.writeIrissPasutijums(order!)).ok).toBe(true);
    expect(await run.runIrissOfferExpiryNotices(Date.parse(DEADLINE) + 60_000)).toMatchObject({ notified: 0 });
    expect((await store.listIrissOfferDeadlines())[0]?.deadlineAt).toBe(later);
    expect(await run.runIrissOfferExpiryNotices(Date.parse(later) + 60_000)).toMatchObject({ notified: 1 });
  });

  it("e-mails and pushes Nils only for the winning decision", async () => {
    const { store, effects, link } = await setup();
    const opts = { deadlineAt: DEADLINE };
    const first = await store.respondIrissOfferClientLink(link.tokenHash, "approve", "", Date.parse(DEADLINE) - 9000, opts);
    const second = await store.respondIrissOfferClientLink(link.tokenHash, "decline", "", Date.parse(DEADLINE) - 8000, opts);
    for (const r of [first, second]) {
      if (r.ok && r.won && r.record.decision) {
        await effects.runIrissOfferDecisionEffects({
          orderId: ORDER_ID,
          offerId: OFFER_ID,
          decision: r.record.decision,
          decidedAt: r.record.decidedAt,
        });
      }
    }
    expect(mails).toEqual([{ subject: "Piedāvājums apstiprināts: Audi A6", to: "nils@example.test" }]);
    expect(pushes).toHaveLength(1);
    expect(pushes[0]).toMatchObject({ only: "admin", msg: { title: "Piedāvājums apstiprināts" } });
  });
});
