import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CarverticalAutoStatus, CarverticalBalance } from "@/lib/carvertical-auto-types";
import {
  applyBalanceUpdate,
  balanceIsStale,
  carverticalAutoCanApply,
  decideStart,
  isLowCredits,
  reduceCarverticalProgress,
  rigaDay,
} from "@/lib/carvertical-auto-logic";
import { CARVERTICAL_AUTOMATIC_FLOW_SOURCE_FILES, authorizeCarVerticalBackgroundPurchase } from "@/lib/carvertical-purchase";
import { importChain, importedBindings, reachableProjectFiles } from "@/lib/vin-scan/test-helpers/import-graph";

const VIN = "TMBLD9NS7J8038392";
const SID = "cs_test_order_1";
const PDF = new Uint8Array(Buffer.from("%PDF-1.7\nanonimizēts\n"));
/** Anonimizēta CarVertical PDF teksta slāņa fiksācija (struktūra kā īstā atskaitē, VIN izdomāts). */
const CV_PDF_TEXT = `carVertical
Odometra rādījumu ieraksti
10.2017. 19 km
03.2018. 4 964 km
11.2019. 59 394 km
Transportlīdzekļa specifikācija
Modelis
Kodiaq
Laikposms
10.2017. Čehija
11.2019. Latvija
${VIN}
`;

const store = new Map<string, CarverticalAutoStatus>();
const pdfs = new Map<string, Uint8Array>();
let balanceStore: CarverticalBalance | null = null;
const pushes: Array<{ title: string; body: string }> = [];

vi.mock("@/lib/carvertical-auto-store", () => ({
  readCarverticalAutoStatus: async (id: string) => store.get(id) ?? null,
  writeCarverticalAutoStatus: async (id: string, s: CarverticalAutoStatus) => {
    store.set(id, s);
    return { ok: true };
  },
  writeCarverticalPdf: async (id: string, b: Uint8Array) => {
    pdfs.set(id, b);
    return { ok: true };
  },
  readCarverticalPdf: async (id: string) => pdfs.get(id) ?? null,
  carverticalPdfBlobPath: (id: string) => `carvertical_auto/${id}.pdf`,
  readCarverticalBalance: async () => balanceStore,
  writeCarverticalBalance: async (b: CarverticalBalance) => {
    balanceStore = b;
    return { ok: true };
  },
}));
vi.mock("@/lib/admin-push", () => ({
  sendAdminPush: async (m: { title: string; body: string }) => {
    pushes.push(m);
    return { sent: 1, removed: 0 };
  },
}));
vi.mock("@/lib/admin-order-draft-store", () => ({
  readOrderDraft: async () => ({ orderEdits: { vin: VIN }, workspace: { sourceBlocks: {} } }),
  isSafeOrderDraftSessionId: (id: string) => /^[a-zA-Z0-9_]+$/.test(id),
}));
vi.mock("@/lib/dropbox-client", () => ({ getDropboxClient: () => null }));
vi.mock("@/lib/ltab-auto", () => ({
  orderCarFromCsdd: (_c: unknown, plate: string, vin: string) => ({ vin, make: "", model: "", year: "", plate }),
}));
vi.mock("@/lib/admin-auth", () => ({ getAdminSession: async () => true }));
vi.mock("@/lib/admin-ai", async (orig) => ({ ...(await orig<Record<string, unknown>>()), getAnthropicApiKeyFromEnv: () => "" }));
vi.mock("@/lib/pdf-text-extract-server", () => ({
  extractPdfTextDetailed: async () => ({ text: CV_PDF_TEXT, backend: "pdfjs" }),
}));
vi.mock("@/lib/currency-eur-convert", async (orig) => ({ ...(await orig<Record<string, unknown>>()), loadEcbDailyRates: async () => null }));

type FetchCall = { url: string; body: Record<string, unknown> };
let fetchCalls: FetchCall[] = [];

function stubRelayFetch(handler?: (url: string) => Response) {
  fetchCalls = [];
  vi.stubGlobal("fetch", async (url: string, init?: { body?: string }) => {
    fetchCalls.push({ url: String(url), body: init?.body ? (JSON.parse(init.body) as Record<string, unknown>) : {} });
    if (handler) return handler(String(url));
    return new Response(JSON.stringify({ jobId: "11111111-1111-4111-8111-111111111111", state: "queued" }), { status: 202 });
  });
}

beforeEach(() => {
  store.clear();
  pdfs.clear();
  pushes.length = 0;
  balanceStore = null;
  process.env.CARVERTICAL_RELAY_URL = "https://relay.example/carvertical";
  process.env.CARVERTICAL_RELAY_TOKEN = "x".repeat(32);
  stubRelayFetch();
});

describe("CarVertical fona pirkums: aizsardzība", () => {
  it("automātiskās plūsmas nesasniedz fona pirkumu (ne moduli, ne API, ne autorizāciju)", () => {
    const reached = reachableProjectFiles(CARVERTICAL_AUTOMATIC_FLOW_SOURCE_FILES);
    for (const forbidden of [
      "lib/carvertical-auto.ts",
      "app/api/admin/carvertical/route.ts",
      "components/admin/AdminCarVerticalAutoPanel.tsx",
    ]) {
      expect(reached.has(forbidden), importChain(reached, forbidden).join(" -> ")).toBe(false);
    }
    for (const file of reached.keys()) {
      if (file === "lib/carvertical-purchase.ts") continue;
      const names = importedBindings(file, "lib/carvertical-purchase.ts");
      expect(names, importChain(reached, file).join(" -> ")).not.toContain("authorizeCarVerticalBackgroundPurchase");
    }
  });

  it("VIN SCAN paneļi nesasniedz fona pirkuma pogu", () => {
    const reached = reachableProjectFiles([
      "components/admin/AdminVinScanPanel.tsx",
      "components/admin/AdminVinScanPageClient.tsx",
      "components/admin/AdminOrderVinScanCard.tsx",
    ]);
    expect(reached.has("components/admin/AdminCarVerticalAutoPanel.tsx")).toBe(false);
    expect(reached.has("lib/carvertical-auto.ts")).toBe(false);
  });

  it("pozitīvā kontrole: poga sasniedz API, API sasniedz autorizāciju", () => {
    expect(importedBindings("lib/carvertical-auto.ts", "lib/carvertical-purchase.ts")).toContain("authorizeCarVerticalBackgroundPurchase");
    expect(reachableProjectFiles(["app/api/admin/carvertical/route.ts"]).has("lib/carvertical-auto.ts")).toBe(true);
  });

  it("bez explicitOperatorConfirm: true - atteikts, relejs netiek saukts", async () => {
    const sneaky = { vin: VIN, explicitOperatorConfirm: false as unknown as true };
    expect(authorizeCarVerticalBackgroundPurchase(sneaky)).toEqual({ ok: false, code: "missing_confirm" });
    const { startCarverticalPurchase } = await import("@/lib/carvertical-auto");
    const out = await startCarverticalPurchase(SID, sneaky);
    expect(out).toMatchObject({ ok: false, started: false, error: "missing_confirm" });
    expect(fetchCalls).toHaveLength(0);
    expect(store.size).toBe(0);
  });

  it("API: action purchase bez confirm:true -> 400, relejs netiek saukts", async () => {
    const { POST } = await import("@/app/api/admin/carvertical/route");
    const res = await POST(new Request("http://x/api/admin/carvertical", { method: "POST", body: JSON.stringify({ action: "purchase", sessionId: SID, vin: VIN }) }));
    expect(res.status).toBe(400);
    expect(fetchCalls).toHaveLength(0);
  });

  it("ar apstiprinājumu relejam iet confirm:true un pasūtījuma ref", async () => {
    const { startCarverticalPurchase } = await import("@/lib/carvertical-auto");
    const out = await startCarverticalPurchase(SID, { vin: VIN, explicitOperatorConfirm: true, requestId: "req-1" });
    expect(out).toMatchObject({ ok: true, started: true });
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]!.url).toBe("https://relay.example/carvertical/purchase");
    expect(fetchCalls[0]!.body).toMatchObject({ vin: VIN, ref: SID, confirm: true, requestId: "req-1" });
  });

  it("\"Ielādēt nopirkto\" nekad nesūta confirm (relejs nepērk)", async () => {
    const { startCarverticalReportDownload } = await import("@/lib/carvertical-auto");
    await startCarverticalReportDownload(SID, VIN);
    expect(fetchCalls[0]!.url).toBe("https://relay.example/carvertical/report");
    expect(fetchCalls[0]!.body).not.toHaveProperty("confirm");
  });
});

describe("CarVertical fona pirkums: idempotence", () => {
  it("dubultklikšķis (tas pats requestId) un aktīvs uzdevums nesāk otru pirkumu", async () => {
    const { startCarverticalPurchase } = await import("@/lib/carvertical-auto");
    await startCarverticalPurchase(SID, { vin: VIN, explicitOperatorConfirm: true, requestId: "req-1" });
    const again = await startCarverticalPurchase(SID, { vin: VIN, explicitOperatorConfirm: true, requestId: "req-1" });
    const other = await startCarverticalPurchase(SID, { vin: VIN, explicitOperatorConfirm: true, requestId: "req-2" });
    expect(again).toMatchObject({ started: false, reason: "same_request" });
    expect(other).toMatchObject({ started: false, reason: "active" });
    expect(fetchCalls).toHaveLength(1);
  });

  it("šim pasūtījumam atskaite jau saņemta -> pirkums netiek sākts", () => {
    const ready: CarverticalAutoStatus = { state: "ready", vin: VIN, updatedAt: "2026-11-23T10:00:00Z", requestId: "a" };
    expect(decideStart(ready, { vin: VIN, kind: "purchase", requestId: "b" })).toMatchObject({ start: false, reason: "already_ready" });
    expect(decideStart(ready, { vin: VIN, kind: "report", requestId: "b" })).toEqual({ start: true });
    expect(decideStart({ ...ready, state: "error" }, { vin: VIN, kind: "purchase", requestId: "b" })).toEqual({ start: true });
  });

  it("vecs uzdevums (cits jobId) stāvokli nepārraksta", async () => {
    const { handleCarverticalRelayEvent } = await import("@/lib/carvertical-auto");
    store.set(SID, { state: "queued", vin: VIN, jobId: "new-job", updatedAt: "x" });
    const out = await handleCarverticalRelayEvent({ kind: "job", jobId: "old-job", ref: SID, vin: VIN, jobKind: "purchase", state: "checking" });
    expect(out).toMatchObject({ ok: false, httpStatus: 409 });
    expect(store.get(SID)?.jobId).toBe("new-job");
  });
});

describe("CarVertical atlikums", () => {
  it("< 5 kredīti: sarkans + viens push Rīgas dienā", () => {
    const now = new Date("2026-11-23T08:00:00Z");
    expect(isLowCredits(4)).toBe(true);
    expect(isLowCredits(5)).toBe(false);
    expect(isLowCredits(null)).toBe(false);
    const first = applyBalanceUpdate(null, 4, now);
    expect(first.push).toBe(true);
    expect(first.next.lowPushDay).toBe("2026-11-23");
    expect(applyBalanceUpdate(first.next, 3, new Date("2026-11-23T20:00:00Z")).push).toBe(false);
    // 23:30 UTC = 01:30 Rīgā nākamajā dienā -> atkal drīkst.
    expect(rigaDay(new Date("2026-11-23T23:30:00Z"))).toBe("2026-11-24");
    expect(applyBalanceUpdate(first.next, 3, new Date("2026-11-23T23:30:00Z")).push).toBe(true);
    expect(applyBalanceUpdate(first.next, 10, now).push).toBe(false);
  });

  it("kešs novecojis pēc 30 min", () => {
    const b = { credits: 7, checkedAt: "2026-11-23T10:00:00Z" };
    expect(balanceIsStale(b, new Date("2026-11-23T10:29:00Z"))).toBe(false);
    expect(balanceIsStale(b, new Date("2026-11-23T10:30:00Z"))).toBe(true);
    expect(balanceIsStale(null, new Date())).toBe(true);
  });

  it("releja atlikuma notikums -> kešs + push par zemu atlikumu tikai vienreiz", async () => {
    const { handleCarverticalRelayEvent } = await import("@/lib/carvertical-auto");
    await handleCarverticalRelayEvent({ kind: "balance", credits: 2 });
    await handleCarverticalRelayEvent({ kind: "balance", credits: 1 });
    expect(balanceStore?.credits).toBe(1);
    expect(pushes.filter((p) => /maz kredītu/.test(p.title))).toHaveLength(1);
  });
});

describe("CarVertical rezultāts -> pasūtījums", () => {
  it("progresa notikums -> latvisks stāvoklis; kļūdas kods -> skaidrs teksts", () => {
    const s = reduceCarverticalProgress(null, { kind: "job", jobId: "j", ref: SID, vin: VIN, jobKind: "purchase", state: "error", code: "insufficient_credits" }, "t");
    expect(s).toMatchObject({ state: "error", code: "insufficient_credits" });
    expect(s.message).toMatch(/nav kredītu/);
  });

  it("rezultāts: PDF tiek paņemts no releja, saglabāts, stāvoklis ready, push", async () => {
    const { handleCarverticalRelayEvent } = await import("@/lib/carvertical-auto");
    const jobId = "22222222-2222-4222-8222-222222222222";
    store.set(SID, { state: "downloading", vin: VIN, jobId, updatedAt: "x" });
    stubRelayFetch((url) => (url.endsWith(`/jobs/${jobId}/pdf`) ? new Response(PDF, { status: 200 }) : new Response("{}", { status: 404 })));
    const out = await handleCarverticalRelayEvent({ kind: "job", jobId, ref: SID, vin: VIN, jobKind: "purchase", state: "result", reportId: "r1", existing: false, credits: 6, pdfSize: PDF.length });
    expect(out).toMatchObject({ ok: true, state: "ready" });
    const st = store.get(SID)!;
    expect(st.pdf?.name).toBe(`CarVertical - ${VIN}.pdf`);
    expect(st.message).toMatch(/1 kredītu/);
    expect(carverticalAutoCanApply(st)).toBe(true);
    expect(pdfs.get(SID)?.subarray(0, 5)).toEqual(PDF.subarray(0, 5));
    expect(balanceStore?.credits).toBe(6);
    expect(pushes.some((p) => /atskaite gatava/.test(p.title))).toBe(true);
  });

  it("ne-PDF atbilde -> kļūda, bloks netiek aiztikts", async () => {
    const { handleCarverticalRelayEvent } = await import("@/lib/carvertical-auto");
    const jobId = "33333333-3333-4333-8333-333333333333";
    stubRelayFetch(() => new Response("<html>login</html>", { status: 200 }));
    await handleCarverticalRelayEvent({ kind: "job", jobId, ref: SID, vin: VIN, jobKind: "purchase", state: "result" });
    expect(store.get(SID)).toMatchObject({ state: "error", code: "bad_pdf" });
    expect(carverticalAutoCanApply(store.get(SID)!)).toBe(false);
  });

  it("parsera sasaiste: esošais CarVertical parseris ievieto nobraukumu, ar roku ievadītā rinda paliek", async () => {
    store.set(SID, {
      state: "ready",
      vin: VIN,
      jobId: "j",
      updatedAt: "x",
      readyAt: "x",
      pdf: { blobPath: `carvertical_auto/${SID}.pdf`, name: `CarVertical - ${VIN}.pdf`, size: PDF.length, savedAt: "x" },
    });
    pdfs.set(SID, PDF);
    const manualRow = { date: "01.01.2016", odometer: "1", country: "Latvija", source: "", works: "", location: "" };
    const { POST } = await import("@/app/api/admin/carvertical/apply/route");
    const res = await POST(
      new Request("http://x/api/admin/carvertical/apply", {
        method: "POST",
        body: JSON.stringify({ sessionId: SID, sourceBlocks: { carvertical: { serviceHistory: [manualRow] } } }),
      }),
    );
    const data = (await res.json()) as { ok: boolean; changedKeys: string[]; patchedSourceBlocks: { carvertical: { serviceHistory: Array<{ date: string; odometer: string }> } } };
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.changedKeys).toContain("carvertical");
    const rows = data.patchedSourceBlocks.carvertical.serviceHistory;
    expect(rows.some((r) => r.odometer.replace(/\D/g, "") === "4964")).toBe(true);
    expect(rows.some((r) => r.date === "01.01.2016" && r.odometer === "1")).toBe(true);
    expect(store.get(SID)?.appliedAt).toBeTruthy();
  });
});
