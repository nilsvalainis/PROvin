import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const vinHttpFetch = vi.fn();
vi.mock("@/lib/vin-sources/http", () => ({
  VIN_HTTP_UA: "Mozilla/5.0 test-ua",
  vinHttpFetch: (...args: unknown[]) => vinHttpFetch(...args),
}));

const FIXIE = "http://fixie:secret@group.usefixie.com:80";
const solveCaptcha = vi.fn();
const mockGetCaptchaSolverProxy = vi.fn(() => FIXIE);
const mockVinStickyHttpProxyUrl = vi.fn(() => FIXIE);
vi.mock("@/lib/captcha-solver", () => ({
  hasCaptchaSolverKey: () => true,
  getCaptchaSolverProxy: () => mockGetCaptchaSolverProxy(),
  httpProxyUrlFromCapsolver: () => FIXIE,
  vinStickyHttpProxyUrl: () => mockVinStickyHttpProxyUrl(),
  solveCaptcha: (...args: unknown[]) => solveCaptcha(...args),
}));

import { scanChallengeReason, scanFetchSmart } from "@/lib/vin-scan/http";
import { parseStatVinPage } from "@/lib/vin-scan/parse-stat-vin";

const VIN = "WBA5R1C0XLFH42873";
const STAT_VIN_WAF_403 = "Access blocked, contact us at support@stat.vin A";
const LT_CHALLENGE_HTML = `<!DOCTYPE html><html lang="en-US"><head><title>Just a moment...</title></head><body>
<div id="challenge-error-text">Enable JavaScript and cookies to continue</div>
<script>window._cf_chl_opt={cType:'managed'};a.src='/cdn-cgi/challenge-platform/h/b/orchestrate/chl_page/v1';</script>
</body></html>`;
const FOUND_HTML = `<!doctype html><html><body>
  <h1>RAM 2500 2026 VIN: ${VIN}</h1>
  <p>Sale History (13) Auction Date Final Bid Copart</p>
  <p>Lot: 50558298 Damage: Front End Odometer 185389</p>
  <img src="https://cs.copart.com/v1/auth/img/lot/50558298/1.jpg">
</body></html>`;

describe("scanFetchSmart - stat.vin Cloudflare WAF", () => {
  afterEach(() => {
    vinHttpFetch.mockReset();
    solveCaptcha.mockReset();
    mockGetCaptchaSolverProxy.mockReset();
    mockGetCaptchaSolverProxy.mockReturnValue(FIXIE);
    mockVinStickyHttpProxyUrl.mockReset();
    mockVinStickyHttpProxyUrl.mockReturnValue(FIXIE);
  });

  it("403 Access blocked iet caur CapSolver AntiCloudflareTask un atgriež izsoles lapu", async () => {
    vinHttpFetch
      .mockResolvedValueOnce({
        status: 403,
        text: STAT_VIN_WAF_403,
        cookie: "",
        finalUrl: `https://stat.vin/cars/${VIN}`,
      })
      .mockResolvedValueOnce({
        status: 200,
        text: FOUND_HTML,
        cookie: "cf_clearance=abc",
        finalUrl: `https://stat.vin/cars/${VIN}`,
      });
    solveCaptcha.mockResolvedValue({
      ok: true,
      token: "cf-tok",
      cookies: { cf_clearance: "abc" },
      userAgent: "Mozilla/5.0 solver",
    });

    const page = await scanFetchSmart(`https://stat.vin/cars/${VIN}`, {
      timeoutMs: 45_000,
      solveUrl: "https://stat.vin/",
      sourceLabel: "stat_vin",
      wafBypass: true,
    });

    expect(solveCaptcha).toHaveBeenCalledTimes(1);
    const task = solveCaptcha.mock.calls[0]?.[0] as { kind: string; websiteURL: string; html?: string; proxy?: string };
    expect(task.kind).toBe("cloudflare_challenge");
    expect(task.websiteURL).toBe("https://stat.vin/");
    expect(task.html).toBeUndefined();
    expect(task.proxy).toBe(FIXIE);
    expect(page.status).toBe(200);
    expect(page.challengeReason).toBeUndefined();
    expect(scanChallengeReason(page)).toBeNull();

    const parsed = parseStatVinPage({
      status: page.status,
      html: page.text,
      vin: VIN,
      challenge: scanChallengeReason(page),
      finalUrl: page.finalUrl,
    });
    expect(parsed.status).toBe("found");
    expect(parsed.summary).toMatch(/Copart/i);
  });

  it("pēc CapSolver car-not-found ir none", async () => {
    vinHttpFetch
      .mockResolvedValueOnce({
        status: 403,
        text: STAT_VIN_WAF_403,
        cookie: "",
        finalUrl: `https://stat.vin/cars/${VIN}`,
      })
      .mockResolvedValueOnce({
        status: 200,
        text: "<html><body><h1>Car not found</h1></body></html>",
        cookie: "cf_clearance=abc",
        finalUrl: "https://stat.vin/car-not-found",
      });
    solveCaptcha.mockResolvedValue({
      ok: true,
      token: "cf-tok",
      cookies: { cf_clearance: "abc" },
      userAgent: "Mozilla/5.0 solver",
    });

    const page = await scanFetchSmart(`https://stat.vin/cars/${VIN}`, {
      solveUrl: "https://stat.vin/",
      sourceLabel: "stat_vin",
      wafBypass: true,
    });
    const parsed = parseStatVinPage({
      status: page.status,
      html: page.text,
      vin: VIN,
      challenge: scanChallengeReason(page),
      finalUrl: page.finalUrl,
    });
    expect(parsed.status).toBe("none");
    expect(parsed.summary).toBe("Nav izsoles ieraksta");
  });

  it("ja CapSolver neizdodas, paliek error ar Cloudflare iemeslu", async () => {
    vinHttpFetch.mockResolvedValueOnce({
      status: 403,
      text: STAT_VIN_WAF_403,
      cookie: "",
      finalUrl: `https://stat.vin/cars/${VIN}`,
    });
    solveCaptcha.mockResolvedValue({ ok: false, reason: "CapSolver: proxy timeout" });

    const page = await scanFetchSmart(`https://stat.vin/cars/${VIN}`, {
      solveUrl: "https://stat.vin/",
      sourceLabel: "stat_vin",
      wafBypass: true,
    });
    expect(page.status).toBe(403);
    expect(page.challengeReason).toMatch(/CapSolver/i);
    const parsed = parseStatVinPage({
      status: page.status,
      html: page.text,
      vin: VIN,
      challenge: scanChallengeReason(page),
      finalUrl: page.finalUrl,
    });
    expect(parsed.status).toBe("unknown");
    expect(parsed.summary).toMatch(/Cloudflare/i);
  });

  it("bez wafBypass īsais WAF 403 nesauc CapSolver (LT pre-#149)", async () => {
    vinHttpFetch.mockResolvedValueOnce({
      status: 403,
      text: STAT_VIN_WAF_403,
      cookie: "",
      finalUrl: "https://www.epolicija.lt/itpr_paieska/transportas_lt.php",
    });
    const page = await scanFetchSmart("https://www.epolicija.lt/itpr_paieska/transportas_lt.php?knr=1", {
      solveUrl: "https://www.epolicija.lt/itpr_paieska/transportas_lt.php",
      sourceLabel: "LT policija",
    });
    expect(solveCaptcha).not.toHaveBeenCalled();
    expect(page.challengeReason).toBeUndefined();
    expect(scanChallengeReason(page)).toBeNull();
  });

  it("Just a moment HTML iet CapSolver ar html lauku (LT managed challenge)", async () => {
    vinHttpFetch
      .mockResolvedValueOnce({
        status: 403,
        text: LT_CHALLENGE_HTML,
        cookie: "",
        finalUrl: "https://www.epolicija.lt/itpr_paieska/transportas_lt.php",
      })
      .mockResolvedValueOnce({
        status: 200,
        text: "<html><body><form><input name=\"knr\" value=\"1\"></form></body></html>",
        cookie: "cf_clearance=lt",
        finalUrl: "https://www.epolicija.lt/itpr_paieska/transportas_lt.php",
      });
    solveCaptcha.mockResolvedValue({
      ok: true,
      token: "cf-tok",
      cookies: { cf_clearance: "lt" },
      userAgent: "Mozilla/5.0 solver",
    });
    const page = await scanFetchSmart("https://www.epolicija.lt/itpr_paieska/transportas_lt.php?knr=1", {
      solveUrl: "https://www.epolicija.lt/itpr_paieska/transportas_lt.php",
      sourceLabel: "LT policija",
    });
    expect(solveCaptcha).toHaveBeenCalledTimes(1);
    const task = solveCaptcha.mock.calls[0]?.[0] as { html?: string; proxy?: string };
    expect(task.html).toContain("Just a moment");
    expect(task.html).toContain("_cf_chl_opt");
    expect(task.proxy).toBe(FIXIE);
    expect(page.status).toBe(200);
    expect(page.challengeReason).toBeUndefined();
  });

  it("bez CAPSOLVER_PROXY / FIXIE_URL nesauc CapSolver (challenge prasa proxy)", async () => {
    mockGetCaptchaSolverProxy.mockReturnValue("");
    mockVinStickyHttpProxyUrl.mockReturnValue("");
    vinHttpFetch.mockResolvedValueOnce({
      status: 403,
      text: LT_CHALLENGE_HTML,
      cookie: "",
      finalUrl: "https://www.epolicija.lt/itpr_paieska/transportas_lt.php",
    });
    const page = await scanFetchSmart("https://www.epolicija.lt/itpr_paieska/transportas_lt.php", {
      solveUrl: "https://www.epolicija.lt/itpr_paieska/transportas_lt.php",
    });
    expect(solveCaptcha).not.toHaveBeenCalled();
    expect(page.challengeReason).toMatch(/FIXIE_URL|CAPSOLVER_PROXY/);
  });
});
