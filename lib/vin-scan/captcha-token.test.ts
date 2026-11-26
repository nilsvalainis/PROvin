import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const vinHttpFetch = vi.fn();
vi.mock("@/lib/vin-sources/http", () => ({
  VIN_HTTP_UA: "Mozilla/5.0 test-ua",
  vinHttpFetch: (...args: unknown[]) => vinHttpFetch(...args),
}));

const FIXIE = "http://fixie:secret@group.usefixie.com:80";
const solveCaptcha = vi.fn();
vi.mock("@/lib/captcha-solver", () => ({
  CAPSOLVER_PROXIED_TIMEOUT_MS: 120_000,
  CAPSOLVER_PROXYLESS_TIMEOUT_MS: 90_000,
  hasCaptchaSolverKey: () => true,
  getCaptchaSolverProxy: () => FIXIE,
  httpProxyUrlFromCapsolver: () => FIXIE,
  vinStickyHttpProxyUrl: () => FIXIE,
  solveCaptcha: (...args: unknown[]) => solveCaptcha(...args),
}));

import { runWithVinScanDeadline, scanFetchSmart, vinScanSolverBudgetMs } from "@/lib/vin-scan/http";
import { emptyVinScanPlates } from "@/lib/vin-scan/plates";
import { probeCarpass, probeNummerplade } from "@/lib/vin-scan/probes";
import { fetchLkfHttp } from "@/lib/vin-sources/lkf-http";

const VIN = "WBA5R1C0XLFH42873";
const SITE_KEY = "6LcTestSiteKey000000000000000000000000";
const RECAPTCHA_HTML = `<html><head><title>nummerplade.net</title>
<script src="https://www.google.com/recaptcha/api.js"></script></head><body>
<form action="/stelnummer/${VIN.toLowerCase()}.html" method="post">
<p>Stelnummer ${VIN} - bekræft at du ikke er en robot (nummerplade)</p>
<div class="g-recaptcha" data-sitekey="${SITE_KEY}"></div>
</form></body></html>`;
const TURNSTILE_HTML = `<html><body><div data-sitekey="0x4AAAAAAATestKey" class="cf-turnstile"></div>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script></body></html>`;
const CF_CHALLENGE_HTML = `<!DOCTYPE html><html lang="en-US"><head><title>Just a moment...</title></head><body>
<div id="challenge-error-text">Enable JavaScript and cookies to continue</div>
<script>window._cf_chl_opt={cType:'managed'};a.src='/cdn-cgi/challenge-platform/h/b/orchestrate/chl_page/v1';</script>
</body></html>`;
const LKF_FORM_HTML = `<html><body><form>
<input type="hidden" name="form_build_id" value="form-abc" />
<input type="hidden" name="form_id" value="history_traffic_accidents_form" />
<input type="hidden" name="captcha_sid" value="11" />
<input type="hidden" name="captcha_token" value="tok11" />
</form></body></html>`;

function page(text: string, status = 200, cookie = "") {
  return { status, text, cookie, finalUrl: "https://example.test/" };
}

function ctx() {
  return { vin: VIN, plates: emptyVinScanPlates(), listingUrl: "" };
}

function solvedOk(token = "tok-123") {
  return { ok: true, token, cookies: {}, userAgent: "Mozilla/5.0 solver" };
}

beforeEach(() => {
  vi.stubEnv("NUMMERPLADE_API_KEY", "");
});

afterEach(() => {
  vinHttpFetch.mockReset();
  solveCaptcha.mockReset();
  vi.unstubAllEnvs();
});

describe("scanFetchSmart - reCAPTCHA/Turnstile tikai pēc pieprasījuma", () => {
  it("reCAPTCHA lapa bez opt-in: CapSolver netiek saukts, captchaReason ir aizpildīts", async () => {
    vinHttpFetch.mockResolvedValueOnce(page(RECAPTCHA_HTML));
    const res = await scanFetchSmart("https://example.test/x", { sourceLabel: "test" });
    expect(solveCaptcha).not.toHaveBeenCalled();
    expect(res.captchaToken).toBeUndefined();
    expect(res.captchaReason).toMatch(/reCAPTCHA/);
    expect(res.text).toBe(RECAPTCHA_HTML);
  });

  it("Turnstile lapa bez opt-in: CapSolver netiek saukts", async () => {
    vinHttpFetch.mockResolvedValueOnce(page(TURNSTILE_HTML));
    const res = await scanFetchSmart("https://example.test/x");
    expect(solveCaptcha).not.toHaveBeenCalled();
    expect(res.captchaReason).toMatch(/Turnstile/);
  });

  it("ar captcha: 'solve' risina vienreiz un atgriež žetonu", async () => {
    vinHttpFetch.mockResolvedValueOnce(page(RECAPTCHA_HTML));
    solveCaptcha.mockResolvedValueOnce(solvedOk("tok-xyz"));
    const res = await scanFetchSmart("https://example.test/x?vin=1", {
      captcha: "solve",
      solveUrl: "https://example.test/",
      timeoutMs: 45_000,
    });
    expect(solveCaptcha).toHaveBeenCalledTimes(1);
    const task = solveCaptcha.mock.calls[0]?.[0] as { kind: string; websiteKey: string; websiteURL: string };
    expect(task.kind).toBe("recaptcha_v2");
    expect(task.websiteKey).toBe(SITE_KEY);
    expect(task.websiteURL).toBe("https://example.test/");
    expect(res.captchaToken).toBe("tok-xyz");
    expect(res.captchaKind).toBe("recaptcha_v2");
    expect(res.captchaReason).toBeUndefined();
    expect(res.ua).toBe("Mozilla/5.0 solver");
  });

  it("ar opt-in, bet neizdevies risinājums: nav žetona, ir iemesls", async () => {
    vinHttpFetch.mockResolvedValueOnce(page(RECAPTCHA_HTML));
    solveCaptcha.mockResolvedValueOnce({ ok: false, reason: "CapSolver: timeout" });
    const res = await scanFetchSmart("https://example.test/x", { captcha: "solve", timeoutMs: 45_000 });
    expect(solveCaptcha).toHaveBeenCalledTimes(1);
    expect(res.captchaToken).toBeUndefined();
    expect(res.captchaReason).toMatch(/CapSolver: timeout/);
  });

  it("parasta lapa: nekas netiek risināts un nav captcha iemesla", async () => {
    vinHttpFetch.mockResolvedValueOnce(page("<html><body>ok</body></html>"));
    const res = await scanFetchSmart("https://example.test/x", { captcha: "solve" });
    expect(solveCaptcha).not.toHaveBeenCalled();
    expect(res.captchaReason).toBeUndefined();
    expect(res.captchaToken).toBeUndefined();
  });

  it("Cloudflare challenge joprojām tiek risināts un pieprasījums atkārtots ar cf_clearance", async () => {
    vinHttpFetch
      .mockResolvedValueOnce(page(CF_CHALLENGE_HTML, 403))
      .mockResolvedValueOnce(page("<html><body>dati</body></html>", 200, "x=1"));
    solveCaptcha.mockResolvedValueOnce({ ok: true, token: "", cookies: { cf_clearance: "cf1" }, userAgent: "UA-cf" });
    const res = await scanFetchSmart("https://example.test/x", { timeoutMs: 45_000 });
    expect(solveCaptcha).toHaveBeenCalledTimes(1);
    expect((solveCaptcha.mock.calls[0]?.[0] as { kind: string }).kind).toBe("cloudflare_challenge");
    expect(vinHttpFetch).toHaveBeenCalledTimes(2);
    const retryInit = vinHttpFetch.mock.calls[1]?.[1] as { cookie: string };
    expect(retryInit.cookie).toContain("cf_clearance=cf1");
    expect(res.status).toBe(200);
    expect(res.challengeReason).toBeUndefined();
  });
});

describe("zondes ar captcha lapu", () => {
  it("nummerplade: captcha lapa -> 0 CapSolver izsaukumu un unknown", async () => {
    vinHttpFetch.mockImplementation(async (url: string) => {
      if (url.includes("/api/v1/")) return page("", 403);
      return page(RECAPTCHA_HTML);
    });
    const row = await probeNummerplade(ctx());
    expect(solveCaptcha).not.toHaveBeenCalled();
    expect(row.status).toBe("unknown");
    expect(row.summary).toMatch(/nummerplade\.net: .*reCAPTCHA/);
  });

  it("Car-Pass: captcha lapa bez CSRF -> 0 CapSolver izsaukumu un unknown", async () => {
    vinHttpFetch.mockResolvedValueOnce(page(RECAPTCHA_HTML));
    const row = await probeCarpass(ctx());
    expect(solveCaptcha).not.toHaveBeenCalled();
    expect(row.status).toBe("unknown");
    expect(row.summary).toMatch(/Car-Pass: .*reCAPTCHA/);
  });
});

describe("lkf.ee CapSolver budžets", () => {
  function lkfMocks() {
    vinHttpFetch
      .mockResolvedValueOnce(page(LKF_FORM_HTML))
      .mockResolvedValueOnce(page(`[{"command":"insert","data":"<div>Kahjusid ei leitud</div>"}]`));
  }

  it("VIN SCAN termiņā ar 5 s atlikumu CapSolver nesāk", async () => {
    lkfMocks();
    const res = await runWithVinScanDeadline(Date.now() + 5_000, () => fetchLkfHttp(VIN));
    expect(solveCaptcha).not.toHaveBeenCalled();
    expect(vinHttpFetch).toHaveBeenCalledTimes(1);
    expect(res.found).toBe(false);
    expect(res.message).toMatch(/CapSolver izlaists/);
  });

  it("VIN SCAN termiņā ar 60 s atlikumu timeout <= 52 s", async () => {
    lkfMocks();
    solveCaptcha.mockResolvedValueOnce(solvedOk("lkf-tok"));
    await runWithVinScanDeadline(Date.now() + 60_000, () => fetchLkfHttp(VIN));
    expect(solveCaptcha).toHaveBeenCalledTimes(1);
    const opts = solveCaptcha.mock.calls[0]?.[1] as { timeoutMs: number };
    expect(opts.timeoutMs).toBeLessThanOrEqual(52_000);
    expect(opts.timeoutMs).toBeGreaterThan(40_000);
    const postInit = vinHttpFetch.mock.calls[1]?.[1] as { body: string };
    expect(new URLSearchParams(postInit.body).get("g-recaptcha-response")).toBe("lkf-tok");
  });

  it("ārpus VIN SCAN (apmaksāts pasūtījums) paliek vecais timeout", async () => {
    lkfMocks();
    solveCaptcha.mockResolvedValueOnce(solvedOk("lkf-tok"));
    await fetchLkfHttp(VIN);
    expect(solveCaptcha).toHaveBeenCalledTimes(1);
    const opts = solveCaptcha.mock.calls[0]?.[1] as { timeoutMs: number };
    expect(opts.timeoutMs).toBe(120_000);
  });

  it("vinScanSolverBudgetMs: ārpus termiņa atgriež fallback, iekšā atlikumu mīnus rezervi", async () => {
    expect(vinScanSolverBudgetMs(77_000)).toBe(77_000);
    const now = Date.now();
    const inside = await runWithVinScanDeadline(now + 30_000, async () => vinScanSolverBudgetMs(77_000, now));
    expect(inside).toBe(22_000);
  });
});
