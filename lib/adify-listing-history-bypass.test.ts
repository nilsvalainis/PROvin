import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAdifyHistoryHtmlViaCapsolver } from "@/lib/adify-listing-history-bypass";

const PAGE = "https://adify.lv/history?url=https%3A%2F%2Fwww.ss.lv%2Fmsg%2Flv%2Fx.html";
const CF_HTML = `<!DOCTYPE html><html><head><title>Just a moment...</title></head><body>
<div id="challenge-error-text">Enable JavaScript and cookies to continue</div>
<script>window._cf_chl_opt={cType:'managed'};</script>
</body></html>`;
const SSR_HTML = `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
  props: { pageProps: { items: [{ price: 100, created: "2026-08-01" }], retryAfter: null } },
})}</script></html>`;
const FIXIE = "http://fixie:secret@group.usefixie.com:80";

describe("fetchAdifyHistoryHtmlViaCapsolver", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not call CapSolver without an API key", async () => {
    const solve = vi.fn();
    const fetchPage = vi.fn();
    const out = await fetchAdifyHistoryHtmlViaCapsolver(PAGE, {
      hasKey: () => false,
      getProxy: () => FIXIE,
      stickyProxyUrl: () => FIXIE,
      solve,
      fetchPage,
    });
    expect(out.html).toBeNull();
    expect(out.error).toMatch(/CAPSOLVER_API_KEY/);
    expect(solve).not.toHaveBeenCalled();
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it("does not call CapSolver without Fixie / CAPSOLVER_PROXY", async () => {
    const solve = vi.fn();
    const out = await fetchAdifyHistoryHtmlViaCapsolver(PAGE, {
      hasKey: () => true,
      getProxy: () => "",
      stickyProxyUrl: () => undefined,
      solve,
      fetchPage: vi.fn(),
    });
    expect(out.error).toMatch(/FIXIE_URL|CAPSOLVER_PROXY/);
    expect(solve).not.toHaveBeenCalled();
  });

  it("returns Fixie HTML when the page is already real SSR", async () => {
    const solve = vi.fn();
    const fetchPage = vi.fn().mockResolvedValue({
      status: 200,
      text: SSR_HTML,
      cookie: "",
      finalUrl: PAGE,
    });
    const out = await fetchAdifyHistoryHtmlViaCapsolver(PAGE, {
      hasKey: () => true,
      getProxy: () => FIXIE,
      stickyProxyUrl: () => FIXIE,
      solve,
      fetchPage,
    });
    expect(out.html).toContain("__NEXT_DATA__");
    expect(out.error).toBeNull();
    expect(solve).not.toHaveBeenCalled();
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage.mock.calls[0]?.[1]).toMatchObject({ proxyUrl: FIXIE });
  });

  it("solves AntiCloudflareTask and refetches with cf_clearance", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        status: 403,
        text: CF_HTML,
        cookie: "",
        finalUrl: PAGE,
      })
      .mockResolvedValueOnce({
        status: 200,
        text: SSR_HTML,
        cookie: "cf_clearance=adify-1",
        finalUrl: PAGE,
      });
    const solve = vi.fn().mockResolvedValue({
      ok: true,
      token: "cf-tok",
      cookies: { cf_clearance: "adify-1" },
      userAgent: "Mozilla/5.0 solver",
      proxy: FIXIE,
    });

    const out = await fetchAdifyHistoryHtmlViaCapsolver(PAGE, {
      hasKey: () => true,
      getProxy: () => FIXIE,
      stickyProxyUrl: () => FIXIE,
      solve,
      fetchPage,
    });

    expect(out.html).toContain("__NEXT_DATA__");
    expect(out.error).toBeNull();
    expect(solve).toHaveBeenCalledTimes(1);
    const task = solve.mock.calls[0]?.[0] as { kind?: string; html?: string; proxy?: string; websiteURL?: string };
    expect(task.kind).toBe("cloudflare_challenge");
    expect(task.websiteURL).toBe(PAGE);
    expect(task.proxy).toBe(FIXIE);
    expect(task.html).toContain("Just a moment");
    expect(task).not.toHaveProperty("websiteKey");
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage.mock.calls[1]?.[1]).toMatchObject({
      cookie: "cf_clearance=adify-1",
      proxyUrl: FIXIE,
    });
  });

  it("reports when CapSolver clearance still leaves Just a moment", async () => {
    const fetchPage = vi.fn().mockResolvedValue({
      status: 403,
      text: CF_HTML,
      cookie: "",
      finalUrl: PAGE,
    });
    const solve = vi.fn().mockResolvedValue({
      ok: true,
      token: "cf-tok",
      cookies: { cf_clearance: "stale" },
      userAgent: "ua",
    });
    const out = await fetchAdifyHistoryHtmlViaCapsolver(PAGE, {
      hasKey: () => true,
      getProxy: () => FIXIE,
      stickyProxyUrl: () => FIXIE,
      solve,
      fetchPage,
    });
    expect(out.html).toBeNull();
    expect(out.error).toMatch(/pēc CapSolver/);
  });
});
