import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";

const h = vi.hoisted(() => ({
  dir: "",
  drafts: new Map<string, { workspace?: unknown; orderEdits?: Record<string, string>; workspaceRevision?: number }>(),
  patches: [] as Array<{ id: string; workspace: unknown }>,
  session: "active" as string,
  autoSms: null as unknown,
  smsLink: vi.fn(),
  report: vi.fn(),
  email: vi.fn(),
  push: vi.fn(),
  ensure: vi.fn(),
}));

vi.mock("@/lib/admin-order-draft-store", () => ({
  getOrderDraftBlobConfig: () => null,
  getOrderDraftStorageDir: () => h.dir,
  isSafeOrderDraftSessionId: (id: string) => /^[A-Za-z0-9_]{4,200}$/.test(id),
  readOrderDraft: async (id: string) => h.drafts.get(id) ?? null,
  patchOrderDraft: async (id: string, patch: { workspace: unknown }) => {
    h.patches.push({ id, workspace: patch.workspace });
    return { ok: true };
  },
}));
vi.mock("@/lib/admin-push", () => ({ sendAdminPush: h.push }));
vi.mock("@/lib/ecsdd-auto", () => ({ fetchEcsddRelaySession: async () => ({ state: h.session }) }));
vi.mock("@/lib/ecsdd-paid", () => ({
  ecsddAutoSmsMode: () => "email",
  requestEcsddPaidSmsLink: h.smsLink,
  fetchEcsddPaidReport: h.report,
}));
vi.mock("@/lib/ecsdd-paid-store", () => ({
  readAutoSms: async () => h.autoSms,
  writeAutoSms: async (r: unknown) => {
    h.autoSms = r;
    return true;
  },
}));
vi.mock("@/lib/email/send-transactional", () => ({ sendCsddSmsTriggerEmail: h.email }));
vi.mock("@/lib/order-dropbox", () => ({ ensureOrderDropboxFolder: h.ensure }));
vi.mock("@/lib/csdd-pdf-ingest", () => ({
  buildCsddLocalParseFromText: (text: string) => ({
    fields: { ...mergeSourceBlocksWithDefaults({}).csdd, makeModel: "LAND ROVER DISCOVERY", registrationNumber: "RO8544" },
    rawUnprocessedData: text,
  }),
}));

import { enqueueCsddPaidAutoForOrder, recheckCsddPaidAuto, runCsddPaidAutoOnce } from "@/lib/csdd-paid-auto";
import { readCsddPaidAutoJob, updateCsddPaidAutoJob } from "@/lib/csdd-paid-auto-store";

const ID = "cs_test_auto1";
const DAY = "2026-11-23T10:00:00+02:00";
const audit = { checkoutLine: "audit", orderVinOrPlate: "RO8544" };

function setNow(riga: string) {
  vi.setSystemTime(new Date(Date.parse(riga.includes("+") ? riga : `${riga}+02:00`)));
}
function advance(ms: number) {
  vi.setSystemTime(new Date(Date.now() + ms));
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  setNow(DAY);
  h.dir = await fs.mkdtemp(path.join(os.tmpdir(), "csdd-paid-auto-"));
  h.drafts.clear();
  h.patches.length = 0;
  h.session = "active";
  h.autoSms = null;
  for (const f of [h.smsLink, h.report, h.email, h.push, h.ensure]) f.mockReset();
  h.smsLink.mockResolvedValue({ status: "ok", number: "1800", body: "CSDD 123456 RO8544", plate: "RO8544" });
  h.report.mockResolvedValue({ status: "pending" });
  h.email.mockResolvedValue(undefined);
  h.ensure.mockResolvedValue(null);
  process.env.CSDD_PAID_AUTO_ENABLED = "1";
  process.env.CSDD_PAID_AUTO_DAILY_MAX = "10";
});
afterEach(async () => {
  vi.useRealTimers();
  delete process.env.CSDD_PAID_AUTO_ENABLED;
  delete process.env.CSDD_PAID_AUTO_DAILY_MAX;
  await fs.rm(h.dir, { recursive: true, force: true });
});

describe("rinda", () => {
  it("izslēgts slēdzis / nederīgs produkts / bez LV numura -> nav darba", async () => {
    delete process.env.CSDD_PAID_AUTO_ENABLED;
    expect(await enqueueCsddPaidAutoForOrder(ID, audit)).toBeNull();
    process.env.CSDD_PAID_AUTO_ENABLED = "1";
    expect(await enqueueCsddPaidAutoForOrder(ID, { ...audit, checkoutLine: "dealer" })).toBeNull();
    expect(await enqueueCsddPaidAutoForOrder(ID, { ...audit, checkoutLine: "mini" })).toBeNull();
    expect(await readCsddPaidAutoJob(ID)).toBeNull();
  });

  it("bez LV numura -> 'nav LV numura', SMS nekad", async () => {
    const j = await enqueueCsddPaidAutoForOrder(ID, { checkoutLine: "audit", orderVinOrPlate: "WBA5R1C0XLFH42873" });
    expect(j).toMatchObject({ state: "no_plate", plate: "" });
    expect((await runCsddPaidAutoOnce(ID))?.state).toBe("no_plate");
    expect(h.smsLink).not.toHaveBeenCalled();
    expect(h.email).not.toHaveBeenCalled();
  });

  it("numurs no CSDD API (VIN pasūtījums)", async () => {
    h.drafts.set(ID, { workspace: { sourceBlocks: { csdd: { registrationNumber: "", registry: { nr1: "x", fetchedAt: "t", data: { registrationNumber: "RO8544" } } } } } });
    const job = await enqueueCsddPaidAutoForOrder(ID, { checkoutLine: "audit", orderVinOrPlate: "SALLAAAM6FA743824" });
    expect(job?.plate).toBe("RO8544");
  });

  it("idempotence: atkārtots webhook neveido otru darbu un nesūta otru SMS", async () => {
    const a = await enqueueCsddPaidAutoForOrder(ID, audit);
    await runCsddPaidAutoOnce(ID);
    const b = await enqueueCsddPaidAutoForOrder(ID, audit);
    expect(b?.createdAt).toBe(a?.createdAt);
    expect(b?.state).toBe("sms_sent");
    advance(60_000);
    await runCsddPaidAutoOnce(ID);
    await runCsddPaidAutoOnce(ID);
    expect(h.smsLink).toHaveBeenCalledTimes(1);
    expect(h.email).toHaveBeenCalledTimes(1);
    expect(h.smsLink).toHaveBeenCalledWith("RO8544", { login: false });
  });
});

describe("SMS un izziņa", () => {
  it("SMS -> izziņa -> ielasīta CSDD blokā + mapes pārdēvēšana", async () => {
    await enqueueCsddPaidAutoForOrder(ID, audit);
    const s = await runCsddPaidAutoOnce(ID);
    expect(s?.state).toBe("sms_sent");
    expect(h.email).toHaveBeenCalledWith(expect.objectContaining({ number: "1800", body: "CSDD 123456 RO8544" }));
    advance(31_000);
    h.report.mockResolvedValueOnce({ status: "found", rawText: "Reģistrācijas dati ...", fields: {}, paidAt: "2026-11-23T08:02:00Z", emailSent: true });
    const f = await runCsddPaidAutoOnce(ID);
    expect(f?.state).toBe("found");
    expect(h.report).toHaveBeenLastCalledWith("RO8544", expect.any(String), { sendEmail: true });
    expect(f?.pdfEmailAt).toBeTruthy();
    expect(f?.appliedAt).toBeTruthy();
    expect(h.patches).toHaveLength(1);
    const ws = h.patches[0]!.workspace as { sourceBlocks: { csdd: { makeModel: string } } };
    expect(ws.sourceBlocks.csdd.makeModel).toBe("LAND ROVER DISCOVERY");
    expect(h.ensure).toHaveBeenCalledWith(ID);
  });

  it("30 min bez izziņas -> gaida apmaksu, SMS otrreiz nesūta; 'Pārbaudīt vēlreiz' bez SMS", async () => {
    await enqueueCsddPaidAutoForOrder(ID, audit);
    await runCsddPaidAutoOnce(ID);
    for (let i = 0; i < 62; i++) {
      advance(31_000);
      await runCsddPaidAutoOnce(ID);
    }
    expect((await readCsddPaidAutoJob(ID))?.state).toBe("awaiting_payment");
    expect(h.smsLink).toHaveBeenCalledTimes(1);
    const r = await recheckCsddPaidAuto(ID);
    expect(r?.state).toBe("sms_sent");
    await runCsddPaidAutoOnce(ID);
    expect(h.smsLink).toHaveBeenCalledTimes(1);
  });

  it("naktī SMS nesūta - atliek uz 07:30", async () => {
    setNow("2026-11-23T23:20:00");
    await enqueueCsddPaidAutoForOrder(ID, audit);
    const j = await runCsddPaidAutoOnce(ID);
    expect(j?.deferReason).toBe("night");
    expect(j?.nextAttemptAt).toBe(new Date(Date.parse("2026-11-24T07:30:00+02:00")).toISOString());
    expect(h.smsLink).not.toHaveBeenCalled();
    setNow("2026-11-24T07:31:00");
    expect((await runCsddPaidAutoOnce(ID))?.state).toBe("sms_sent");
  });

  it("dienas griesti", async () => {
    process.env.CSDD_PAID_AUTO_DAILY_MAX = "1";
    await enqueueCsddPaidAutoForOrder(ID, audit);
    await enqueueCsddPaidAutoForOrder("cs_test_auto2", audit);
    expect((await runCsddPaidAutoOnce(ID))?.state).toBe("sms_sent");
    const second = await runCsddPaidAutoOnce("cs_test_auto2");
    expect(second?.state).toBe("queued");
    expect(second?.deferReason).toBe("daily_cap");
    expect(h.smsLink).toHaveBeenCalledTimes(1);
  });

  it("e.csdd sesija nav aktīva -> viens push, gaida (Smart-ID automātiski neprasa)", async () => {
    h.session = "logged_out";
    await enqueueCsddPaidAutoForOrder(ID, audit);
    const j = await runCsddPaidAutoOnce(ID);
    expect(j?.deferReason).toBe("login");
    advance(6 * 60_000);
    await runCsddPaidAutoOnce(ID);
    expect(h.push).toHaveBeenCalledTimes(1);
    expect(h.smsLink).not.toHaveBeenCalled();
    h.session = "active";
    advance(6 * 60_000);
    expect((await runCsddPaidAutoOnce(ID))?.state).toBe("sms_sent");
  });

  it("process apstājās pēc SMS sākuma -> nākamā palaišana tikai gaida izziņu", async () => {
    await enqueueCsddPaidAutoForOrder(ID, audit);
    await updateCsddPaidAutoJob(ID, (c) => (c ? { ...c, smsStartedAt: new Date().toISOString() } : null));
    await runCsddPaidAutoOnce(ID);
    expect(h.smsLink).not.toHaveBeenCalled();
    expect(h.report).toHaveBeenCalledTimes(1);
    expect((await readCsddPaidAutoJob(ID))?.state).toBe("sms_sent");
  });

  it("e-pasts neizdevās -> atkārto vēlāk, pēc 3 reizēm kļūda", async () => {
    h.email.mockRejectedValue(new Error("smtp"));
    await enqueueCsddPaidAutoForOrder(ID, audit);
    for (let i = 0; i < 3; i++) {
      await runCsddPaidAutoOnce(ID);
      advance(6 * 60_000);
      h.autoSms = null;
    }
    const j = await readCsddPaidAutoJob(ID);
    expect(j?.state).toBe("error");
    expect(h.email).toHaveBeenCalledTimes(3);
  });

  it("e.csdd numuru neatrod -> kļūda bez SMS", async () => {
    h.smsLink.mockResolvedValueOnce({ status: "not_found" });
    await enqueueCsddPaidAutoForOrder(ID, audit);
    expect((await runCsddPaidAutoOnce(ID))?.state).toBe("error");
    expect(h.email).not.toHaveBeenCalled();
  });
});

describe("B2B (PROVIN Business)", () => {
  const P = "manual_order_20261124_b2b1";
  const partner = { checkoutLine: "business", channel: "b2b_partner" as const, orderVinOrPlate: "SALLAAAM6FA743824" };
  const withRegistryPlate = (id: string) =>
    h.drafts.set(id, { workspace: { sourceBlocks: { csdd: { registrationNumber: "", registry: { nr1: "x", fetchedAt: "t", data: { registrationNumber: "RO8544" } } } } } });
  afterEach(() => {
    delete process.env.CSDD_PAID_AUTO_B2B_ENABLED;
  });

  it("partnera Business ar LV numuru (CSDD API) -> ieplānots, tāpat kā AUDITS", async () => {
    withRegistryPlate(P);
    const j = await enqueueCsddPaidAutoForOrder(P, partner);
    expect(j).toMatchObject({ state: "queued", plate: "RO8544", product: "b2b" });
    expect((await runCsddPaidAutoOnce(P))?.state).toBe("sms_sent");
    expect(h.smsLink).toHaveBeenCalledWith("RO8544", { login: false });
  });

  it("Business privātā saite (Stripe business_link) ar LV numuru -> ieplānots", async () => {
    const j = await enqueueCsddPaidAutoForOrder(ID, { checkoutLine: "business", fulfillment: "business_link", orderVinOrPlate: "RO8544", livemode: true });
    expect(j).toMatchObject({ state: "queued", product: "b2b" });
  });

  it("partnera Business bez LV numura -> nav ieplānots ('nav LV numura'); numurs vēlāk -> rindā", async () => {
    expect(await enqueueCsddPaidAutoForOrder(P, partner)).toMatchObject({ state: "no_plate" });
    await runCsddPaidAutoOnce(P);
    expect(h.smsLink).not.toHaveBeenCalled();
    withRegistryPlate(P);
    expect(await enqueueCsddPaidAutoForOrder(P, partner)).toMatchObject({ state: "queued", plate: "RO8544" });
  });

  it("partnera dīlera dati -> nē", async () => {
    withRegistryPlate(P);
    expect(await enqueueCsddPaidAutoForOrder(P, { ...partner, checkoutLine: "dealer" })).toBeNull();
    expect(await readCsddPaidAutoJob(P)).toBeNull();
  });

  it("demo / testa -> nē (naudu netērē)", async () => {
    for (const id of ["demo_order_exp_1", "ord_abc12345"]) {
      withRegistryPlate(id);
      expect(await enqueueCsddPaidAutoForOrder(id, partner)).toBeNull();
      expect(await readCsddPaidAutoJob(id)).toBeNull();
    }
    expect(await enqueueCsddPaidAutoForOrder(ID, { checkoutLine: "business", fulfillment: "business_link", orderVinOrPlate: "RO8544", livemode: false })).toBeNull();
    withRegistryPlate(P);
    expect(await enqueueCsddPaidAutoForOrder(P, { ...partner, isDemo: true })).toBeNull();
    expect(h.smsLink).not.toHaveBeenCalled();
  });

  it("atkārtots izsaukums -> viens darbs, viena SMS", async () => {
    withRegistryPlate(P);
    const a = await enqueueCsddPaidAutoForOrder(P, partner);
    await runCsddPaidAutoOnce(P);
    const b = await enqueueCsddPaidAutoForOrder(P, partner);
    expect(b?.createdAt).toBe(a?.createdAt);
    expect(b?.state).toBe("sms_sent");
    advance(60_000);
    await runCsddPaidAutoOnce(P);
    expect(h.smsLink).toHaveBeenCalledTimes(1);
    expect(h.email).toHaveBeenCalledTimes(1);
  });

  it("slēdzis izslēgts -> nē; B2B avārijas izslēdzējs aptur tikai B2B", async () => {
    withRegistryPlate(P);
    delete process.env.CSDD_PAID_AUTO_ENABLED;
    expect(await enqueueCsddPaidAutoForOrder(P, partner)).toBeNull();
    process.env.CSDD_PAID_AUTO_ENABLED = "1";
    process.env.CSDD_PAID_AUTO_B2B_ENABLED = "0";
    expect(await enqueueCsddPaidAutoForOrder(P, partner)).toBeNull();
    expect(await readCsddPaidAutoJob(P)).toBeNull();
    expect(await enqueueCsddPaidAutoForOrder(ID, audit)).toMatchObject({ state: "queued", product: "audit" });
  });
});
