import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { emptyCsddFields, type CsddFormFields } from "@/lib/admin-source-blocks";
import {
  ecsddAutoCanApply,
  ecsddAutoShouldStart,
  ecsddSessionSummaryLv,
  reduceEcsddProgress,
  reduceEcsddResult,
  resolveEcsddQuery,
} from "@/lib/ecsdd-auto-logic";
import type { EcsddAutoStatus } from "@/lib/ecsdd-auto-types";
import { applyCsddPasteToForm, parseCsddPaste } from "@/lib/csdd-paste-parse";

const store = new Map<string, EcsddAutoStatus>();
const pushes: Array<{ title: string; body: string }> = [];
let draftCsdd: Record<string, unknown> = {};

vi.mock("@/lib/ecsdd-auto-store", () => ({
  readEcsddAutoStatus: async (id: string) => store.get(id) ?? null,
  writeEcsddAutoStatus: async (id: string, s: EcsddAutoStatus) => {
    store.set(id, s);
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
  readOrderDraft: async () => ({ orderEdits: {}, workspace: { sourceBlocks: { csdd: draftCsdd } } }),
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

  it("automation only when the CSDD API knew the car and RAW is still empty (never overwrites Nils's paste)", () => {
    expect(ecsddAutoShouldStart(withRegistry())).toBe(true);
    expect(ecsddAutoShouldStart(withRegistry({ rawUnprocessedData: "Nila teksts" }))).toBe(false);
    expect(ecsddAutoShouldStart(csdd())).toBe(false);
  });

  it("auto-insert only into an empty RAW and only once", () => {
    const found: EcsddAutoStatus = { state: "found", rawText: "Reģistrācijas numurs AB1234", updatedAt: "x" };
    expect(ecsddAutoCanApply(found, csdd())).toBe(true);
    expect(ecsddAutoCanApply(found, csdd({ rawUnprocessedData: "jau ir" }))).toBe(false);
    expect(ecsddAutoCanApply({ ...found, appliedAt: "y" }, csdd())).toBe(false);
    expect(ecsddAutoCanApply({ state: "not_found", updatedAt: "x" }, csdd())).toBe(false);
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
    expect(e).toMatchObject({ state: "error", message: "Smart-ID pieprasījums atteikts telefonā" });
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

  it("automation does nothing for an order whose RAW Nils already filled, or without ECSDD_AUTO_ENABLED", async () => {
    const { startEcsddLookup } = await import("@/lib/ecsdd-auto");
    const r1 = await startEcsddLookup(SESSION, { trigger: "auto", orderVin: VIN, csdd: withRegistry({ rawUnprocessedData: "Nila teksts" }) });
    expect(r1.started).toBe(false);
    vi.stubEnv("ECSDD_AUTO_ENABLED", "");
    const r2 = await startEcsddLookup(SESSION, { trigger: "auto", orderVin: VIN, csdd: withRegistry() });
    expect(r2.started).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.size).toBe(0);
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
