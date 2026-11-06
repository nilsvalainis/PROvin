/**
 * Pavadzīmes 07.11 (B762 06.11: darbs "Izveido" 74 min, iesākto nevarēja atcelt):
 * - API: maks. derīgums 48 h (48 pieņem, 49 un 2160 noraida);
 * - API: idempotence (tā pati atslēga -> tas pats pieprasījums, viens aktīvs uz numuru);
 * - atcelšana darbā esošam (pieprasījums -> izrakstītājs apstājas -> Atcelts; ja izdota - "jāanulē manuāli");
 * - iestrēgušais darbs ar taimautu (nevis mūžīgi "Izveido" vai atkārtota paņemšana).
 * Krātuve ir atmiņā (tas pats read/update līgums), tīkls/Blob netiek aiztikts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import type { WaybillRequest, WaybillRequestsDoc } from "@/lib/iriss-waybill-requests";

const mem = vi.hoisted(() => ({
  doc: null as unknown,
  audits: [] as Array<{ action: string; target: string }>,
  actor: { kind: "admin", name: "Nils" } as { kind: "admin"; name: string } | { kind: "staff"; user: { id: string; name: string; sections: string[] } },
}));

vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => undefined }));
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
vi.mock("@/lib/iriss-waybill-csdd-plates-store", () => ({
  saveCsddPlatesReport: vi.fn(async () => ({ version: 1, updatedAt: "", plates: [] })),
  readCsddPlatesDocSafe: async () => null,
}));
vi.mock("@/lib/staff-auth", () => ({
  requireIrissSectionApi: async () => ({ ok: true, actor: mem.actor }),
  isWaybillOnlyActor: () => false,
  waybillOnlyForbidden: () => NextResponse.json({ error: "forbidden" }, { status: 403 }),
  waybillPdfViewer: () => ({ actorId: "env-admin", waybillOnly: false }),
}));
vi.mock("@/lib/iriss-waybill-auto-server", async () => {
  const { emptyWaybillPlateStates } = await import("@/lib/iriss-waybill-plates");
  return {
    loadWaybillPlateOccupancy: async () => ({ plates: emptyWaybillPlateStates(), withdrawnNos: new Set(), csdd: null }),
    waybillAutoContext: async () => ({ mode: "test", isStandard: () => false }),
  };
});
vi.mock("@/lib/iriss-aivars-wake", () => ({ wakeAivars: async () => undefined }));
vi.mock("@/lib/iriss-waybill-vehicles", () => ({ listWaybillVehicleChips: async () => [] }));
vi.mock("@/lib/iriss-autoparks-store", () => ({ readAutoparksState: async () => ({ cars: [] }) }));
vi.mock("@/lib/iriss-waybill-dismissed-store", () => ({ readDismissedWaybillIds: async () => [], dismissWaybillRequestForActor: async () => [] }));
vi.mock("@/lib/iriss-pavadzimes-list", () => ({ canSeeWaybillOrders: () => true }));
vi.mock("@/lib/iriss-waybill-dropbox", () => ({ ensureWaybillRequestInDropbox: async () => null }));
vi.mock("@/lib/iriss-aivars-api-token", () => ({
  irissAivarsApiTokenConfigured: () => true,
  verifyIrissAivarsApiToken: (h: string | null) => h === "Bearer test-token-1234567890",
}));

const store = await import("@/lib/iriss-waybill-requests-store");

const NOW = Date.parse("2026-11-06T12:50:35.000Z");
const iso = (ms: number) => new Date(ms).toISOString();

function seed(requests: WaybillRequest[]) {
  const doc: WaybillRequestsDoc = { version: 1, updatedAt: iso(NOW), requests, events: [] };
  mem.doc = JSON.parse(JSON.stringify(doc));
  mem.audits = [];
}

const docNow = () => mem.doc as WaybillRequestsDoc;
const byId = (id: string) => docNow().requests.find((r) => r.id === id)!;

const sample = (over: Partial<WaybillRequest>): WaybillRequest => ({
  id: "wbr_b762",
  createdBy: "env-admin",
  createdByName: "Nils",
  createdAt: iso(NOW),
  updatedAt: iso(NOW),
  vehicle: { brandModel: "VW Passat", vin: "", plate: "B7627", orderId: "" },
  routeFrom: "Tukums, Rīgas iela",
  routeTo: "Tukuma CSDD",
  validDays: 2,
  validHours: 48,
  validFrom: iso(NOW),
  validUntil: iso(NOW + 48 * 3_600_000),
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
  tradeAct: false,
  representative: "",
  stage: "",
  stageAt: "",
  dropboxPath: "",
  dropboxError: "",
  dropboxAt: "",
  ...over,
});

async function postCreate(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  const { POST } = await import("@/app/api/admin/iriss/waybill-requests/route");
  return POST(
    new Request("https://www.provin.lv/api/admin/iriss/waybill-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  );
}

async function postAction(id: string, action: string) {
  const { POST } = await import("@/app/api/admin/iriss/waybill-requests/[id]/route");
  return POST(
    new Request(`https://www.provin.lv/api/admin/iriss/waybill-requests/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }),
    { params: Promise.resolve({ id }) },
  );
}

const AUTH = { Authorization: "Bearer test-token-1234567890", "Content-Type": "application/json" };

async function postEvent(id: string, body: Record<string, unknown>) {
  const { POST } = await import("@/app/api/iriss/aivars/waybill-requests/[id]/events/route");
  return POST(
    new Request(`https://www.provin.lv/api/iriss/aivars/waybill-requests/${id}/events`, {
      method: "POST",
      headers: AUTH,
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

async function getStatus(id: string) {
  const { GET } = await import("@/app/api/iriss/aivars/waybill-requests/[id]/route");
  return GET(new Request(`https://www.provin.lv/api/iriss/aivars/waybill-requests/${id}`, { headers: AUTH }), {
    params: Promise.resolve({ id }),
  });
}

const form = { plate: "B762-7", brandModel: "VW Passat", validHours: 48 };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  mem.actor = { kind: "admin", name: "Nils" };
  seed([]);
});

describe("POST /api/admin/iriss/waybill-requests: max 48 h (Nils 27.10)", () => {
  it("48 h is accepted and queued with validUntil = now + 48 h", async () => {
    const res = await postCreate(form);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { request: WaybillRequest };
    expect(json.request).toMatchObject({ status: "queued", validHours: 48, validUntil: iso(NOW + 48 * 3_600_000) });
    expect(docNow().requests).toHaveLength(1);
  });

  it.each([49, 2160])("%i h is rejected with 400 and nothing is queued", async (validHours) => {
    const res = await postCreate({ ...form, validHours });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Derīgums: no 1 līdz 48 h." });
    expect(docNow().requests).toHaveLength(0);
  });

  it("a stored legacy job with more than 48 h is never handed out for issuing (claim refuses)", async () => {
    seed([sample({ id: "wbr_old", validHours: 2160 })]);
    expect(await store.claimWaybillRequest("wbr_old")).toBeNull();
    expect(byId("wbr_old").status).toBe("queued");
  });
});

describe("POST /api/admin/iriss/waybill-requests: double submit / idempotence", () => {
  it("the same Idempotency-Key twice returns the same request (200, duplicate) - only one in the queue", async () => {
    const key = { "Idempotency-Key": "wbk_test_0001" };
    const first = await postCreate(form, key);
    const second = await postCreate(form, key);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const a = (await first.json()) as { request: WaybillRequest };
    const b = (await second.json()) as { request: WaybillRequest; duplicate?: boolean };
    expect(b.duplicate).toBe(true);
    expect(b.request.id).toBe(a.request.id);
    expect(docNow().requests).toHaveLength(1);
    expect(mem.audits.filter((x) => x.action === "waybill_requested")).toHaveLength(1);
  });

  it("the key also works in the body; reused for another plate -> 409, nothing new", async () => {
    expect((await postCreate({ ...form, idempotencyKey: "wbk_test_0002" })).status).toBe(200);
    const other = await postCreate({ ...form, plate: "B193-7", idempotencyKey: "wbk_test_0002" });
    expect(other.status).toBe(409);
    expect(docNow().requests).toHaveLength(1);
  });

  it("without a key a second request for the same plate is refused while one is active (409 pending)", async () => {
    expect((await postCreate(form)).status).toBe(200);
    const again = await postCreate(form);
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ pending: true });
    expect(docNow().requests).toHaveLength(1);
  });
});

describe("Atcelt in progress (B762 06.11)", () => {
  it("queued -> cancelled at once; in progress -> cancel requested, worker sees it and confirms -> cancelled", async () => {
    seed([sample({ id: "wbr_q" }), sample({ id: "wbr_w", vehicle: { brandModel: "VW Passat", vin: "", plate: "B1937", orderId: "" } })]);
    const q = await postAction("wbr_q", "cancel");
    expect(q.status).toBe(200);
    expect(await q.json()).toMatchObject({ cancelMode: "cancelled", request: { status: "cancelled" } });

    await store.claimWaybillRequest("wbr_w", "auto");
    const w = await postAction("wbr_w", "cancel");
    expect(w.status).toBe(200);
    expect(await w.json()).toMatchObject({
      cancelMode: "requested",
      request: { status: "in_progress" },
      reply: { statusLabel: "Atceļ", cancelRequested: true },
    });
    // Otrs klikšķis nemaina neko un neveido otru notikumu.
    const eventsBefore = docNow().events.length;
    expect(await (await postAction("wbr_w", "cancel")).json()).toMatchObject({ cancelMode: "already_requested" });
    expect(docNow().events.length).toBe(eventsBefore);

    // Worker nākamajā solī saņem cancelRequested, statusa ceļš to pašu.
    const stage = await postEvent("wbr_w", { kind: "message", stage: "filling", by: "auto" });
    expect(await stage.json()).toMatchObject({ cancelRequested: true });
    expect(await (await getStatus("wbr_w")).json()).toMatchObject({ status: "in_progress", cancelRequested: true });

    const ack = await postEvent("wbr_w", { kind: "cancelled", by: "auto" });
    expect(ack.status).toBe(200);
    expect(byId("wbr_w")).toMatchObject({ status: "cancelled", lastReplyText: "Atcelts pirms CSDD saglabāšanas. Pavadzīme nav izveidota." });
    // Atcelts darbs vairs nav rindā ne Aivaram, ne automātikai.
    expect(await store.listPendingWaybillRequests()).toEqual([]);
  });

  it("a cancel confirmation without a cancel request is refused (409) and changes nothing", async () => {
    seed([sample({ id: "wbr_w", status: "in_progress", pickedBy: "auto", pickedAt: iso(NOW) })]);
    const before = JSON.stringify(mem.doc);
    expect((await postEvent("wbr_w", { kind: "cancelled", by: "auto" })).status).toBe(409);
    expect(JSON.stringify(mem.doc)).toBe(before);
  });

  it("if CSDD already saved: the issued waybill is recorded (not lost) and marked for manual annul", async () => {
    seed([sample({ id: "wbr_s", status: "in_progress", pickedBy: "auto", pickedAt: iso(NOW), stage: "saving", stageAt: iso(NOW) })]);
    const res = await store.cancelWaybillRequest({ id: "wbr_s", actorId: "env-admin", actorName: "Nils" });
    expect(res).toMatchObject({ ok: true, mode: "requested" });
    if (res.ok) expect(res.request.lastReplyText).toMatch(/CSDD jau saglabā/);
    const done = await store.completeWaybillRequest({ id: "wbr_s", ok: true, waybillNo: "P02871", by: "auto" });
    expect(done).toMatchObject({ status: "issued", waybillNo: "P02871", manualAnnulNeeded: true });
    expect(done?.lastReplyText).toMatch(/jāanulē manuāli/);
  });

  it("automation failure or release after a cancel request -> cancelled, never back in the queue for Aivars", async () => {
    seed([
      sample({ id: "wbr_f", status: "in_progress", pickedBy: "auto", pickedAt: iso(NOW), stage: "filling", cancelRequestedAt: iso(NOW) }),
      sample({
        id: "wbr_r",
        vehicle: { brandModel: "BMW", vin: "", plate: "B1937", orderId: "" },
        status: "in_progress",
        pickedBy: "auto",
        pickedAt: iso(NOW),
        stage: "checking",
        cancelRequestedAt: iso(NOW),
      }),
    ]);
    expect(await store.handAutoFailureToAivars({ id: "wbr_f", reason: "forma", checkCsddFirst: false })).toMatchObject({ status: "cancelled" });
    expect(await store.releaseWaybillRequestToAivars({ id: "wbr_r", by: "auto", reason: "VPN" })).toMatchObject({ status: "cancelled" });
    expect(await store.listPendingWaybillRequests()).toEqual([]);
    expect(mem.audits.filter((a) => a.action === "waybill_handoff_aivars")).toEqual([]);
  });

  it("Aivars error after a cancel request -> cancelled with a CSDD check (Aivars does not report steps)", async () => {
    seed([sample({ id: "wbr_a", status: "in_progress", pickedBy: "aivars", pickedAt: iso(NOW), cancelRequestedAt: iso(NOW) })]);
    const r = await store.completeWaybillRequest({ id: "wbr_a", ok: false, errorReason: "CSDD nav pieejams", by: "aivars" });
    expect(r).toMatchObject({ status: "cancelled", csddCheckNeeded: true });
  });
});

describe("stuck in progress: timeout instead of forever 'Izveido' or a second claim", () => {
  const min = 60_000;

  it("an in-progress job is never handed out again (06.11: the same job was claimed twice after 30 min)", async () => {
    seed([sample({ id: "wbr_w", status: "in_progress", pickedBy: "aivars", pickedAt: iso(NOW - 31 * min), updatedAt: iso(NOW - 10 * min) })]);
    expect(await store.listPendingWaybillRequests()).toEqual([]);
    expect(await store.claimWaybillRequest("wbr_w")).toBeNull();
  });

  it("Aivars silent for > 30 min -> Kļūda with a CSDD check; a later real result still wins", async () => {
    seed([sample({ id: "wbr_w", status: "in_progress", pickedBy: "aivars", pickedAt: iso(NOW - 31 * min), updatedAt: iso(NOW - 31 * min) })]);
    const changed = await store.expireStuckWaybillRequests(NOW);
    expect(changed.map((r) => r.id)).toEqual(["wbr_w"]);
    expect(byId("wbr_w")).toMatchObject({ status: "error", csddCheckNeeded: true });
    expect(byId("wbr_w").errorReason).toMatch(/Pārbaudi CSDD/);
    expect(await store.completeWaybillRequest({ id: "wbr_w", ok: true, waybillNo: "P02870", by: "aivars" })).toMatchObject({
      status: "issued",
      waybillNo: "P02870",
    });
  });

  it("retry after a stuck error goes to Aivars only, with 'check CSDD first' (no automatic duplicate)", async () => {
    seed([sample({ id: "wbr_e", status: "error", csddCheckNeeded: true, errorReason: "Iestrēdzis" })]);
    const r = await store.retryWaybillRequest({ id: "wbr_e", actorId: "env-admin", actorName: "Nils" });
    expect(r).toMatchObject({ status: "queued", autoDisabled: true, handoffCheckCsdd: true, csddCheckNeeded: false });
  });

  it("automation silent for > 15 min -> back to Aivars (check CSDD if Save may have run); under the limit untouched", async () => {
    seed([
      sample({ id: "wbr_s", status: "in_progress", pickedBy: "auto", pickedAt: iso(NOW - 16 * min), updatedAt: iso(NOW - 16 * min), stage: "saving", stageAt: iso(NOW - 16 * min) }),
      sample({
        id: "wbr_ok",
        vehicle: { brandModel: "BMW", vin: "", plate: "B1937", orderId: "" },
        status: "in_progress",
        pickedBy: "auto",
        pickedAt: iso(NOW - 14 * min),
        updatedAt: iso(NOW - 14 * min),
        stage: "filling",
        stageAt: iso(NOW - 14 * min),
      }),
    ]);
    await store.expireStuckWaybillRequests(NOW);
    expect(byId("wbr_s")).toMatchObject({ status: "queued", autoDisabled: true, handoffCheckCsdd: true, pickedBy: "" });
    expect(byId("wbr_ok")).toMatchObject({ status: "in_progress", stage: "filling" });
  });

  it("cancel requested but the worker never confirmed -> Atcelts with a CSDD check", async () => {
    seed([
      sample({ id: "wbr_c", status: "in_progress", pickedBy: "auto", pickedAt: iso(NOW - 20 * min), updatedAt: iso(NOW - 16 * min), stage: "pdf", stageAt: iso(NOW - 20 * min), cancelRequestedAt: iso(NOW - 16 * min) }),
    ]);
    await store.expireStuckWaybillRequests(NOW);
    expect(byId("wbr_c")).toMatchObject({ status: "cancelled", csddCheckNeeded: true });
  });

  it("old (> 24 h) records are never rewritten; nothing stuck -> no write at all", async () => {
    seed([sample({ id: "wbr_old", status: "in_progress", pickedBy: "aivars", createdAt: iso(NOW - 30 * 3_600_000), pickedAt: iso(NOW - 30 * 3_600_000), updatedAt: iso(NOW - 25 * 3_600_000) })]);
    const before = JSON.stringify(mem.doc);
    expect(await store.expireStuckWaybillRequests(NOW)).toEqual([]);
    expect(JSON.stringify(mem.doc)).toBe(before);
  });
});
