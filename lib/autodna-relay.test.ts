import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  analyzePurchasePage,
  classifyLoginResponse,
  decidePurchase,
  isAllowedHost,
  isForbiddenPath,
  isPaymentPath,
  isPdfBase64,
  parseClientCredits,
  parseCreditsFromText,
  parseHistoryRows,
  parseIsLogin,
  pickPdfHref,
  redact,
  totalLooksLikeCredit,
} from "@/relay/provin-autodna/lib/dna-page.mjs";
import { createRelayCore } from "@/relay/provin-autodna/lib/relay-core.mjs";

const VIN = "WVWZZZ1JZXW000001";
const PDF_B64 = Buffer.from("%PDF-1.7\n% anonimizēts\n").toString("base64");

describe("AutoDNA relejs: lapu un atbilžu atpazīšana (dzīvi redzētās formas 24.11.2026)", () => {
  it("navigācija tikai uz autodna.lv; pakas / bankas aizliegtas; /payment tikai atsevišķi", () => {
    expect(isAllowedHost("www.autodna.lv")).toBe(true);
    expect(isAllowedHost("autodna.lv")).toBe(true);
    expect(isAllowedHost("secure.przelewy24.pl")).toBe(false);
    expect(isAllowedHost("autodna.lv.evil.example")).toBe(false);
    expect(isForbiddenPath("/pakas")).toBe(true);
    expect(isForbiddenPath("/biznesa-pakas")).toBe(true);
    expect(isForbiddenPath("/vin/" + VIN)).toBe(false);
    expect(isForbiddenPath("/profile/history")).toBe(false);
    expect(isPaymentPath("/payment/transaction")).toBe(true);
    expect(isPaymentPath("/vin/" + VIN)).toBe(false);
  });

  it("pieteikšanās atbilde /ajax/client_login", () => {
    expect(classifyLoginResponse({ is_valid: 0, errors: [], default_error: "Nepareizs logins vai parole" })).toBe("bad_credentials");
    expect(classifyLoginResponse({ is_valid: 1 })).toBe("ok");
    expect(classifyLoginResponse(null)).toBe("unknown");
  });

  it("/ajax/client_is_login: ielogots + vai VIN nopirkts, bez e-pasta", () => {
    const anon = parseIsLogin({ client_email: "", client_id: 0, report_bought: false, report_vid: "", report_date: "", report_is_report: false, report_is_timeout: false });
    expect(anon).toMatchObject({ loggedIn: false, known: true, reportBought: false });
    const user = parseIsLogin({ client_email: "x@y.lv", client_id: 77, report_bought: "true", report_date: "2026-11-05", report_is_report: true });
    expect(user).toMatchObject({ loggedIn: true, reportBought: true, reportDate: "2026-11-05", isReport: true });
    expect(JSON.stringify(user)).not.toContain("@");
  });

  it("kredītu atlikums no /ajax/get_client_credits", () => {
    expect(parseClientCredits({ count: 1, data: [{ report_code: "report_autodna_vhr", limit: "7", product_id: "1" }] })).toBe(7);
    expect(parseClientCredits({ count: 0, data: [] })).toBe(0);
    expect(parseClientCredits({ count: 1, data: [{ report_code: "report_usa", limit: 3 }] })).toBe(null);
    expect(parseClientCredits({})).toBe(null);
    expect(parseCreditsFromText("Pieejamie kredīti: 4")).toBe(4);
    expect(parseCreditsFromText("nav")).toBe(null);
  });

  it("pirkuma lēmums: nopirkts / jau pirkts / nav kredītu -> nepērk", () => {
    expect(decidePurchase({ bought: true, alreadyPurchased: false, credits: 5 }).action).toBe("download");
    expect(decidePurchase({ bought: false, alreadyPurchased: true, credits: 5 }).action).toBe("wait_existing");
    expect(decidePurchase({ bought: false, alreadyPurchased: false, credits: 0 })).toEqual({ action: "stop", reason: "insufficient_credits" });
    expect(decidePurchase({ bought: false, alreadyPurchased: false, credits: null })).toEqual({ action: "stop", reason: "balance_unknown" });
    expect(decidePurchase({ bought: false, alreadyPurchased: false, credits: 1 }).action).toBe("purchase");
  });

  it("pirkuma lapa: Turnstile / gaida / nav kredītu izvēles / neskaidra poga -> neko nespiež", () => {
    expect(analyzePurchasePage({ pending: true, turnstile: true }, VIN).step).toBe("turnstile");
    expect(analyzePurchasePage({ pending: true }, VIN).step).toBe("pending");
    expect(analyzePurchasePage({ creditOption: { present: false }, payButtons: ["Maksāt"] }, VIN).step).toBe("no_credit_option");
    expect(analyzePurchasePage({ vinOnPage: "WBA5R1C0XLFH42873", creditOption: { present: true } }, VIN).step).toBe("vin_mismatch");
    expect(analyzePurchasePage({ creditOption: { present: true }, payButtons: ["Maksāt", "Pirkt paku"] }, VIN)).toEqual({ step: "ready", payLabel: "Maksāt" });
    expect(analyzePurchasePage({ creditOption: { present: true }, payButtons: ["Maksāt", "Iegādāties"] }, VIN).step).toBe("pay_button_unclear");
    expect(analyzePurchasePage({ creditOption: { present: true }, payButtons: ["Maksāt ar karti"] }, VIN).step).toBe("pay_button_unclear");
    expect(analyzePurchasePage({ creditOption: { present: true, disabled: true }, payButtons: ["Maksāt"] }, VIN).step).toBe("credit_disabled");
  });

  it("kredītu apmaksā kopsumma ir 0 - redzama nauda aptur pirkumu", () => {
    expect(totalLooksLikeCredit("0,00 €")).toBe(true);
    expect(totalLooksLikeCredit("1 kredīts")).toBe(true);
    expect(totalLooksLikeCredit("")).toBe(true);
    expect(totalLooksLikeCredit("Kopā: 14,99 €")).toBe(false);
    expect(totalLooksLikeCredit("EUR 9.99")).toBe(false);
  });

  it("PDF saite: tikai autodna domēni, bez paraugiem / noteikumiem", () => {
    expect(pickPdfHref([{ href: "https://evil.example/download/" + VIN + ".pdf" }], VIN)).toBe("");
    expect(pickPdfHref([{ href: "/atskaites-piemeri/sample.pdf" }], VIN)).toBe("");
    expect(pickPdfHref([{ href: "/download?file=terms_and_conditions" }], VIN)).toBe("");
    expect(pickPdfHref([{ href: "/report/abc" }, { href: "/report/download/abc?vin=" + VIN, text: "Lejupielādēt PDF" }], VIN)).toBe(
      "https://www.autodna.lv/report/download/abc?vin=" + VIN,
    );
    const rows = parseHistoryRows([{ text: `2026-11-05 ${VIN} Audi A4`, links: [{ href: "/report/1" }] }, { text: "nav VIN" }]);
    expect(rows).toEqual([{ vin: VIN, date: "2026-11-05", links: [{ href: "/report/1" }] }]);
  });

  it("žurnālā nav e-pasta (arī URL kodēta), paroles, tokena", () => {
    const out = redact("email=nils%40example.com&password=Slepena123 nils@example.com Bearer abcdefghijklmnop", ["Slepena123", "nils@example.com"]);
    expect(out).not.toContain("example.com");
    expect(out).not.toContain("Slepena123");
    expect(out).not.toContain("abcdefghijklmnop");
  });

  it("PDF pārbaude pēc paraksta", () => {
    expect(isPdfBase64(PDF_B64)).toBe(true);
    expect(isPdfBase64(Buffer.from("<html>").toString("base64"))).toBe(false);
  });
});

function fakeBrowser(opts: { credits: number | null; bought?: boolean; session?: string; sessionCode?: string; purchase?: { ok: boolean; clicked: boolean; code?: string }; pdfOk?: boolean }) {
  const calls: string[] = [];
  let bought = Boolean(opts.bought);
  let credits = opts.credits;
  return {
    calls,
    async peekSession() {
      calls.push("peek");
      return { state: opts.session ?? "active" };
    },
    async ensureSession() {
      calls.push("ensure");
      return { state: opts.session ?? "active", ...(opts.sessionCode ? { code: opts.sessionCode } : {}) };
    },
    async account(vin = "") {
      calls.push(`account:${vin}`);
      return { credits, bought: vin ? bought : false };
    },
    async listReports() {
      return [];
    },
    async probe() {
      return { decision: { step: "ready" } };
    },
    async purchase(vin: string) {
      calls.push(`purchase:${vin}`);
      const out = opts.purchase ?? { ok: true, clicked: true };
      if (out.ok) {
        bought = true;
        credits = (credits ?? 0) - 1;
      }
      return out;
    },
    async downloadPdf(vin: string) {
      calls.push(`pdf:${vin}`);
      if (opts.pdfOk === false || !bought) return { ok: false, code: "not_in_history" };
      return { ok: true, base64: PDF_B64, size: 20 };
    },
  };
}

function makeCore(browser: ReturnType<typeof fakeBrowser>, stateFile = "") {
  const events: Record<string, unknown>[] = [];
  const core = createRelayCore({
    browser,
    notify: async (b: Record<string, unknown>) => {
      events.push(b);
    },
    stateFile,
    now: () => new Date("2026-11-24T12:00:00Z"),
    sleep: async () => undefined,
    reportWaitMs: 0,
  });
  return { core, events };
}

const jobStates = (events: Record<string, unknown>[]) => events.filter((e) => e.kind === "job").map((e) => e.state);

describe("AutoDNA relejs: pirkuma rinda", () => {
  it("ja AutoDNA saka, ka VIN jau nopirkts - lejupielādē, NEPĒRK", async () => {
    const b = fakeBrowser({ credits: 3, bought: true });
    const { core, events } = makeCore(b);
    core.enqueue({ ref: "sess_123456", vin: VIN, kind: "purchase" });
    await core.tick();
    expect(b.calls.some((c) => c.startsWith("purchase"))).toBe(false);
    const result = events.find((e) => e.state === "result");
    expect(result).toMatchObject({ existing: true });
    expect(result).not.toHaveProperty("pdfBase64");
    const pdf = await core.readPdf(String(result?.jobId));
    expect(pdf?.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("nav kredītu -> insufficient_credits, pirkums netiek spiests", async () => {
    const b = fakeBrowser({ credits: 0 });
    const { core, events } = makeCore(b);
    core.enqueue({ ref: "sess_123456", vin: VIN, kind: "purchase" });
    await core.tick();
    expect(b.calls.some((c) => c.startsWith("purchase"))).toBe(false);
    expect(events.find((e) => e.state === "error")).toMatchObject({ code: "insufficient_credits" });
  });

  it("atlikums nav nolasīts -> nepērk", async () => {
    const b = fakeBrowser({ credits: null });
    const { core, events } = makeCore(b);
    core.enqueue({ ref: "sess_123456", vin: VIN, kind: "purchase" });
    await core.tick();
    expect(b.calls.some((c) => c.startsWith("purchase"))).toBe(false);
    expect(events.find((e) => e.state === "error")).toMatchObject({ code: "balance_unknown" });
  });

  it("pērk ar 1 kredītu, lejupielādē PDF, atdod jauno atlikumu", async () => {
    const b = fakeBrowser({ credits: 4 });
    const { core, events } = makeCore(b);
    core.enqueue({ ref: "sess_123456", vin: VIN, kind: "purchase" });
    await core.tick();
    expect(b.calls.filter((c) => c.startsWith("purchase"))).toEqual([`purchase:${VIN}`]);
    expect(jobStates(events)).toEqual(["checking", "purchasing", "waiting_report", "downloading", "result"]);
    expect(events.find((e) => e.state === "result")).toMatchObject({ existing: false, credits: 3 });
    expect((core.purchasedVins() as Record<string, unknown>)[VIN]).toBeTruthy();
  });

  it("dubultklikšķis: tas pats VIN rindā -> tas pats uzdevums", () => {
    const { core } = makeCore(fakeBrowser({ credits: 4 }));
    const a = core.enqueue({ ref: "sess_123456", vin: VIN, kind: "purchase", requestId: "r-1" });
    const b2 = core.enqueue({ ref: "sess_123456", vin: VIN, kind: "purchase", requestId: "r-2" });
    expect(b2.jobId).toBe(a.jobId);
    expect(b2.duplicate).toBe(true);
  });

  it("VIN reģistrs pārdzīvo restartu: otrreiz tas pats VIN netiek pirkts", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dna-relay-"));
    const stateFile = path.join(dir, "state.json");
    const first = makeCore(fakeBrowser({ credits: 4, purchase: { ok: false, clicked: true, code: "purchase_unconfirmed" } }), stateFile);
    first.core.enqueue({ ref: "sess_123456", vin: VIN, kind: "purchase" });
    await first.core.tick();
    const b2 = fakeBrowser({ credits: 4 });
    const second = makeCore(b2, stateFile);
    await second.core.load();
    second.core.enqueue({ ref: "sess_999999", vin: VIN, kind: "purchase" });
    await second.core.tick();
    expect(b2.calls.some((c) => c.startsWith("purchase"))).toBe(false);
    expect(second.events.find((e) => e.state === "error")).toMatchObject({ code: "already_purchased" });
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("Turnstile / sausais režīms (nekas nenospiests) -> VIN reģistrā nepaliek, var mēģināt vēlreiz", async () => {
    for (const code of ["turnstile", "dry_run"]) {
      const b = fakeBrowser({ credits: 2, purchase: { ok: false, clicked: false, code } });
      const { core, events } = makeCore(b);
      core.enqueue({ ref: "sess_123456", vin: VIN, kind: "purchase" });
      await core.tick();
      expect((core.purchasedVins() as Record<string, unknown>)[VIN]).toBeUndefined();
      expect(events.find((e) => e.state === "error")).toMatchObject({ code });
    }
  });

  it("`report` uzdevums nekad nepērk, arī ja atskaites nav", async () => {
    const b = fakeBrowser({ credits: 9 });
    const { core, events } = makeCore(b);
    core.enqueue({ ref: "sess_123456", vin: VIN, kind: "report" });
    await core.tick();
    expect(b.calls.some((c) => c.startsWith("purchase"))).toBe(false);
    expect(events.find((e) => e.state === "error")).toMatchObject({ code: "not_found" });
  });

  it("nepareiza parole -> uzdevums kļūda bad_credentials + viens sesijas notikums, nepērk", async () => {
    const b = fakeBrowser({ credits: 9, session: "needs_human", sessionCode: "bad_credentials" });
    const { core, events } = makeCore(b);
    core.enqueue({ ref: "sess_123456", vin: VIN, kind: "purchase" });
    await core.tick();
    core.enqueue({ ref: "sess_123457", vin: "WBA5R1C0XLFH42873", kind: "purchase" });
    await core.tick();
    expect(events.filter((e) => e.kind === "session")).toHaveLength(1);
    expect(events.find((e) => e.state === "error")).toMatchObject({ code: "bad_credentials" });
    expect(b.calls.some((c) => c.startsWith("purchase") || c.startsWith("account"))).toBe(false);
  });

  it("nederīgs VIN vai uzdevuma veids tiek atteikts", () => {
    const { core } = makeCore(fakeBrowser({ credits: 1 }));
    expect(() => core.enqueue({ ref: "sess_123456", vin: "ABC", kind: "purchase" })).toThrow();
    expect(() => core.enqueue({ ref: "sess_123456", vin: VIN, kind: "buy_all" })).toThrow();
  });
});

describe("AutoDNA relejs: serveris", () => {
  it("pirkums bez confirm:true -> 403; pakas / bankas / nebruņots /payment bloķēti; parole netiek logota", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "relay/provin-autodna/server.mjs"), "utf8");
    expect(src).toMatch(/kind === "purchase" && body\.confirm !== true\) return sendJson\(res, 403/);
    expect(src).toMatch(/isForbiddenPath\(u\.pathname\)/);
    expect(src).toMatch(/isPaymentPath\(u\.pathname\) && !browser\?\.paymentArmed\(\)/);
    expect(src).toMatch(/AUTODNA_PURCHASE_LIVE/);
    expect(src).not.toMatch(/console\.log\([^)]*PASSWORD/);
    // Partnera API (pauzē) relejs neaiztiek.
    expect(src).not.toMatch(/process\.env\.AUTODNA_API_KEY|process\.env\.AUTODNA_EMAIL\b|api(-sandbox)?\.autodna/);
  });

  it("pirkuma poga tiek spiesta tikai ar purchaseLive (sausais režīms pēc noklusējuma)", () => {
    const flow = fs.readFileSync(path.join(process.cwd(), "relay/provin-autodna/lib/dna-flow.mjs"), "utf8");
    const dry = flow.indexOf("if (!purchaseLive)");
    const click = flow.indexOf("await btn.click(");
    expect(dry).toBeGreaterThan(0);
    expect(click).toBeGreaterThan(dry);
    expect(flow).toMatch(/purchaseLive = false/);
  });
});
