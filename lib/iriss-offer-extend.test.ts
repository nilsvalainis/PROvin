import { mkdtempSync, readFileSync, rmSync } from "node:fs";
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
const H = 3_600_000;

describe("T4 Pagarināt + saraksta kopsavilkums", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
    dirs.length = 0;
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  async function setup(deadlineAt: string) {
    const dir = mkdtempSync(path.join(os.tmpdir(), "j24-t4-"));
    dirs.push(dir);
    vi.stubEnv("ADMIN_IRISS_PASUTIJUMI_DIR", dir);
    vi.stubEnv("VERCEL", "");
    vi.resetModules();
    const store = await import("@/lib/iriss-offer-client-link-store");
    const orders = await import("@/lib/iriss-pasutijumi-store");
    const extend = await import("@/lib/iriss-offer-extend");
    const order = emptyIrissPasutijums(ORDER_ID, "2026-10-20T10:00:00.000Z");
    const offer = { ...emptyIrissOfferRecord(OFFER_ID, order.createdAt, "Piedāvājums 1"), brandModel: "BMW X5", validUntilAt: deadlineAt };
    const w = await orders.writeIrissPasutijums({ ...order, clientFirstName: "Jānis", notes: "nemainīt", offers: [offer] }, { expectedWorkspaceRevision: 0 });
    expect(w.ok).toBe(true);
    const created = await store.createIrissOfferClientLink({ orderId: ORDER_ID, offerId: OFFER_ID, expiresInDays: null, deadlineAt });
    expect(created.ok).toBe(true);
    return { store, orders, extend };
  }

  it("pagarina to pašu saiti: termiņš pasūtījumā, saites derīgums +30 d., zīme sarakstā", async () => {
    const old = new Date(Date.now() - H).toISOString();
    const { store, orders, extend } = await setup(old);
    expect((await store.readIrissOfferLinkSummary())[ORDER_ID]).toMatchObject({ status: "sent", validUntilAt: old });
    const next = new Date(Date.now() + 48 * H).toISOString();
    const r = await extend.extendIrissOfferDeadline(ORDER_ID, OFFER_ID, next);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Date.parse(r.record.expiresAt) - Date.parse(next)).toBe(30 * 24 * H);
    const order = await orders.readIrissPasutijums(ORDER_ID);
    expect(order?.offers[0]?.validUntilAt).toBe(next);
    expect(order?.notes).toBe("nemainīt");
    expect(order?.clientFirstName).toBe("Jānis");
    expect((await store.readIrissOfferLinkSummary())[ORDER_ID]).toMatchObject({ status: "sent", validUntilAt: next });
    expect((await store.listIrissOfferDeadlines()).find((d) => d.offerId === OFFER_ID)?.deadlineAt).toBe(next);
  });

  it("pēc lēmuma pagarināt nevar; lēmums redzams kopsavilkumā", async () => {
    const deadline = new Date(Date.now() + 24 * H).toISOString();
    const { store, extend } = await setup(deadline);
    const links = await store.readIrissOfferClientLinksForOrder(ORDER_ID);
    const indexFile = path.join(process.env.ADMIN_IRISS_PASUTIJUMI_DIR!, `offer-links/orders/${ORDER_ID}.json`);
    const hash = (JSON.parse(readFileSync(indexFile, "utf8")) as { offers: Record<string, string> }).offers[OFFER_ID]!;
    const rec = await store.readIrissOfferClientLinkByHash(hash);
    expect(links).toHaveLength(1);
    const resp = await store.respondIrissOfferClientLink(rec!.tokenHash, "approve", "", Date.now(), { deadlineAt: deadline });
    expect(resp.ok && resp.won).toBe(true);
    if (resp.ok) await store.recordIrissOfferDecisionSummary(resp.record, deadline);
    expect((await store.readIrissOfferLinkSummary())[ORDER_ID]?.status).toBe("approved");
    const r = await extend.extendIrissOfferDeadline(ORDER_ID, OFFER_ID, new Date(Date.now() + 72 * H).toISOString());
    expect(r).toMatchObject({ ok: false, error: "decided" });
  });

  it("noraida termiņu pagātnē vai tālāk par 180 dienām", async () => {
    const { extend } = await setup(new Date(Date.now() + H).toISOString());
    expect(await extend.extendIrissOfferDeadline(ORDER_ID, OFFER_ID, new Date(Date.now() + 60_000).toISOString())).toMatchObject({ ok: false, error: "past" });
    expect(await extend.extendIrissOfferDeadline(ORDER_ID, OFFER_ID, new Date(Date.now() + 181 * 24 * H).toISOString())).toMatchObject({ ok: false, error: "too_far" });
    expect(await extend.extendIrissOfferDeadline(ORDER_ID, OFFER_ID, "nav")).toMatchObject({ ok: false, error: "invalid" });
  });

  it("atsaukta vecāka piedāvājuma saite nenotīra jaunāka zīmi", async () => {
    const deadline = new Date(Date.now() + 24 * H).toISOString();
    const { store } = await setup(deadline);
    const OTHER = "44444444-4444-4444-8444-444444444444";
    await store.createIrissOfferClientLink({ orderId: ORDER_ID, offerId: OTHER, expiresInDays: null, deadlineAt: deadline });
    await store.revokeIrissOfferClientLink(ORDER_ID, OFFER_ID);
    expect((await store.readIrissOfferLinkSummary())[ORDER_ID]).toMatchObject({ offerId: OTHER, status: "sent" });
    await store.revokeIrissOfferClientLink(ORDER_ID, OTHER);
    expect((await store.readIrissOfferLinkSummary())[ORDER_ID]?.status).toBe("revoked");
  });
});
