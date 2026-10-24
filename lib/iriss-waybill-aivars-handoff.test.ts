/**
 * j47: automātikas neveiksme nonāk pie Aivara.
 * Incidents 24.10: automātikas `result ok:false` (Saglabāt neizdevās, "NAV izveidota" u.c.) pieprasījumu atstāja
 * statusā "Kļūda" - tas nav rindā (GET), Aivars netiek pamodināts un cron to neredz, tāpēc Aivars to nekad nesaņēma.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WaybillRequest, WaybillRequestsDoc } from "@/lib/iriss-waybill-requests";

const mem = vi.hoisted(() => ({
  doc: null as unknown,
  audits: [] as Array<{ action: string; target: string }>,
  woken: [] as string[],
  after: [] as Array<() => unknown>,
}));

vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  after: (fn: () => unknown) => {
    mem.after.push(fn);
  },
}));
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
vi.mock("@/lib/iriss-aivars-api-token", () => ({
  irissAivarsApiTokenConfigured: () => true,
  verifyIrissAivarsApiToken: (h: string | null) => h === "Bearer test-token-123456",
}));
vi.mock("@/lib/iriss-aivars-wake", () => ({
  wakeAivars: async (id: string) => {
    mem.woken.push(id);
    return { ok: true, status: 200 };
  },
}));
vi.mock("@/lib/iriss-pavadzimes-store", () => ({ uploadIrissPavadzime: vi.fn() }));
vi.mock("@/lib/iriss-waybill-dropbox", () => ({ ensureWaybillRequestInDropbox: vi.fn() }));

const { POST: resultPost } = await import("@/app/api/iriss/aivars/waybill-requests/[id]/result/route");
const { listPendingWaybillRequests, readWaybillRequestsDoc } = await import("@/lib/iriss-waybill-requests-store");
const { toAivarsCreateWaybillAction } = await import("@/lib/iriss-waybill-create");
const { waybillAivarsReply } = await import("@/lib/iriss-waybill-requests");
const { withWaybillRequestStates } = await import("@/lib/iriss-waybill-live-plates");
const { waybillGaugesFromPlates } = await import("@/lib/iriss-waybill-gauges");

const now = new Date().toISOString();
const future = new Date(Date.now() + 48 * 3_600_000).toISOString();

const sample = (over: Partial<WaybillRequest>): WaybillRequest => ({
  id: "wbr_a1",
  createdBy: "usr_1",
  createdByName: "Andris",
  createdAt: now,
  updatedAt: now,
  vehicle: { brandModel: "MB E350", vin: "", plate: "B7627", orderId: "" },
  routeFrom: "Tukums, Rīgas iela",
  routeTo: "Tukuma CSDD",
  validDays: 2,
  validHours: 48,
  validFrom: now,
  validUntil: future,
  noteUntrusted: "",
  status: "in_progress",
  waybillNo: "",
  pdfUrl: "",
  errorReason: "",
  lastReplyText: "",
  attempts: 1,
  pickedBy: "auto",
  pickedAt: now,
  plateBusyAtCreate: false,
  autoDisabled: false,
  tradeAct: false,
  representative: "",
  stage: "saving",
  stageAt: now,
  dropboxPath: "",
  dropboxError: "",
  dropboxAt: "",
  ...over,
});

function seed(requests: WaybillRequest[]) {
  const doc: WaybillRequestsDoc = { version: 1, updatedAt: now, requests, events: [] };
  mem.doc = JSON.parse(JSON.stringify(doc));
  mem.audits = [];
  mem.woken = [];
  mem.after = [];
}

async function postResult(id: string, body: Record<string, unknown>) {
  const res = await resultPost(
    new Request(`https://x/api/iriss/aivars/waybill-requests/${id}/result`, {
      method: "POST",
      headers: { authorization: "Bearer test-token-123456", "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
  for (const fn of mem.after.splice(0)) await fn();
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

const plates = [
  { plate: "B193-7" as const, busy: false },
  { plate: "B762-7" as const, busy: false },
  { plate: "B192-7" as const, busy: false },
];

describe("j47: automātikas neveiksme -> Aivars", () => {
  beforeEach(() => seed([]));

  it("'NAV izveidota' -> atpakaļ rindā Aivaram, pamodināts, GET to rāda, aplis rāda 'Aivars'", async () => {
    seed([sample({ id: "wbr_nc" })]);
    const { status, json } = await postResult("wbr_nc", {
      ok: false,
      by: "auto",
      errorReason: "Automātika: CSDD pavadzīmi nesaglabāja. Pavadzīme NAV izveidota.",
    });
    expect(status).toBe(200);
    expect(json).toMatchObject({ ok: true, status: "queued", handedToAivars: true });
    expect(mem.woken).toEqual(["wbr_nc"]);
    expect(mem.audits).toEqual([{ action: "waybill_handoff_aivars", target: "wbr_nc" }]);

    const pending = await listPendingWaybillRequests();
    expect(pending.map((r) => r.id)).toEqual(["wbr_nc"]);
    const r = pending[0]!;
    expect(r).toMatchObject({ status: "queued", pickedBy: "", autoDisabled: true, errorReason: "", stage: "", handoffCheckCsdd: false });
    // Aivara darbā: kāpēc nodots; CSDD pārbaude nav obligāta (droši zināms, ka nav izveidota).
    expect(toAivarsCreateWaybillAction(r).handoff).toEqual({
      from: "auto",
      reason: "Automātika: CSDD pavadzīmi nesaglabāja. Pavadzīme NAV izveidota.",
      checkCsddFirst: false,
    });
    // Pieprasītājs redz, ka izraksta Aivars (nevis "Kļūda").
    const doc = await readWaybillRequestsDoc();
    const reply = waybillAivarsReply(r, doc.events, Date.now(), { mode: "live", isStandard: () => false, reasonFor: () => "nodots Aivaram" });
    expect(reply.statusLabel).toBe("Gaida");
    expect(reply.text).toMatch(/Nodots Aivaram - izraksta ar roku\.$/);
    // Augšējais aplis uzreiz: "Aivars" ar auto nosaukumu (nevis "brīvs").
    const g = waybillGaugesFromPlates(withWaybillRequestStates(plates, doc.requests)).find((x) => x.plate === "B762-7")!;
    expect(g).toMatchObject({ status: "issuing", manual: true, brandModel: "MB E350" });
  });

  it("kļūda Saglabāt laikā (nav zināms, vai izveidota) -> Aivaram ar checkCsddFirst", async () => {
    seed([sample({ id: "wbr_as" })]);
    await postResult("wbr_as", {
      ok: false,
      by: "auto",
      errorReason: "Automātika: timeout. Pārbaudi CSDD, vai pavadzīme jau ir izveidota.",
    });
    const [r] = await listPendingWaybillRequests();
    expect(r?.id).toBe("wbr_as");
    expect(toAivarsCreateWaybillAction(r!).handoff?.checkCsddFirst).toBe(true);
    expect(mem.woken).toEqual(["wbr_as"]);
  });

  it("'numurs CSDD aizņemts' paliek Kļūda (lemj lietotājs: anulēt vai nē), Aivars netiek modināts", async () => {
    seed([sample({ id: "wbr_busy", stage: "checking" })]);
    const { json } = await postResult("wbr_busy", {
      ok: false,
      by: "auto",
      errorReason: "Numurs B762-7 CSDD aizņemts (P02812). Jaunā pavadzīme nav izveidota. Ja vajag jaunu - nosūti vēlreiz un apstiprini anulēšanu.",
    });
    expect(json).toMatchObject({ status: "error" });
    expect(mem.woken).toEqual([]);
    expect(await listPendingWaybillRequests()).toEqual([]);
  });

  it("Aivara paša kļūda un darbs, ko automātika vairs netur, netiek pārvērsti", async () => {
    seed([sample({ id: "wbr_av", pickedBy: "aivars", stage: "" }), sample({ id: "wbr_done", status: "issued", pickedBy: "auto", waybillNo: "P1" })]);
    expect((await postResult("wbr_av", { ok: false, errorReason: "CSDD nestrādā" })).json).toMatchObject({ status: "error" });
    expect((await postResult("wbr_done", { ok: false, by: "auto", errorReason: "x NAV izveidota" })).json).toMatchObject({ status: "error" });
    expect(mem.woken).toEqual([]);
  });

  it("izdota automātiski - nemainīts ceļš (issued, bez nodošanas)", async () => {
    seed([sample({ id: "wbr_ok" })]);
    const { json } = await postResult("wbr_ok", { ok: true, by: "auto", waybillNo: "P02900" });
    expect(json).toMatchObject({ status: "issued", waybillNo: "P02900" });
    expect(mem.woken).toEqual([]);
  });
});

describe("autoFailureHandoff", () => {
  it("visu nodod Aivaram, izņemot aizņemtu numuru; CSDD pārbaude, ja nav droši 'NAV izveidota'", async () => {
    const { autoFailureHandoff } = await import("@/lib/iriss-waybill-requests");
    expect(autoFailureHandoff("Automātika: x. Pavadzīme NAV izveidota.")).toEqual({ handoff: true, checkCsddFirst: false });
    expect(autoFailureHandoff("Automātika: x. Pārbaudi CSDD, vai pavadzīme jau ir izveidota.")).toEqual({ handoff: true, checkCsddFirst: true });
    expect(autoFailureHandoff("")).toEqual({ handoff: true, checkCsddFirst: true });
    expect(autoFailureHandoff("Numuru B193-7 CSDD aizņem P1, nevis apstiprinātā P2. Neko neanulēju.")).toEqual({ handoff: false, checkCsddFirst: false });
  });
});
