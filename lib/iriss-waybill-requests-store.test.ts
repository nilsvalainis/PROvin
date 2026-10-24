import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WaybillRequest, WaybillRequestsDoc } from "@/lib/iriss-waybill-requests";

/** Atmiņas krātuve tā paša līguma (read/update) vietā, lai pārbaudītu atcelšanu zem slēdzenes. */
const mem = vi.hoisted(() => ({ doc: null as unknown, audits: [] as Array<{ action: string; target: string }> }));

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
vi.mock("@/lib/staff-store", () => ({
  appendStaffAudit: async (entry: { action: string; target: string }) => {
    mem.audits.push({ action: entry.action, target: entry.target });
  },
}));
vi.mock("@/lib/admin-push", () => ({ sendAdminPush: vi.fn(async () => ({ sent: 0, removed: 0 })) }));
const saveCsddPlatesReport = vi.fn(async () => ({ version: 1 as const, updatedAt: "", plates: [] }));
vi.mock("@/lib/iriss-waybill-csdd-plates-store", () => ({ saveCsddPlatesReport }));

const {
  cancelWaybillRequest,
  claimWaybillRequest,
  appendWaybillRequestEvent,
  completeWaybillRequest,
  readWaybillRequestsDoc,
  listPendingWaybillRequests,
} = await import("@/lib/iriss-waybill-requests-store");

const future = new Date(Date.now() + 3_600_000).toISOString();
const now = new Date().toISOString();

const sample = (over: Partial<WaybillRequest>): WaybillRequest => ({
  id: "wbr_a1",
  createdBy: "usr_1",
  createdByName: "Nils",
  createdAt: now,
  updatedAt: now,
  vehicle: { brandModel: "PEUGEOT 5008", vin: "VF30ARHHAAS201388", plate: "B193-7", orderId: "" },
  routeFrom: "",
  routeTo: "",
  validDays: 1,
  validHours: 1,
  validFrom: now,
  validUntil: future,
  noteUntrusted: "",
  status: "queued",
  waybillNo: "",
  pdfUrl: "",
  errorReason: "",
  lastReplyText: "",
  attempts: 1,
  pickedBy: "",
  pickedAt: "",
  plateBusyAtCreate: false,
  autoDisabled: false,
  tradeAct: true,
  representative: "Nils Valainis",
  stage: "",
  stageAt: "",
  ...over,
});

function seed(requests: WaybillRequest[]) {
  const doc: WaybillRequestsDoc = { version: 1, updatedAt: now, requests, events: [] };
  mem.doc = JSON.parse(JSON.stringify(doc));
  mem.audits = [];
}

const actor = { actorId: "usr_1", actorName: "Nils" };

describe("cancelWaybillRequest (Atcelt)", () => {
  beforeEach(() => seed([]));

  it("cancels only a pending, unclaimed request: status cancelled, event + audit, leaves the queue", async () => {
    seed([sample({ id: "wbr_q" })]);
    const res = await cancelWaybillRequest({ id: "wbr_q", ...actor });
    expect(res).toMatchObject({ ok: true, request: { id: "wbr_q", status: "cancelled" } });
    const doc = await readWaybillRequestsDoc();
    expect(doc.requests[0]?.status).toBe("cancelled");
    expect(doc.events.map((e) => e.kind)).toEqual(["cancelled"]);
    expect(mem.audits).toEqual([{ action: "waybill_cancelled", target: "wbr_q" }]);
    expect(await listPendingWaybillRequests()).toEqual([]);
    // Atceltu vairs nevar paņemt ne Aivars, ne automātika.
    expect(await claimWaybillRequest("wbr_q")).toBeNull();
    expect(await claimWaybillRequest("wbr_q", "auto")).toBeNull();
  });

  it("refuses (409) anything claimed, in progress, issued, failed or already cancelled - and changes nothing", async () => {
    const rows = [
      sample({ id: "wbr_claimed", pickedBy: "aivars" }),
      sample({ id: "wbr_work", status: "in_progress", pickedBy: "auto", pickedAt: now }),
      sample({ id: "wbr_issued", status: "issued", waybillNo: "P02811", pdfUrl: "/x.pdf" }),
      sample({ id: "wbr_err", status: "error" }),
      sample({ id: "wbr_cx", status: "cancelled" }),
    ];
    seed(rows);
    const before = JSON.stringify(mem.doc);
    for (const row of rows) {
      expect(await cancelWaybillRequest({ id: row.id, ...actor })).toEqual({ ok: false, reason: "not_pending" });
    }
    expect(await cancelWaybillRequest({ id: "wbr_nav", ...actor })).toEqual({ ok: false, reason: "not_found" });
    expect(JSON.stringify(mem.doc)).toBe(before);
    expect(mem.audits).toEqual([]);
  });

  it("race: once claimed, a late cancel loses", async () => {
    seed([sample({ id: "wbr_r" })]);
    expect(await claimWaybillRequest("wbr_r", "auto")).toMatchObject({ status: "in_progress", stage: "claimed" });
    expect(await cancelWaybillRequest({ id: "wbr_r", ...actor })).toEqual({ ok: false, reason: "not_pending" });
  });

  it("a late worker event never revives a cancelled request; a real issued result is still recorded", async () => {
    seed([sample({ id: "wbr_l", status: "cancelled" })]);
    expect(await appendWaybillRequestEvent({ id: "wbr_l", kind: "in_progress", by: "aivars" })).toMatchObject({ status: "cancelled" });
    expect(await appendWaybillRequestEvent({ id: "wbr_l", kind: "issued", waybillNo: "P02812", by: "aivars" })).toMatchObject({
      status: "issued",
      waybillNo: "P02812",
    });
  });
});

describe("worker stages and expiry", () => {
  it("stage events are stored while in progress and cleared on the result", async () => {
    seed([sample({ id: "wbr_s" })]);
    await claimWaybillRequest("wbr_s", "auto");
    expect(await appendWaybillRequestEvent({ id: "wbr_s", kind: "message", stage: "filling", by: "auto" })).toMatchObject({
      status: "in_progress",
      stage: "filling",
    });
    expect(await appendWaybillRequestEvent({ id: "wbr_s", kind: "issued", waybillNo: "P1", by: "auto" })).toMatchObject({
      status: "issued",
      stage: "",
    });
  });

  it("a pending request whose validity already ended is not offered to Aivars or the worker", async () => {
    seed([sample({ id: "wbr_old", validUntil: new Date(Date.now() - 60_000).toISOString() }), sample({ id: "wbr_ok" })]);
    expect((await listPendingWaybillRequests()).map((r) => r.id)).toEqual(["wbr_ok"]);
    expect(await claimWaybillRequest("wbr_old", "auto")).toBeNull();
  });
});

describe("completeWaybillRequest (j57: CSDD laiki un momentuzņēmums uzreiz)", () => {
  beforeEach(() => {
    seed([]);
    saveCsddPlatesReport.mockClear();
  });

  it("ar CSDD validFrom/validUntil pārraksta pieprasījuma brīdī aprēķinātos laikus", async () => {
    seed([sample({ id: "wbr_csdd", vehicle: { brandModel: "MB VIANO", vin: "V1", plate: "B192-7", orderId: "" } })]);
    const csddFrom = "2026-10-24T17:49:00.000Z";
    const csddUntil = "2026-10-26T18:49:00.000Z";
    const result = await completeWaybillRequest({
      id: "wbr_csdd",
      ok: true,
      waybillNo: "P00746",
      validFrom: csddFrom,
      validUntil: csddUntil,
    });
    expect(result).toMatchObject({ status: "issued", validFrom: csddFrom, validUntil: csddUntil });
  });

  it("bez CSDD laikiem (nav zināmi) patur pieprasījuma brīdī aprēķinātos", async () => {
    seed([sample({ id: "wbr_keep" })]);
    const before = (await readWaybillRequestsDoc()).requests[0];
    const result = await completeWaybillRequest({ id: "wbr_keep", ok: true, waybillNo: "P9" });
    expect(result).toMatchObject({ validFrom: before?.validFrom, validUntil: before?.validUntil });
  });

  it("neveiksmes gadījumā CSDD laikus nepiemēro un momentuzņēmumu neatjauno", async () => {
    seed([sample({ id: "wbr_err" })]);
    await completeWaybillRequest({ id: "wbr_err", ok: false, errorReason: "kļūda", validFrom: "2026-10-24T17:49:00.000Z" });
    const after = (await readWaybillRequestsDoc()).requests[0];
    expect(after?.status).toBe("error");
    expect(after?.validFrom).toBe(now);
    expect(saveCsddPlatesReport).not.toHaveBeenCalled();
  });

  it("izdodot uzreiz atjauno CSDD numura momentuzņēmumu (nevis gaida sync.js)", async () => {
    seed([sample({ id: "wbr_snap", vehicle: { brandModel: "MB VIANO", vin: "V1", plate: "B192-7", orderId: "" } })]);
    await completeWaybillRequest({
      id: "wbr_snap",
      ok: true,
      waybillNo: "P00746",
      validFrom: "2026-10-24T17:49:00.000Z",
      validUntil: "2026-10-26T18:49:00.000Z",
    });
    expect(saveCsddPlatesReport).toHaveBeenCalledTimes(1);
    expect(saveCsddPlatesReport).toHaveBeenCalledWith([
      expect.objectContaining({
        plate: "B192-7",
        ok: true,
        active: [{ waybillNo: "P00746", validUntil: "2026-10-26T18:49:00.000Z", brandModel: "MB VIANO" }],
      }),
    ]);
  });
});

describe("readWaybillRequestsDoc legacy time fix (j57: P00746)", () => {
  beforeEach(() => seed([]));

  it("labo TIKAI P00746 izdotās pavadzīmes laikus uz CSDD piešķirtajiem", async () => {
    seed([
      sample({
        id: "wbr_p746",
        status: "issued",
        waybillNo: "P00746",
        vehicle: { brandModel: "MB VIANO", vin: "V1", plate: "B192-7", orderId: "" },
        validFrom: now,
        validUntil: "2026-10-26T16:10:00.000Z",
      }),
      sample({ id: "wbr_other", status: "issued", waybillNo: "P00747", validFrom: now, validUntil: future }),
    ]);
    const doc = await readWaybillRequestsDoc();
    const fixed = doc.requests.find((r) => r.id === "wbr_p746");
    expect(fixed).toMatchObject({ validFrom: "2026-10-24T17:49:00.000Z", validUntil: "2026-10-26T18:49:00.000Z" });
    const other = doc.requests.find((r) => r.id === "wbr_other");
    expect(other).toMatchObject({ validFrom: now, validUntil: future });
  });

  it("neko nemaina uzglabātajos datos - tas ir tikai lasīšanas brīža labojums", async () => {
    seed([
      sample({
        id: "wbr_p746",
        status: "issued",
        waybillNo: "P00746",
        validFrom: now,
        validUntil: "2026-10-26T16:10:00.000Z",
      }),
    ]);
    const before = JSON.stringify(mem.doc);
    await readWaybillRequestsDoc();
    expect(JSON.stringify(mem.doc)).toBe(before);
  });
});
