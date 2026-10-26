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
const notify = vi.hoisted(() => ({ calls: [] as unknown[] }));
vi.mock("@/lib/iriss-offer-notify", () => ({
  notifyIrissOfferDecision: async (...args: unknown[]) => {
    notify.calls.push(args);
    return { email: true, push: 1 };
  },
}));

import { applyIrissPdAction } from "@/lib/iriss-piedavajumi";
import { emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";
import { emptyIrissPiedavajums, type IrissPiedavajums } from "@/lib/iriss-piedavajumi-types";

const ORDER = "11111111-1111-4111-8111-111111111111";
const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWx";
const AT = "2026-10-26T10:00:00.000Z";

describe("Piedāvājumu krātuve un apstiprinājuma sekas", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
    dirs.length = 0;
    notify.calls.length = 0;
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  async function load() {
    const dir = mkdtempSync(path.join(os.tmpdir(), "iriss-pd-"));
    dirs.push(dir);
    vi.unstubAllEnvs();
    vi.stubEnv("ADMIN_IRISS_PASUTIJUMI_DIR", dir);
    vi.stubEnv("VERCEL", "");
    vi.resetModules();
    const store = await import("@/lib/iriss-piedavajumi-store");
    const approve = await import("@/lib/iriss-piedavajumi-approve");
    const orders = await import("@/lib/iriss-pasutijumi-store");
    return { store, approve, orders };
  }

  function make(id: string, number: number, over: Partial<IrissPiedavajums> = {}): IrissPiedavajums {
    const r = emptyIrissPiedavajums(id, AT);
    return { ...r, number, vehicle: { ...r.vehicle, title: "Toyota Proace 2.0", vin: "YARVAEHZ8GZ044312" }, price: "9300", ...over };
  }

  it("numurē secīgi, saglabā indeksu un atrod pēc publiskās saites", async () => {
    const { store } = await load();
    const a = await store.createIrissPd((n) => make(crypto.randomUUID(), n));
    const b = await store.createIrissPd((n) => make(crypto.randomUUID(), n, { status: "sent", linkToken: TOKEN, validUntil: "2026-11-02" }));
    expect(a.ok && a.record.number).toBe(1);
    expect(b.ok && b.record.number).toBe(2);
    const rows = await store.listIrissPdRows();
    expect(rows.map((r) => r.number).sort()).toEqual([1, 2]);
    const byToken = await store.readIrissPdByToken(TOKEN);
    expect(byToken?.number).toBe(2);
    expect(await store.readIrissPdByToken("ZZZZZZZZZZZZZZZZZZZZZZZZ")).toBeNull();
  });

  it("termiņš beidzas automātiski (ieraksts un indekss pārrakstīti)", async () => {
    const { store } = await load();
    const c = await store.createIrissPd((n) => make(crypto.randomUUID(), n, { status: "sent", validUntil: "2026-10-20" }));
    expect(c.ok).toBe(true);
    const changed = await store.refreshIrissPdExpiries(Date.parse("2026-10-26T10:00:00Z"));
    expect(changed).toBe(1);
    const rows = await store.listIrissPdRows();
    expect(rows[0]?.status).toBe("expired");
    const rec = c.ok ? await store.readIrissPd(c.record.id) : null;
    expect(rec?.history.at(-1)?.text).toBe("Termiņš beidzies (20.10.2026)");
  });

  it("lēmums: pirmais uzvar", async () => {
    const { store } = await load();
    const id = crypto.randomUUID();
    const doc = { decision: "approve" as const, decidedAt: AT, contactName: "", contactPhone: "" };
    expect(await store.claimIrissPdDecision(id, doc)).toEqual({ won: true });
    expect(await store.claimIrissPdDecision(id, doc)).toEqual({ won: false });
  });

  it("apstiprinot bez klienta: jauns Pasūtījums «Rezervēts» ar saiti atpakaļ; piedāvājums paliek «Apstiprināts»", async () => {
    const { store, approve, orders } = await load();
    const created = await store.createIrissPd((n) => make(crypto.randomUUID(), n, { status: "sent", validUntil: "2026-11-02", linkToken: TOKEN }));
    if (!created.ok) throw new Error("create");
    const res = applyIrissPdAction(created.record, "approve", { by: "Klients", at: AT, nowMs: Date.parse(AT), newToken: () => TOKEN });
    if (!res.ok) throw new Error("approve");
    const next = await approve.runIrissPdApprovalEffects(res.record, { at: AT, by: "Klients", contactName: "Jānis Ozols", contactPhone: "+37120000000" });
    expect(next.status).toBe("approved");
    expect(next.approvedOrderId).toMatch(/^[0-9a-f-]{36}$/);
    const order = await orders.readIrissPasutijums(next.approvedOrderId);
    expect(order).toMatchObject({ listStatus: "reserved", clientFirstName: "Jānis", clientLastName: "Ozols", phone: "+37120000000", brandModel: "Toyota Proace 2.0", vin: "YARVAEHZ8GZ044312" });
    expect(order?.internalNotes).toContain(`/admin/iriss/piedavajumi/${created.record.id}`);
    expect(next.history.at(-1)?.text).toBe("Izveidots pasūtījums «Rezervēts»");

    await store.writeIrissPd(next);
    const linked = await store.listIrissPdRowsForOrder(next.approvedOrderId);
    expect(linked.map((r) => r.id)).toEqual([created.record.id]);

    await approve.notifyIrissPdApproved(next, "Jānis Ozols");
    expect(notify.calls).toHaveLength(1);
    expect((notify.calls[0] as unknown[])[1]).toBe("approve");
  });

  it("apstiprinot ar piesaistītu klienta pasūtījumu: tas kļūst «Rezervēts», dublikāts netiek veidots", async () => {
    const { store, approve, orders } = await load();
    const base = emptyIrissPasutijums(ORDER, AT);
    const o = await orders.createIrissPasutijums({ ...base, clientFirstName: "Anna", listStatus: "active" });
    expect(o.ok).toBe(true);
    const rec = make(crypto.randomUUID(), 1, { status: "approved", client: { name: "Anna", phone: "", email: "", orderId: ORDER } });
    const next = await approve.runIrissPdApprovalEffects(rec, { at: AT, by: "Nils" });
    expect(next.approvedOrderId).toBe(ORDER);
    expect((await orders.readIrissPasutijums(ORDER))?.listStatus).toBe("reserved");
    expect((await orders.listIrissPasutijumi()).length).toBe(1);
    await store.writeIrissPd(next);
    expect((await store.listIrissPdRowsForOrder(ORDER)).length).toBe(1);
  });
});
