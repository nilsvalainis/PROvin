import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AutodnaAutoStatus, AutodnaBalance } from "@/lib/autodna-auto-types";
import { autodnaAutoCanApply, decideAutodnaStart, reduceAutodnaProgress } from "@/lib/autodna-auto-logic";
import { AUTODNA_AUTOMATIC_FLOW_SOURCE_FILES, authorizeAutodnaBackgroundPurchase } from "@/lib/autodna-background-purchase";
import { importChain, importedBindings, reachableProjectFiles } from "@/lib/vin-scan/test-helpers/import-graph";

const VIN = "WVWZZZ3CZWE123456";
const SID = "cs_test_order_1";
const PDF = new Uint8Array(Buffer.from("%PDF-1.7\nanonimizēts\n"));
/** Anonimizēta AutoDNA PDF teksta slāņa fiksācija (VIN izdomāts). */
const DNA_PDF_TEXT = fs.readFileSync(path.join(process.cwd(), "lib/__fixtures__/autodna-damage-page-break/autodna-lv.txt"), "utf8");

const store = new Map<string, AutodnaAutoStatus>();
const pdfs = new Map<string, Uint8Array>();
let balanceStore: AutodnaBalance | null = null;
const pushes: Array<{ title: string; body: string }> = [];

vi.mock("@/lib/autodna-auto-store", () => ({
  readAutodnaAutoStatus: async (id: string) => store.get(id) ?? null,
  writeAutodnaAutoStatus: async (id: string, s: AutodnaAutoStatus) => {
    store.set(id, s);
    return { ok: true };
  },
  writeAutodnaPdf: async (id: string, b: Uint8Array) => {
    pdfs.set(id, b);
    return { ok: true };
  },
  readAutodnaPdf: async (id: string) => pdfs.get(id) ?? null,
  autodnaPdfBlobPath: (id: string) => `autodna_auto/${id}.pdf`,
  readAutodnaBalance: async () => balanceStore,
  writeAutodnaBalance: async (b: AutodnaBalance) => {
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
  extractPdfTextDetailed: async () => ({ text: DNA_PDF_TEXT, backend: "pdfjs" }),
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
  process.env.AUTODNA_RELAY_URL = "https://relay.example/autodna";
  process.env.AUTODNA_RELAY_TOKEN = "y".repeat(32);
  stubRelayFetch();
});

describe("AutoDNA fona pirkums: aizsardzība", () => {
  it("automātiskās plūsmas nesasniedz fona pirkumu (ne moduli, ne API, ne autorizāciju)", () => {
    const reached = reachableProjectFiles(AUTODNA_AUTOMATIC_FLOW_SOURCE_FILES);
    for (const forbidden of [
      "lib/autodna-auto.ts",
      "app/api/admin/autodna/fona/route.ts",
      "components/admin/AdminAutodnaAutoPanel.tsx",
    ]) {
      expect(reached.has(forbidden), importChain(reached, forbidden).join(" -> ")).toBe(false);
    }
    for (const file of reached.keys()) {
      if (file === "lib/autodna-background-purchase.ts") continue;
      const names = importedBindings(file, "lib/autodna-background-purchase.ts");
      expect(names, importChain(reached, file).join(" -> ")).not.toContain("authorizeAutodnaBackgroundPurchase");
    }
  });

  it("VIN SCAN paneļi nesasniedz fona pirkuma pogu", () => {
    const reached = reachableProjectFiles([
      "components/admin/AdminVinScanPanel.tsx",
      "components/admin/AdminVinScanPageClient.tsx",
      "components/admin/AdminOrderVinScanCard.tsx",
    ]);
    expect(reached.has("components/admin/AdminAutodnaAutoPanel.tsx")).toBe(false);
    expect(reached.has("lib/autodna-auto.ts")).toBe(false);
  });

  it("pozitīvā kontrole: poga sasniedz API, API sasniedz autorizāciju; partnera API netiek lietots", () => {
    expect(importedBindings("lib/autodna-auto.ts", "lib/autodna-background-purchase.ts")).toContain("authorizeAutodnaBackgroundPurchase");
    const reached = reachableProjectFiles(["app/api/admin/autodna/fona/route.ts"]);
    expect(reached.has("lib/autodna-auto.ts")).toBe(true);
    expect(reached.has("lib/autodna-api.ts")).toBe(false);
    expect(reached.has("lib/autodna-purchase.ts")).toBe(false);
  });

  it("bez explicitOperatorConfirm: true - atteikts, relejs netiek saukts", async () => {
    const sneaky = { vin: VIN, explicitOperatorConfirm: false as unknown as true };
    expect(authorizeAutodnaBackgroundPurchase(sneaky)).toEqual({ ok: false, code: "missing_confirm" });
    const { startAutodnaPurchase } = await import("@/lib/autodna-auto");
    const out = await startAutodnaPurchase(SID, sneaky);
    expect(out).toMatchObject({ ok: false, started: false, error: "missing_confirm" });
    expect(fetchCalls).toHaveLength(0);
    expect(store.size).toBe(0);
  });

  it("API: action purchase bez confirm:true -> 400, relejs netiek saukts", async () => {
    const { POST } = await import("@/app/api/admin/autodna/fona/route");
    const res = await POST(new Request("http://x/api/admin/autodna/fona", { method: "POST", body: JSON.stringify({ action: "purchase", sessionId: SID, vin: VIN }) }));
    expect(res.status).toBe(400);
    expect(fetchCalls).toHaveLength(0);
  });

  it("ar apstiprinājumu relejam iet confirm:true un pasūtījuma ref", async () => {
    const { startAutodnaPurchase } = await import("@/lib/autodna-auto");
    const out = await startAutodnaPurchase(SID, { vin: VIN, explicitOperatorConfirm: true, requestId: "req-1" });
    expect(out).toMatchObject({ ok: true, started: true });
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]!.url).toBe("https://relay.example/autodna/purchase");
    expect(fetchCalls[0]!.body).toMatchObject({ vin: VIN, ref: SID, confirm: true, requestId: "req-1" });
  });

  it("\"Ielādēt nopirkto\" nekad nesūta confirm (relejs nepērk)", async () => {
    const { startAutodnaReportDownload } = await import("@/lib/autodna-auto");
    await startAutodnaReportDownload(SID, VIN);
    expect(fetchCalls[0]!.url).toBe("https://relay.example/autodna/report");
    expect(fetchCalls[0]!.body).not.toHaveProperty("confirm");
  });

  it("bez releja env: stāvoklis not_configured, nekas netiek sūtīts", async () => {
    delete process.env.AUTODNA_RELAY_URL;
    const { startAutodnaPurchase } = await import("@/lib/autodna-auto");
    const out = await startAutodnaPurchase(SID, { vin: VIN, explicitOperatorConfirm: true });
    expect(out).toMatchObject({ ok: false, started: false });
    expect(store.get(SID)?.state).toBe("not_configured");
    expect(fetchCalls).toHaveLength(0);
  });
});

describe("AutoDNA fona pirkums: idempotence", () => {
  it("dubultklikšķis (tas pats requestId) un aktīvs uzdevums nesāk otru pirkumu", async () => {
    const { startAutodnaPurchase } = await import("@/lib/autodna-auto");
    await startAutodnaPurchase(SID, { vin: VIN, explicitOperatorConfirm: true, requestId: "req-1" });
    const again = await startAutodnaPurchase(SID, { vin: VIN, explicitOperatorConfirm: true, requestId: "req-1" });
    const other = await startAutodnaPurchase(SID, { vin: VIN, explicitOperatorConfirm: true, requestId: "req-2" });
    expect(again).toMatchObject({ started: false, reason: "same_request" });
    expect(other).toMatchObject({ started: false, reason: "active" });
    expect(fetchCalls).toHaveLength(1);
  });

  it("šim pasūtījumam atskaite jau saņemta -> pirkums netiek sākts", () => {
    const ready: AutodnaAutoStatus = { state: "ready", vin: VIN, updatedAt: "2026-11-24T10:00:00Z", requestId: "a" };
    expect(decideAutodnaStart(ready, { vin: VIN, kind: "purchase", requestId: "b" })).toMatchObject({ start: false, reason: "already_ready" });
    expect(decideAutodnaStart(ready, { vin: VIN, kind: "report", requestId: "b" })).toEqual({ start: true });
    expect(decideAutodnaStart({ ...ready, state: "error" }, { vin: VIN, kind: "purchase", requestId: "b" })).toEqual({ start: true });
  });

  it("vecs uzdevums (cits jobId) stāvokli nepārraksta", async () => {
    const { handleAutodnaRelayEvent } = await import("@/lib/autodna-auto");
    store.set(SID, { state: "queued", vin: VIN, jobId: "new-job", updatedAt: "x" });
    const out = await handleAutodnaRelayEvent({ kind: "job", jobId: "old-job", ref: SID, vin: VIN, jobKind: "purchase", state: "checking" });
    expect(out).toMatchObject({ ok: false, httpStatus: 409 });
    expect(store.get(SID)?.jobId).toBe("new-job");
  });
});

describe("AutoDNA atlikums un paziņojumi", () => {
  it("releja atlikuma notikums -> kešs + push par zemu atlikumu tikai vienreiz", async () => {
    const { handleAutodnaRelayEvent } = await import("@/lib/autodna-auto");
    await handleAutodnaRelayEvent({ kind: "balance", credits: 2 });
    await handleAutodnaRelayEvent({ kind: "balance", credits: 1 });
    expect(balanceStore?.credits).toBe(1);
    expect(pushes.filter((p) => /AutoDNA: maz kredītu/.test(p.title))).toHaveLength(1);
  });

  it("Turnstile -> latvisks teksts + push ar AutoDNA saiti; nepareiza parole -> push", async () => {
    const { handleAutodnaRelayEvent } = await import("@/lib/autodna-auto");
    store.set(SID, { state: "purchasing", vin: VIN, jobId: "j1", updatedAt: "x" });
    await handleAutodnaRelayEvent({ kind: "job", jobId: "j1", ref: SID, vin: VIN, jobKind: "purchase", state: "error", code: "turnstile" });
    expect(store.get(SID)).toMatchObject({ state: "error", code: "turnstile" });
    expect(store.get(SID)?.message).toMatch(/cilvēks/);
    expect(pushes.some((p) => p.body.includes(`https://www.autodna.lv/vin/${VIN}`))).toBe(true);
    await handleAutodnaRelayEvent({ kind: "session", state: "needs_human", code: "bad_credentials" });
    expect(pushes.some((p) => /Aizmirsi paroli/.test(p.body))).toBe(true);
  });

  it("sausais režīms -> skaidrs teksts, bez push", () => {
    const s = reduceAutodnaProgress(null, { kind: "job", jobId: "j", ref: SID, vin: VIN, jobKind: "purchase", state: "error", code: "dry_run" }, "t");
    expect(s.message).toMatch(/nav ieslēgts/);
  });

  it("panelis: pirkuma poga tikai ar purchaseLive no releja", async () => {
    stubRelayFetch((url) =>
      url.endsWith("/session")
        ? new Response(JSON.stringify({ session: { state: "active" }, purchaseLive: false }), { status: 200 })
        : new Response(JSON.stringify({ balance: { credits: 7, checkedAt: "2026-11-24T10:00:00Z" } }), { status: 200 }),
    );
    const { getAutodnaOverview } = await import("@/lib/autodna-auto");
    const o = await getAutodnaOverview();
    expect(o).toMatchObject({ relayConfigured: true, session: "active", purchaseLive: false });
    expect(o.balance?.credits).toBe(7);
  });
});

describe("AutoDNA rezultāts -> pasūtījums", () => {
  it("rezultāts: PDF tiek paņemts no releja, saglabāts, stāvoklis ready, push", async () => {
    const { handleAutodnaRelayEvent } = await import("@/lib/autodna-auto");
    const jobId = "22222222-2222-4222-8222-222222222222";
    store.set(SID, { state: "downloading", vin: VIN, jobId, updatedAt: "x" });
    stubRelayFetch((url) => (url.endsWith(`/jobs/${jobId}/pdf`) ? new Response(PDF, { status: 200 }) : new Response("{}", { status: 404 })));
    const out = await handleAutodnaRelayEvent({ kind: "job", jobId, ref: SID, vin: VIN, jobKind: "purchase", state: "result", existing: false, credits: 6, pdfSize: PDF.length });
    expect(out).toMatchObject({ ok: true, state: "ready" });
    const st = store.get(SID)!;
    expect(st.pdf?.name).toBe(`AutoDNA - ${VIN}.pdf`);
    expect(st.message).toMatch(/1 kredītu/);
    expect(autodnaAutoCanApply(st)).toBe(true);
    expect(balanceStore?.credits).toBe(6);
    expect(pushes.some((p) => /AutoDNA: atskaite gatava/.test(p.title))).toBe(true);
  });

  it("ne-PDF atbilde -> kļūda, bloks netiek aiztikts", async () => {
    const { handleAutodnaRelayEvent } = await import("@/lib/autodna-auto");
    const jobId = "33333333-3333-4333-8333-333333333333";
    stubRelayFetch(() => new Response("<html>login</html>", { status: 200 }));
    await handleAutodnaRelayEvent({ kind: "job", jobId, ref: SID, vin: VIN, jobKind: "purchase", state: "result" });
    expect(store.get(SID)).toMatchObject({ state: "error", code: "bad_pdf" });
    expect(autodnaAutoCanApply(store.get(SID)!)).toBe(false);
  });

  it("parsera sasaiste: esošais AutoDNA parseris ievieto datus AutoDNA blokā, tikai šo bloku", async () => {
    store.set(SID, {
      state: "ready",
      vin: VIN,
      jobId: "j",
      updatedAt: "x",
      readyAt: "x",
      pdf: { blobPath: `autodna_auto/${SID}.pdf`, name: `AutoDNA - ${VIN}.pdf`, size: PDF.length, savedAt: "x" },
    });
    pdfs.set(SID, PDF);
    const { POST } = await import("@/app/api/admin/autodna/fona/apply/route");
    const res = await POST(
      new Request("http://x/api/admin/autodna/fona/apply", { method: "POST", body: JSON.stringify({ sessionId: SID, sourceBlocks: {} }) }),
    );
    const data = (await res.json()) as { ok: boolean; changedKeys: string[] };
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.changedKeys).toContain("autodna");
    expect(data.changedKeys).not.toContain("carvertical");
    expect(store.get(SID)?.appliedAt).toBeTruthy();
  });
});
