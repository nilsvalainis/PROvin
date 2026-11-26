import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { emptyCsddFields, type CsddFormFields } from "@/lib/admin-source-blocks";
import {
  ECSDD_SMARTID_TIMEOUT_MS,
  ecsddCanApplyManually,
  ecsddCanRestorePrevious,
  ecsddClientShouldSync,
  ecsddAutoShouldStart,
  ecsddNeedsSmartIdRetry,
  ecsddSmartIdExpired,
  ecsddSessionSummaryLv,
  ecsddWaitReasonLv,
  reduceEcsddProgress,
  reduceEcsddResult,
  resolveEcsddQuery,
} from "@/lib/ecsdd-auto-logic";
import type { EcsddAutoStatus } from "@/lib/ecsdd-auto-types";
import { applyCsddPasteToForm, parseCsddPaste } from "@/lib/csdd-paste-parse";

const store = new Map<string, EcsddAutoStatus>();
const pushes: Array<{ title: string; body: string }> = [];
let draftCsdd: Record<string, unknown> = {};
let retryIndex: Array<{ ref: string; query: string; at: string }> = [];
const patches: Array<{ sessionId: string; csdd: CsddFormFields; opts: unknown }> = [];

vi.mock("@/lib/ecsdd-auto-store", () => ({
  readEcsddAutoStatus: async (id: string) => store.get(id) ?? null,
  writeEcsddAutoStatus: async (id: string, s: EcsddAutoStatus) => {
    store.set(id, s);
    return { ok: true };
  },
  readEcsddSmartIdRetryIndex: async () => [...retryIndex],
  writeEcsddSmartIdRetryIndex: async (refs: typeof retryIndex) => {
    retryIndex = [...refs];
    return { ok: true };
  },
}));
vi.mock("@/lib/admin-push", () => ({
  sendAdminPush: async (m: { title: string; body: string }) => {
    pushes.push(m);
    return { sent: 1, removed: 0 };
  },
}));
vi.mock("@/lib/source-health-store", () => ({ recordSourceOutcomes: async () => undefined }));
vi.mock("@/lib/admin-order-draft-store", () => ({
  readOrderDraft: async () => ({ orderEdits: {}, workspaceRevision: 7, workspace: { sourceBlocks: { csdd: draftCsdd } } }),
  patchOrderDraft: async (sessionId: string, patch: { workspace: { sourceBlocks: { csdd: CsddFormFields } } }, opts: unknown) => {
    patches.push({ sessionId, csdd: patch.workspace.sourceBlocks.csdd, opts });
    draftCsdd = patch.workspace.sourceBlocks.csdd as unknown as Record<string, unknown>;
    return { ok: true };
  },
  isSafeOrderDraftSessionId: (id: string) => /^[A-Za-z0-9_-]{6,120}$/.test(id),
}));

const VIN = "WBALW3C59CC891863";
const SESSION = "cs_test_order1";

function csdd(patch: Partial<CsddFormFields> = {}): CsddFormFields {
  return { ...emptyCsddFields(), ...patch };
}

function withRegistry(patch: Partial<CsddFormFields> = {}): CsddFormFields {
  return csdd({
    registry: {
      nr1: "AB1234",
      fetchedAt: "2026-10-23T08:00:00Z",
      data: { registrationNumber: "AB1234", vin: VIN, make: "BMW" } as NonNullable<CsddFormFields["registry"]>["data"],
    },
    ...patch,
  });
}

describe("e.csdd: ko meklēt un kad", () => {
  it("prefers the order VIN, then the CSDD VIN, then the LV plate", () => {
    expect(resolveEcsddQuery(csdd(), VIN.toLowerCase())).toEqual({ kind: "vin", query: VIN });
    expect(resolveEcsddQuery(withRegistry(), "")).toEqual({ kind: "vin", query: VIN });
    expect(resolveEcsddQuery(csdd({ registrationNumber: "ab 1234" }), "")).toEqual({ kind: "plate", query: "AB1234" });
    expect(resolveEcsddQuery(csdd(), "")).toBeNull();
  });

  it("automation when the CSDD API knew the car or there is an LV plate - also when RAW is already filled", () => {
    expect(ecsddAutoShouldStart(withRegistry())).toBe(true);
    expect(ecsddAutoShouldStart(withRegistry({ rawUnprocessedData: "VIN SCAN piezīmes" }))).toBe(true);
    expect(ecsddAutoShouldStart(csdd({ registrationNumber: "NB2407" }))).toBe(true);
    expect(ecsddAutoShouldStart(csdd())).toBe(false);
  });

  it("manual button stays while the block does not hold the e.csdd text; restore only when a backup exists", () => {
    const found: EcsddAutoStatus = { state: "found", rawText: "Reģistrācijas numurs AB1234", updatedAt: "x" };
    expect(ecsddCanApplyManually(found, csdd())).toBe(true);
    expect(ecsddCanApplyManually(found, csdd({ rawUnprocessedData: "jau ir" }))).toBe(true);
    expect(ecsddCanApplyManually(found, csdd({ rawUnprocessedData: "Reģistrācijas numurs AB1234" }))).toBe(false);
    expect(ecsddCanApplyManually({ state: "not_found", updatedAt: "x" }, csdd())).toBe(false);
    const applied = { ...found, appliedAt: "y", appliedBy: "auto" as const, previousRawText: "vecais" };
    expect(ecsddCanRestorePrevious(applied, csdd({ rawUnprocessedData: found.rawText }))).toBe(true);
    expect(ecsddCanRestorePrevious(applied, csdd({ rawUnprocessedData: "vecais" }))).toBe(false);
    expect(ecsddCanRestorePrevious({ ...found, appliedAt: "y" }, csdd())).toBe(false);
  });

  it("open tab takes over the server-inserted text only while it still shows the old RAW", () => {
    const s: EcsddAutoStatus = { state: "found", rawText: "e.csdd", appliedAt: "y", appliedBy: "auto", previousRawText: "vecais", updatedAt: "x" };
    expect(ecsddClientShouldSync(s, csdd({ rawUnprocessedData: "vecais" }))).toBe(true);
    expect(ecsddClientShouldSync(s, csdd({ rawUnprocessedData: "e.csdd" }))).toBe(false);
    // Nils pēc tam RAW mainīja pats - neaiztiek.
    expect(ecsddClientShouldSync(s, csdd({ rawUnprocessedData: "Nila labojums" }))).toBe(false);
    expect(ecsddClientShouldSync({ ...s, restoredAt: "z" }, csdd({ rawUnprocessedData: "vecais" }))).toBe(false);
    expect(ecsddClientShouldSync({ ...s, previousRawText: undefined }, csdd())).toBe(true);
  });

  it("relay text goes through the same RAW parser as a paste and fills inspection history", () => {
    const raw = [
      "Reģistrācijas numurs AB1234",
      "Statuss Uzskaitē",
      "Marka Modelis BMW 640I",
      `VIN ${VIN}`,
      "Iepriekšējās reģistrācijas valsts LIETUVA",
      "Transportlīdzekļa reģistrācija",
      "02.10.2026 - Pirmā reģistrācija Latvijā",
      "Nobraukuma vēsture",
      "Nobraukums, datums",
      "192100- 02.10.2026",
    ].join("\n");
    const out = applyCsddPasteToForm(csdd(), raw, parseCsddPaste(raw));
    expect(out.rawUnprocessedData).toBe(raw);
    expect(out.mileageHistory.some((r) => r.odometer.replace(/\D/g, "") === "192100")).toBe(true);
  });
});

describe("e.csdd: releja notikumi", () => {
  it("progress states carry the Smart-ID code only while waiting, and explain why a job waits", () => {
    const a = reduceEcsddProgress(null, { kind: "job", jobId: "j1", ref: SESSION, query: VIN, state: "awaiting_smartid", verificationCode: "4821" }, "t1");
    expect(a).toMatchObject({ state: "awaiting_smartid", verificationCode: "4821" });
    const b = reduceEcsddProgress(a, { kind: "job", jobId: "j1", ref: SESSION, query: VIN, state: "searching" }, "t2");
    expect(b.verificationCode).toBeUndefined();
    const w = reduceEcsddProgress(null, { kind: "job", jobId: "j1", ref: SESSION, query: VIN, state: "awaiting_login", reason: "yield" }, "t");
    expect(w.message).toMatch(/lieto tu/);
    const e = reduceEcsddProgress(null, { kind: "job", jobId: "j1", ref: SESSION, query: VIN, state: "error", code: "smartid_refused" }, "t");
    expect(e).toMatchObject({ state: "error", errorCode: "smartid_refused", message: "Smart-ID atteikts telefonā - spied \"Mēģināt vēlreiz\"" });
  });

  it("result: found keeps the text, empty found is an error, not found is explicit", () => {
    const ev = { kind: "job" as const, jobId: "j1", ref: SESSION, query: VIN, state: "result" as const };
    expect(reduceEcsddResult(null, { ...ev, found: true, rawText: "teksts" }, "t")).toMatchObject({ state: "found", rawText: "teksts" });
    expect(reduceEcsddResult(null, { ...ev, found: true, rawText: " " }, "t").state).toBe("error");
    expect(reduceEcsddResult(null, { ...ev, found: false }, "t").state).toBe("not_found");
  });

  it("session line tells whether the server holds the e.csdd session and when it yields", () => {
    const t = () => "14:30";
    expect(ecsddSessionSummaryLv({ state: "active", keepAlive: true }, t)).toMatch(/Serveris ielogojies/);
    expect(ecsddSessionSummaryLv({ state: "kicked", kickedAt: "x", yieldUntil: "y" }, t)).toMatch(/pārņēma cits pārlūks.*līdz 14:30/);
    expect(ecsddSessionSummaryLv(null, t)).toMatch(/nav sasniedzams/);
  });
});

describe("e.csdd: Vercel plūsma", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    store.clear();
    pushes.length = 0;
    patches.length = 0;
    retryIndex = [];
    draftCsdd = {};
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("ECSDD_RELAY_URL", "https://csdd-relay.provin.lv/ecsdd");
    vi.stubEnv("ECSDD_RELAY_TOKEN", "x".repeat(32));
    vi.stubEnv("ECSDD_AUTO_ENABLED", "1");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("manual request queues a job on the relay with the order VIN; the token is sent only as Bearer", async () => {
    const { startEcsddLookup } = await import("@/lib/ecsdd-auto");
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ jobId: "job-1", session: { state: "logged_out" } }), { status: 202 }));
    const out = await startEcsddLookup(SESSION, { trigger: "manual", orderVin: VIN, csdd: csdd() });
    expect(out.started).toBe(true);
    expect(out.status).toMatchObject({ state: "queued", jobId: "job-1", query: VIN, message: "Gaida e.csdd pieslēgšanos" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://csdd-relay.provin.lv/ecsdd/lookup");
    expect(JSON.parse(String(init.body))).toEqual({ query: VIN, ref: SESSION, trigger: "manual" });
    expect(String(init.body)).not.toContain("x".repeat(32));
  });

  it("automation does nothing for a foreign car (CSDD API did not know it), or without ECSDD_AUTO_ENABLED", async () => {
    const { startEcsddLookup } = await import("@/lib/ecsdd-auto");
    const r1 = await startEcsddLookup(SESSION, { trigger: "auto", orderVin: VIN, csdd: csdd() });
    expect(r1.started).toBe(false);
    vi.stubEnv("ECSDD_AUTO_ENABLED", "");
    const r2 = await startEcsddLookup(SESSION, { trigger: "auto", orderVin: VIN, csdd: withRegistry() });
    expect(r2.started).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.size).toBe(0);
  });

  it("session active: result is inserted into the CSDD block automatically; the old RAW is kept for restore", async () => {
    const { startEcsddLookup, handleEcsddJobEvent } = await import("@/lib/ecsdd-auto");
    draftCsdd = { ...withRegistry({ rawUnprocessedData: "VIN SCAN piezīmes" }) } as unknown as Record<string, unknown>;
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ jobId: "job-1", session: { state: "active" } }), { status: 202 }));
    const start = await startEcsddLookup(SESSION, { trigger: "auto", orderVin: VIN, csdd: draftCsdd as unknown as CsddFormFields });
    expect(start.started).toBe(true);
    expect(JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body))).toMatchObject({ trigger: "auto" });
    const raw = ["Reģistrācijas numurs AB1234", `VIN ${VIN}`, "Nobraukuma vēsture", "Nobraukums, datums", "192100- 02.10.2026"].join("\n");
    const out = await handleEcsddJobEvent({ kind: "job", jobId: "job-1", ref: SESSION, query: VIN, state: "result", found: true, rawText: raw });
    expect(out.ok).toBe(true);
    expect(patches).toHaveLength(1);
    expect(patches[0].opts).toEqual({ expectedWorkspaceRevision: 7 });
    expect(patches[0].csdd.rawUnprocessedData).toBe(raw);
    expect(patches[0].csdd.mileageHistory.some((r) => r.odometer.replace(/\D/g, "") === "192100")).toBe(true);
    // CSDD API dati paliek.
    expect(patches[0].csdd.registry?.data?.vin).toBe(VIN);
    expect(store.get(SESSION)).toMatchObject({ state: "found", appliedBy: "auto", previousRawText: "VIN SCAN piezīmes" });
    expect(store.get(SESSION)?.appliedAt).toBeTruthy();

    // Atkārtots pieprasījums: iepriekšējais e.csdd teksts NEaizstāj Nila sākotnējo RAW rezervē.
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ jobId: "job-2", session: { state: "active" } }), { status: 202 }));
    await startEcsddLookup(SESSION, { trigger: "manual", orderVin: VIN, force: true });
    await handleEcsddJobEvent({ kind: "job", jobId: "job-2", ref: SESSION, query: VIN, state: "result", found: true, rawText: `${raw}\nStatuss Uzskaitē` });
    expect(patches).toHaveLength(2);
    expect(store.get(SESSION)?.previousRawText).toBe("VIN SCAN piezīmes");
  });

  it("quick evaluation / VIN SCAN refs are never written into an order draft", async () => {
    const { handleEcsddJobEvent } = await import("@/lib/ecsdd-auto");
    await handleEcsddJobEvent({ kind: "job", jobId: "j", ref: "qe_abc_def", query: VIN, state: "result", found: true, rawText: "teksts" });
    expect(patches).toHaveLength(0);
    expect(store.get("qe_abc_def")).toMatchObject({ state: "found", rawText: "teksts" });
  });

  it("no session: one Smart-ID request per order - the second automatic start does not ask again", async () => {
    const { startEcsddLookup, handleEcsddJobEvent } = await import("@/lib/ecsdd-auto");
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ jobId: "job-1", session: { state: "logged_out" } }), { status: 202 }));
    const r1 = await startEcsddLookup(SESSION, { trigger: "auto", orderVin: VIN, csdd: withRegistry() });
    expect(r1.status).toMatchObject({ state: "queued", message: "Gaida e.csdd pieslēgšanos" });
    await handleEcsddJobEvent({ kind: "job", jobId: "job-1", ref: SESSION, query: VIN, state: "awaiting_smartid", verificationCode: "4821" });
    expect(store.get(SESSION)).toMatchObject({ state: "awaiting_smartid", verificationCode: "4821", message: "Gaida Smart-ID - apstiprini telefonā" });
    expect(store.get(SESSION)?.smartIdAskedAt).toBeTruthy();
    await handleEcsddJobEvent({ kind: "job", jobId: "job-1", ref: SESSION, query: VIN, state: "error", code: "smartid_timeout" });
    const r2 = await startEcsddLookup(SESSION, { trigger: "auto", orderVin: VIN, csdd: withRegistry() });
    expect(r2.started).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(store.get(SESSION)?.message).toMatch(/Smart-ID neapstiprināts/);
    expect(ecsddNeedsSmartIdRetry(store.get(SESSION))).toBe(true);
  });

  it("queue: orders that failed on one Smart-ID are re-queued together once the server logs in (no new Smart-ID)", async () => {
    const { startEcsddLookup, handleEcsddJobEvent, handleEcsddSessionEvent } = await import("@/lib/ecsdd-auto");
    const refs = ["cs_live_order_a", "cs_live_order_b", "cs_live_order_c"];
    let n = 0;
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ jobId: `job-${++n}`, session: { state: "logged_out" } }), { status: 202 }));
    for (const ref of refs) await startEcsddLookup(ref, { trigger: "auto", orderVin: VIN, csdd: withRegistry() });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const [i, ref] of refs.entries()) {
      await handleEcsddJobEvent({ kind: "job", jobId: `job-${i + 1}`, ref, query: VIN, state: "error", code: "smartid_timeout" });
    }
    expect(retryIndex.map((e) => e.ref)).toEqual(refs);
    // Nils nospiež «Mēģināt vēlreiz» vienā pasūtījumā -> serveris ielogojas -> visi pārējie rindā paši.
    await handleEcsddSessionEvent({ state: "active" });
    expect(fetchMock).toHaveBeenCalledTimes(6);
    const bodies = fetchMock.mock.calls.slice(3).map((c) => JSON.parse(String((c as [string, RequestInit])[1].body)));
    expect(bodies.map((b) => b.ref)).toEqual(refs);
    expect(bodies.every((b) => b.trigger === "auto")).toBe(true);
    expect(retryIndex).toEqual([]);
    // Otrs «active» notikums neko neatkārto.
    await handleEcsddSessionEvent({ state: "active" });
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it("timeout: no Smart-ID approval within 5 min -> «Smart-ID neapstiprināts» and «Mēģināt vēlreiz» upgrades to Nils's request", async () => {
    const { expireStaleEcsddSmartId, startEcsddLookup } = await import("@/lib/ecsdd-auto");
    const asked = new Date(Date.now() - ECSDD_SMARTID_TIMEOUT_MS - 1000).toISOString();
    const waiting: EcsddAutoStatus = { state: "awaiting_smartid", jobId: "job-1", query: VIN, verificationCode: "4821", smartIdAskedAt: asked, updatedAt: asked };
    expect(ecsddSmartIdExpired({ ...waiting, smartIdAskedAt: new Date().toISOString() }, Date.now())).toBe(false);
    store.set(SESSION, waiting);
    const out = await expireStaleEcsddSmartId(SESSION, waiting);
    expect(out).toMatchObject({ state: "error", errorCode: "smartid_timeout" });
    expect(out?.message).toMatch(/^Smart-ID neapstiprināts/);
    expect(out?.verificationCode).toBeUndefined();
    expect(ecsddNeedsSmartIdRetry(out)).toBe(true);
    expect(retryIndex.map((e) => e.ref)).toEqual([SESSION]);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ jobId: "job-1", session: { state: "logged_out" } }), { status: 202 }));
    const retry = await startEcsddLookup(SESSION, { trigger: "manual", orderVin: VIN, force: true });
    expect(retry.started).toBe(true);
    expect(JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body))).toMatchObject({ trigger: "manual" });
  });

  it("manual «Ievietot e.csdd datus» keeps the previous RAW; restore marks it so automation does not re-insert", async () => {
    const { markEcsddAutoApplied } = await import("@/lib/ecsdd-auto");
    store.set(SESSION, { state: "found", rawText: "e.csdd teksts", updatedAt: "t" });
    const a = await markEcsddAutoApplied(SESSION, { previousRawText: "Nila RAW" });
    expect(a).toMatchObject({ appliedBy: "manual", previousRawText: "Nila RAW" });
    const r = await markEcsddAutoApplied(SESSION, { action: "restore" });
    expect(r?.restoredAt).toBeTruthy();
    expect(r?.appliedAt).toBeUndefined();
    expect(ecsddClientShouldSync(r, csdd({ rawUnprocessedData: "Nila RAW" }))).toBe(false);
  });

  it("a stale job event does not overwrite the newer request", async () => {
    const { handleEcsddJobEvent } = await import("@/lib/ecsdd-auto");
    store.set(SESSION, { state: "queued", jobId: "new", updatedAt: "t" });
    const out = await handleEcsddJobEvent({ kind: "job", jobId: "old", ref: SESSION, query: VIN, state: "result", found: true, rawText: "x" });
    expect(out).toMatchObject({ ok: false, httpStatus: 409 });
    expect(store.get(SESSION)?.jobId).toBe("new");
  });

  it("session waiting for Smart-ID pushes the code to Nils with a warning about his own session", async () => {
    const { handleEcsddSessionEvent } = await import("@/lib/ecsdd-auto");
    await handleEcsddSessionEvent({ state: "awaiting_smartid", verificationCode: "4821" });
    await handleEcsddSessionEvent({ state: "active" });
    expect(pushes).toHaveLength(1);
    expect(pushes[0].body).toContain("Kods 4821");
    expect(pushes[0].body).toContain("citā pārlūkā tiks pārtraukta");
    expect(pushes[0].body).not.toMatch(/[\u2013\u2014]/);
  });

  it("relay callback rejects requests without the token", async () => {
    const { POST } = await import("@/app/api/ecsdd/relay-callback/route");
    const res = await POST(new Request("https://www.provin.lv/api/ecsdd/relay-callback", { method: "POST", body: "{}" }));
    expect(res.status).toBe(401);
    const ok = await POST(
      new Request("https://www.provin.lv/api/ecsdd/relay-callback", {
        method: "POST",
        headers: { authorization: `Bearer ${"x".repeat(32)}` },
        body: JSON.stringify({ kind: "job", jobId: "j1", ref: SESSION, query: VIN, state: "result", found: true, rawText: "Reģistrācijas numurs AB1234" }),
      }),
    );
    expect(ok.status).toBe(200);
    expect(store.get(SESSION)).toMatchObject({ state: "found", rawText: "Reģistrācijas numurs AB1234" });
  });
});

describe("e.csdd: gaidīšanas ziņa (26.11 - nekad «Gaida rītu»)", () => {
  it("night iemesls (tikai ar sašaurinātu releja logu) nesola rītu", () => {
    expect(ecsddWaitReasonLv("night")).not.toMatch(/rītu|08:00|naktī/i);
  });
});
