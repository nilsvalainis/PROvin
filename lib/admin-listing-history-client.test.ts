import { describe, expect, it, vi } from "vitest";
import type { AdifyListingHistorySnapshot } from "@/lib/adify-listing-history";
import {
  classifyUserscriptHistoryResult,
  fetchHistoryHtmlViaUserscriptWithRetry,
  loadListingPriceHistorySnapshot,
  userscriptVersionAllowsListingHistoryFetch,
  type BrowserHistoryFetch,
} from "@/lib/admin-listing-history-client";

const SS_URL = "https://www.ss.lv/msg/lv/transport/cars/opel/astra/cbpme.html";

function snap(found: boolean, message = ""): AdifyListingHistorySnapshot {
  return {
    found,
    message,
    rows: found ? [{ date: "2026-11-01", price: 5000, delta: 0 } as never] : [],
    durationDays: found ? 10 : 0,
    oldestDate: "",
    newestDate: "",
    priceChangeEur: 0,
    listingUrl: null,
  };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("userscriptVersionAllowsListingHistoryFetch", () => {
  it("requires 1.8+", () => {
    expect(userscriptVersionAllowsListingHistoryFetch("")).toBe(false);
    expect(userscriptVersionAllowsListingHistoryFetch("1.7.4")).toBe(false);
    expect(userscriptVersionAllowsListingHistoryFetch("1.8.0")).toBe(true);
    expect(userscriptVersionAllowsListingHistoryFetch("1.9.1")).toBe(true);
    expect(userscriptVersionAllowsListingHistoryFetch("2.0.0")).toBe(true);
  });
});

describe("classifyUserscriptHistoryResult", () => {
  it("treats the Cloudflare interstitial as cloudflare, not as a page", () => {
    expect(
      classifyUserscriptHistoryResult({ ok: false, status: 403, html: "<title>Just a moment...</title>" }).error,
    ).toBe("cloudflare");
    expect(classifyUserscriptHistoryResult({ ok: true, status: 200, html: "<html>ok</html>" })).toMatchObject({
      html: "<html>ok</html>",
      error: null,
    });
    expect(classifyUserscriptHistoryResult({ ok: false, error: "timeout" }).error).toBe("timeout");
    expect(classifyUserscriptHistoryResult({ ok: false, status: 502, html: "" }).error).toBe("http_5xx");
  });
});

describe("fetchHistoryHtmlViaUserscriptWithRetry", () => {
  it("retries transient failures with backoff and stops after the limit", async () => {
    const fetchOnce = vi.fn(async (): Promise<BrowserHistoryFetch> => ({ html: null, error: "network" }));
    const sleep = vi.fn(async () => {});
    const r = await fetchHistoryHtmlViaUserscriptWithRetry("https://adify.lv/history?url=x", {
      fetchOnce,
      sleep,
      delaysMs: [10, 20],
    });
    expect(r.error).toBe("network");
    expect(fetchOnce).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map((c) => (c as unknown as [number])[0])).toEqual([10, 20]);
  });

  it("does not retry a Cloudflare block", async () => {
    const fetchOnce = vi.fn(async (): Promise<BrowserHistoryFetch> => ({ html: null, error: "cloudflare" }));
    await fetchHistoryHtmlViaUserscriptWithRetry("u", { fetchOnce, sleep: async () => {} });
    expect(fetchOnce).toHaveBeenCalledTimes(1);
  });
});

describe("loadListingPriceHistorySnapshot", () => {
  it("starts the browser read without waiting for the slow server", async () => {
    const server = deferred<AdifyListingHistorySnapshot>();
    const viaBrowser = vi.fn(async (u: string): Promise<BrowserHistoryFetch> =>
      u.includes("adify.lv") ? { html: "<html>adify</html>", error: null } : { html: null, error: "cloudflare" },
    );
    const post = vi.fn(async (body: { url: string; html?: string }) =>
      body.html ? snap(true, "Adify") : server.promise,
    );
    const statuses: string[] = [];

    const result = await loadListingPriceHistorySnapshot(SS_URL, {
      post,
      viaBrowser,
      canUseBrowser: () => true,
      onStatus: (s) => statuses.push(s),
    });

    expect(result.found).toBe(true);
    expect(viaBrowser).toHaveBeenCalledTimes(2);
    expect(statuses).toContain("Ielādēts");
    server.resolve(snap(false, "late"));
  });

  it("returns the server result when the server finds history first", async () => {
    const browser = deferred<BrowserHistoryFetch>();
    const result = await loadListingPriceHistorySnapshot(SS_URL, {
      post: async () => snap(true, "server"),
      viaBrowser: () => browser.promise,
      canUseBrowser: () => true,
    });
    expect(result.message).toBe("server");
    browser.resolve({ html: null, error: "timeout" });
  });

  it("explains a Cloudflare block in the browser too", async () => {
    const statuses: string[] = [];
    const result = await loadListingPriceHistorySnapshot(SS_URL, {
      post: async () => ({ ...snap(false, "Cloudflare bloķēja Adify vēsturi no servera"), blocked: true }),
      viaBrowser: async () => ({ html: null, error: "cloudflare" }),
      canUseBrowser: () => true,
      onStatus: (s) => statuses.push(s),
    });
    expect(result.found).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.message).toMatch(/atver adify\.lv/i);
    expect(statuses).toContain("Serveris bloķēts - gaida pārlūku (Tampermonkey)…");
  });

  it("says the userscript is missing instead of waiting for it", async () => {
    const viaBrowser = vi.fn();
    const result = await loadListingPriceHistorySnapshot(SS_URL, {
      post: async () => snap(false, "Cloudflare"),
      viaBrowser,
      canUseBrowser: () => false,
    });
    expect(viaBrowser).not.toHaveBeenCalled();
    expect(result.message).toMatch(/Tampermonkey/);
  });
});
