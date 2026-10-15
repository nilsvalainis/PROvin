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

import { runWithVinScanDeadline, scanChallengeReason, scanFetchSmart } from "@/lib/vin-scan/http";
import { parseStatVinPage } from "@/lib/vin-scan/parse-stat-vin";

const VIN = "WBA5R1C0XLFH42873";
const STAT_VIN_WAF_403 = "Access blocked, contact us at support@stat.vin A";
const LT_CHALLENGE_HTML = `<!DOCTYPE html><html lang="en-US"><head><title>Just a moment...</title></head><body>
<div id="challenge-error-text">Enable JavaScript and cookies to continue</div>
<script>window._cf_chl_opt={cType:'managed'};a.src='/cdn-cgi/challenge-platform/h/b/orchestrate/chl_page/v1';</script>
</body></html>`;
describe("scanFetchSmart - Cloudflare", () => {
  afterEach(() => {
    vinHttpFetch.mockReset();
    solveCaptcha.mockReset();
    mockGetCaptchaSolverProxy.mockReset();
    mockGetCaptchaSolverProxy.mockReturnValue(FIXIE);
    mockVinStickyHttpProxyUrl.mockReset();
    mockVinStickyHttpProxyUrl.mockReturnValue(FIXIE);
  });

  it("403 Access blocked (nav JS challenge) nesauc CapSolver", async () => {
    vinHttpFetch.mockResolvedValueOnce({
      status: 403,
      text: STAT_VIN_WAF_403,
      cookie: "",
      finalUrl: `https://stat.vin/cars/${VIN}`,
    });

    const page = await scanFetchSmart(`https://stat.vin/cars/${VIN}`, {
      timeoutMs: 45_000,
      solveUrl: "https://stat.vin/",
      sourceLabel: "stat_vin",
    });

    expect(solveCaptcha).not.toHaveBeenCalled();
    expect(page.status).toBe(403);
    expect(page.text).toBe(STAT_VIN_WAF_403);
    expect(page.challengeReason).toBeUndefined();
    const parsed = parseStatVinPage({
      status: page.status,
      html: page.text,
      vin: VIN,
      challenge: scanChallengeReason(page),
      finalUrl: page.finalUrl,
    });
    expect(parsed.status).toBe("unknown");
  });

  it("īsais WAF 403 nesauc CapSolver (LT pre-#149)", async () => {
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
    const opts = solveCaptcha.mock.calls[0]?.[1] as { timeoutMs?: number };
    expect(opts.timeoutMs).toBeGreaterThanOrEqual(4_000);
    expect(opts.timeoutMs).toBeLessThanOrEqual(12_000);
    const task = solveCaptcha.mock.calls[0]?.[0] as { html?: string; proxy?: string; type?: string };
    expect(task.html).toContain("Just a moment");
    expect(task.html).toContain("_cf_chl_opt");
    expect(task.proxy).toBe(FIXIE);
    expect(task).not.toHaveProperty("websiteKey");
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

  it("īsāks par 4 s budžetu nesauc CapSolver", async () => {
    vinHttpFetch.mockResolvedValueOnce({
      status: 403,
      text: LT_CHALLENGE_HTML,
      cookie: "",
      finalUrl: "https://www.epolicija.lt/itpr_paieska/transportas_lt.php",
    });
    const page = await scanFetchSmart("https://www.epolicija.lt/itpr_paieska/transportas_lt.php?knr=1", {
      timeoutMs: 9_000,
      solveUrl: "https://www.epolicija.lt/itpr_paieska/transportas_lt.php",
      sourceLabel: "LT policija",
    });
    expect(solveCaptcha).not.toHaveBeenCalled();
    expect(page.challengeReason).toMatch(/CapSolver izlaists/);
  });

  it("pēc avota ārējā timeout CapSolver vairs nesāk", async () => {
    vinHttpFetch.mockResolvedValueOnce({
      status: 403,
      text: LT_CHALLENGE_HTML,
      cookie: "",
      finalUrl: "https://www.epolicija.lt/itpr_paieska/transportas_lt.php",
    });
    const page = await runWithVinScanDeadline(Date.now() - 1_000, () =>
      scanFetchSmart("https://www.epolicija.lt/itpr_paieska/transportas_lt.php?knr=1", {
        timeoutMs: 45_000,
        solveUrl: "https://www.epolicija.lt/itpr_paieska/transportas_lt.php",
        sourceLabel: "LT policija",
      }),
    );
    expect(solveCaptcha).not.toHaveBeenCalled();
    expect(page.challengeReason).toMatch(/CapSolver izlaists/);
  });
});
