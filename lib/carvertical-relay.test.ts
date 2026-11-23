import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  classifyAuthPage,
  decidePurchase,
  findReportForVin,
  isAllowedHost,
  isForbiddenPath,
  isPdfBase64,
  normalizeLoginCode,
  parseCreditsFromText,
  parseQuotas,
  parseReportsList,
  pickCreditUseHref,
  redact,
} from "@/relay/provin-carvertical/lib/cv-page.mjs";
import { createRelayCore } from "@/relay/provin-carvertical/lib/relay-core.mjs";

const VIN = "WVWZZZ1JZXW000001";
const VIN2 = "WBA5R1C0XLFH42873";
const PDF_B64 = Buffer.from("%PDF-1.7\n% anonimizēts\n").toString("base64");

describe("CarVertical relejs: lapu atpazīšana", () => {
  it("navigācija tikai uz carvertical.com; checkout / pricing / billing aizliegti", () => {
    expect(isAllowedHost("www.carvertical.com")).toBe(true);
    expect(isAllowedHost("carvertical.com")).toBe(true);
    expect(isAllowedHost("accounts.google.com")).toBe(false);
    expect(isAllowedHost("carvertical.com.evil.example")).toBe(false);
    expect(isForbiddenPath("/lv/checkout")).toBe(true);
    expect(isForbiddenPath("/lv/precheck/pricing")).toBe(true);
    expect(isForbiddenPath("/lv/user/billing/payment-cards")).toBe(true);
    expect(isForbiddenPath("/lv/user/reports")).toBe(false);
    expect(isForbiddenPath("/lv/precheck/searching")).toBe(false);
  });

  it("atpazīst dzīvi redzētās pieteikšanās lapas (23.11.2026)", () => {
    expect(classifyAuthPage({ url: "https://www.carvertical.com/lv/auth", hasPasswordInput: true })).toBe("login_form");
    expect(
      classifyAuthPage({
        url: "https://www.carvertical.com/lv/auth/code",
        text: "Tavs pierakstīšanās kods ir nosūtīts. Mēs uz e-pastu *** nosūtījām 6 rakstzīmju garu kodu.",
        hasCodeInput: true,
      }),
    ).toBe("code");
    expect(classifyAuthPage({ url: "https://www.carvertical.com/lv/user/reports" })).toBe("logged_in");
    expect(classifyAuthPage({ url: "https://www.carvertical.com/lv/auth", captchaChallenge: true })).toBe("captcha");
    expect(classifyAuthPage({ url: "https://www.carvertical.com/lv/auth", text: "Nepareiza parole", hasPasswordInput: true })).toBe(
      "bad_credentials",
    );
  });

  it("e-pasta kods: tikai 6 burti/cipari", () => {
    expect(normalizeLoginCode(" ab12 cd ")).toBe("AB12CD");
    expect(normalizeLoginCode("12345")).toBe("");
    expect(normalizeLoginCode("1234567")).toBe("");
  });

  it("kredītu atlikums no /user/quotas un rezerve no teksta", () => {
    expect(parseQuotas({ quotas: { "123": 7 } }, "123")).toBe(7);
    expect(parseQuotas({ quotas: { "123": 0 } }, null)).toBe(0);
    expect(parseQuotas({ quotas: { "1": 2, "2": 3 } }, null)).toBe(null);
    expect(parseQuotas({}, "1")).toBe(null);
    expect(parseCreditsFromText("Pieejamās atskaites: 4")).toBe(4);
    expect(parseCreditsFromText("Tev ir 12 kredīti")).toBe(12);
    expect(parseCreditsFromText("Nav datu")).toBe(null);
  });

  it("atskaišu saraksts: tikai id, VIN, statuss, datumi; beigusies netiek ņemta", () => {
    const list = parseReportsList({
      results: [
        { id: "a1", vin: VIN, reportStatus: 30, createdAt: "2026-10-01T10:00:00Z", expiresAt: "2026-12-31", createdByUsername: "x@y.lv" },
        { id: "a2", vin: VIN, reportStatus: 30, createdAt: "2026-11-01T10:00:00Z", expiresAt: "2026-12-31" },
        { id: "old", vin: VIN2, reportStatus: 30, createdAt: "2025-01-01", expiresAt: "2025-06-01" },
        { id: "bad", vin: "123" },
      ],
      count: 4,
    });
    expect(list.map((r) => r.id)).toEqual(["a1", "a2", "old"]);
    expect(JSON.stringify(list)).not.toContain("@");
    const now = new Date("2026-11-23T12:00:00Z");
    expect(findReportForVin(list, VIN, now)?.id).toBe("a2");
    expect(findReportForVin(list, VIN2, now)).toBe(null);
  });

  it("pirkuma lēmums: esoša atskaite / jau pirkts / nav kredītu -> nepērk", () => {
    const report = { id: "a", vin: VIN, status: 30, createdAt: "", finishedAt: "", expiresAt: "" };
    expect(decidePurchase({ existing: report, alreadyPurchased: false, credits: 5 }).action).toBe("download");
    expect(decidePurchase({ existing: null, alreadyPurchased: true, credits: 5 }).action).toBe("wait_existing");
    expect(decidePurchase({ existing: null, alreadyPurchased: false, credits: 0 })).toEqual({ action: "stop", reason: "insufficient_credits" });
    expect(decidePurchase({ existing: null, alreadyPurchased: false, credits: null })).toEqual({ action: "stop", reason: "balance_unknown" });
    expect(decidePurchase({ existing: null, alreadyPurchased: false, credits: 1 }).action).toBe("purchase");
  });

  it("kredīta saite: tikai uz atskaiti ar šo VIN, nekad uz checkout / pricing", () => {
    expect(pickCreditUseHref([{ href: "/lv/checkout?vin=" + VIN }, { href: "/lv/precheck/pricing?vin=" + VIN }], VIN)).toBe("");
    expect(pickCreditUseHref([{ href: "https://evil.example/lv/report?vin=" + VIN }], VIN)).toBe("");
    expect(pickCreditUseHref([{ href: "/lv/report?vin=" + VIN2 }], VIN)).toBe("");
    expect(pickCreditUseHref([{ href: "/lv/report?vin=" + VIN, analytics: "buyNow" }], VIN)).toBe("");
    expect(pickCreditUseHref([{ href: "/lv/report?vin=" + VIN, analytics: "useOneReport" }], VIN)).toBe(
      "https://www.carvertical.com/lv/report?vin=" + VIN,
    );
    expect(pickCreditUseHref([{ href: "/lv/atskaite?encryptedVin=abc" }], VIN)).toBe("https://www.carvertical.com/lv/atskaite?encryptedVin=abc");
  });

  it("žurnālā nav e-pasta, paroles, tokena", () => {
    const out = redact("login nils@example.com parole Slepena123 Bearer abcdefghijklmnop", ["Slepena123"]);
    expect(out).not.toContain("nils@example.com");
    expect(out).not.toContain("Slepena123");
    expect(out).not.toContain("abcdefghijklmnop");
  });

  it("PDF pārbaude pēc paraksta", () => {
    expect(isPdfBase64(PDF_B64)).toBe(true);
    expect(isPdfBase64(Buffer.from("<html>").toString("base64"))).toBe(false);
  });
});

type Report = { id: string; vin: string; status: number; createdAt: string; finishedAt: string; expiresAt: string };

function fakeBrowser(opts: { credits: number | null; reports?: Report[]; session?: string; purchaseOk?: boolean; purchaseClicked?: boolean }) {
  const calls: string[] = [];
  let reports = [...(opts.reports ?? [])];
  let credits = opts.credits;
  const browser = {
    calls,
    async peekSession() {
      calls.push("peek");
      return { state: opts.session ?? "active" };
    },
    async ensureSession() {
      calls.push("ensure");
      return opts.session === "awaiting_code" ? { state: "awaiting_code", codeRequestedAt: "t1" } : { state: opts.session ?? "active" };
    },
    async submitCode() {
      return { state: "active" };
    },
    async account() {
      calls.push("account");
      return { credits, reports, listRead: true };
    },
    async purchase(vin: string) {
      calls.push(`purchase:${vin}`);
      if (opts.purchaseOk === false) return { ok: false, clicked: opts.purchaseClicked === true, code: "no_credit_link" };
      reports = [...reports, { id: "new1", vin, status: 30, createdAt: "2026-11-23T12:00:00Z", finishedAt: "", expiresAt: "" }];
      credits = (credits ?? 0) - 1;
      return { ok: true, clicked: true, reportId: "new1" };
    },
    async downloadPdf(id: string) {
      calls.push(`pdf:${id}`);
      return { ok: true, base64: PDF_B64, size: 20 };
    },
  };
  return browser;
}

function makeCore(browser: ReturnType<typeof fakeBrowser>, stateFile = "") {
  const events: Record<string, unknown>[] = [];
  const core = createRelayCore({
    browser,
    notify: async (b: Record<string, unknown>) => {
      events.push(b);
    },
    stateFile,
    now: () => new Date("2026-11-23T12:00:00Z"),
    sleep: async () => undefined,
    reportWaitMs: 0,
  });
  return { core, events };
}

const jobStates = (events: Record<string, unknown>[]) => events.filter((e) => e.kind === "job").map((e) => e.state);

describe("CarVertical relejs: pirkuma rinda", () => {
  it("ja kontā šim VIN jau ir atskaite - lejupielādē, NEPĒRK", async () => {
    const b = fakeBrowser({ credits: 3, reports: [{ id: "r1", vin: VIN, status: 30, createdAt: "2026-11-01", finishedAt: "", expiresAt: "" }] });
    const { core, events } = makeCore(b);
    core.enqueue({ ref: "sess_123456", vin: VIN, kind: "purchase" });
    await core.tick();
    expect(b.calls.some((c) => c.startsWith("purchase"))).toBe(false);
    const result = events.find((e) => e.state === "result");
    expect(result).toMatchObject({ existing: true, reportId: "r1" });
    expect(result).not.toHaveProperty("pdfBase64");
    const pdf = await core.readPdf(String(result?.jobId));
    expect(pdf?.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("nav kredītu -> kļūda insufficient_credits, pirkums netiek spiests", async () => {
    const b = fakeBrowser({ credits: 0 });
    const { core, events } = makeCore(b);
    core.enqueue({ ref: "sess_123456", vin: VIN, kind: "purchase" });
    await core.tick();
    expect(b.calls.some((c) => c.startsWith("purchase"))).toBe(false);
    expect(events.find((e) => e.state === "error")).toMatchObject({ code: "insufficient_credits" });
  });

  it("pērk vienu kredītu, sagaida atskaiti, atdod PDF un jauno atlikumu", async () => {
    const b = fakeBrowser({ credits: 4 });
    const { core, events } = makeCore(b);
    core.enqueue({ ref: "sess_123456", vin: VIN, kind: "purchase" });
    await core.tick();
    expect(b.calls.filter((c) => c.startsWith("purchase"))).toEqual([`purchase:${VIN}`]);
    expect(jobStates(events)).toEqual(["checking", "purchasing", "waiting_report", "downloading", "result"]);
    expect(events.find((e) => e.state === "result")).toMatchObject({ existing: false, reportId: "new1", credits: 3 });
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
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cv-relay-"));
    const stateFile = path.join(dir, "state.json");
    const b1 = fakeBrowser({ credits: 4 });
    const first = makeCore(b1, stateFile);
    first.core.enqueue({ ref: "sess_123456", vin: VIN, kind: "purchase" });
    await first.core.tick();
    // Jauns process, atskaite kontā (piem. izdzēsta / nav redzama) - otrreiz NEPĒRK.
    const b2 = fakeBrowser({ credits: 3, reports: [] });
    const second = makeCore(b2, stateFile);
    await second.core.load();
    second.core.enqueue({ ref: "sess_999999", vin: VIN, kind: "purchase" });
    await second.core.tick();
    expect(b2.calls.some((c) => c.startsWith("purchase"))).toBe(false);
    expect(second.events.find((e) => e.state === "error")).toMatchObject({ code: "already_purchased" });
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("ja kredīta saite netika nospiesta, VIN reģistrā nepaliek; ja nospiesta - paliek", async () => {
    const notClicked = fakeBrowser({ credits: 2, purchaseOk: false, purchaseClicked: false });
    const a = makeCore(notClicked);
    a.core.enqueue({ ref: "sess_123456", vin: VIN, kind: "purchase" });
    await a.core.tick();
    expect((a.core.purchasedVins() as Record<string, unknown>)[VIN]).toBeUndefined();

    const clicked = fakeBrowser({ credits: 2, purchaseOk: false, purchaseClicked: true });
    const c = makeCore(clicked);
    c.core.enqueue({ ref: "sess_123456", vin: VIN, kind: "purchase" });
    await c.core.tick();
    expect((c.core.purchasedVins() as Record<string, unknown>)[VIN]).toBeTruthy();
  });

  it("`report` uzdevums nekad nepērk, arī ja atskaites nav", async () => {
    const b = fakeBrowser({ credits: 9 });
    const { core, events } = makeCore(b);
    core.enqueue({ ref: "sess_123456", vin: VIN, kind: "report" });
    await core.tick();
    expect(b.calls.some((c) => c.startsWith("purchase"))).toBe(false);
    expect(events.find((e) => e.state === "error")).toMatchObject({ code: "not_found" });
  });

  it("bez sesijas: uzdevums gaida kodu (viens paziņojums par kodu), nepērk", async () => {
    const b = fakeBrowser({ credits: 9, session: "awaiting_code" });
    const { core, events } = makeCore(b);
    core.enqueue({ ref: "sess_123456", vin: VIN, kind: "purchase" });
    await core.tick();
    await core.tick();
    expect(events.filter((e) => e.kind === "session" && e.state === "awaiting_code")).toHaveLength(1);
    expect(jobStates(events)).toEqual(["awaiting_login"]);
    expect(b.calls.some((c) => c.startsWith("purchase") || c === "account")).toBe(false);
  });

  it("nederīgs VIN vai uzdevuma veids tiek atteikts", () => {
    const { core } = makeCore(fakeBrowser({ credits: 1 }));
    expect(() => core.enqueue({ ref: "sess_123456", vin: "ABC", kind: "purchase" })).toThrow();
    expect(() => core.enqueue({ ref: "sess_123456", vin: VIN, kind: "buy_all" })).toThrow();
  });
});

describe("CarVertical relejs: serveris", () => {
  it("pirkums bez confirm:true tiek atteikts (403), checkout navigācija bloķēta", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "relay/provin-carvertical/server.mjs"), "utf8");
    expect(src).toMatch(/kind === "purchase" && body\.confirm !== true\) return sendJson\(res, 403/);
    expect(src).toMatch(/isForbiddenPath\(u\.pathname\)/);
    expect(src).not.toMatch(/console\.log\([^)]*PASSWORD/);
  });
});
