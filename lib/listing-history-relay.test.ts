import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildListingHistoryRelayUrl,
  fetchListingHistoryHtmlViaRelay,
  isListingHistoryChromeRelayUrl,
  LISTING_HISTORY_CHROME_RELAY_HOSTS,
  listingHistoryRelayHeaders,
  listingHistoryRelayTemplates,
  loadListingHistoryHtmlViaRelays,
} from "@/lib/listing-history-relay";

const TARGET = "https://tirgusdati.lv/vesture?q=https%3A%2F%2Fwww.ss.lv%2Fmsg%2Flv%2Fx.html";
const CHROME_ENV = {
  IRISS_LISTINGS_RELAY_URL: "https://relay.test/listings",
  IRISS_LISTINGS_RELAY_TOKEN: "t0ken",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("listingHistoryRelayTemplates", () => {
  it("falls back to the built-in Jina relay", () => {
    expect(listingHistoryRelayTemplates({})).toEqual(["https://r.jina.ai/{url}"]);
  });

  it("puts operator relays before the built-in one and drops duplicates", () => {
    const templates = listingHistoryRelayTemplates({
      LISTING_HISTORY_RELAY_URLS: " https://relay.provin.workers.dev/?u={encoded} , https://r.jina.ai/{url} ",
    });
    expect(templates).toEqual(["https://relay.provin.workers.dev/?u={encoded}", "https://r.jina.ai/{url}"]);
  });
});

describe("buildListingHistoryRelayUrl", () => {
  it("passes the raw URL for {url}", () => {
    expect(buildListingHistoryRelayUrl("https://r.jina.ai/{url}", TARGET)).toBe(`https://r.jina.ai/${TARGET}`);
  });

  it("percent-encodes for {encoded}", () => {
    expect(buildListingHistoryRelayUrl("https://relay.test/?u={encoded}", "https://adify.lv/history?url=a b")).toBe(
      "https://relay.test/?u=https%3A%2F%2Fadify.lv%2Fhistory%3Furl%3Da%20b",
    );
  });

  it("appends an encoded URL when the template has no placeholder", () => {
    expect(buildListingHistoryRelayUrl("https://relay.test/raw?url=", "https://adify.lv/history")).toBe(
      "https://relay.test/raw?url=https%3A%2F%2Fadify.lv%2Fhistory",
    );
  });
});

describe("listingHistoryRelayHeaders", () => {
  it("asks Jina for raw HTML, because Markdown loses the history table", () => {
    const headers = listingHistoryRelayHeaders("https://r.jina.ai/{url}", {});
    expect(headers["x-respond-with"]).toBe("html");
    expect(headers.Authorization).toBeUndefined();
  });

  it("sends the Jina key when configured", () => {
    const headers = listingHistoryRelayHeaders("https://r.jina.ai/{url}", { JINA_API_KEY: " jina_abc " });
    expect(headers.Authorization).toBe("Bearer jina_abc");
  });

  it("sends the operator relay token only to the operator relay", () => {
    const env = { LISTING_HISTORY_RELAY_TOKEN: "t0ken" };
    expect(listingHistoryRelayHeaders("https://relay.test/?u={encoded}", env)["x-relay-token"]).toBe("t0ken");
    expect(listingHistoryRelayHeaders("https://r.jina.ai/{url}", env)["x-relay-token"]).toBeUndefined();
  });
});

describe("fetchListingHistoryHtmlViaRelay", () => {
  it("returns the first non-empty relay body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => "<table class=\"history\">" });
    vi.stubGlobal("fetch", fetchMock);

    const html = await fetchListingHistoryHtmlViaRelay(TARGET, { env: {} });

    expect(html).toBe("<table class=\"history\">");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`https://r.jina.ai/${TARGET}`);
  });

  it("retries the same relay once after a rate limit", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429, text: async () => "" })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => "<html>ok</html>" });
    vi.stubGlobal("fetch", fetchMock);

    const html = await fetchListingHistoryHtmlViaRelay(TARGET, { env: {}, retryDelayMs: 0 });

    expect(html).toBe("<html>ok</html>");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`https://r.jina.ai/${TARGET}`);
  });

  it("moves on to the next relay after HTTP 403, without retrying", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 403, text: async () => "" })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => "<html>ok</html>" });
    vi.stubGlobal("fetch", fetchMock);

    const html = await fetchListingHistoryHtmlViaRelay(TARGET, {
      env: { LISTING_HISTORY_RELAY_URLS: "https://relay.test/?u={encoded}" },
      retryDelayMs: 0,
    });

    expect(html).toBe("<html>ok</html>");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`https://r.jina.ai/${TARGET}`);
  });

  it("returns null when every relay fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network"));
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchListingHistoryHtmlViaRelay(TARGET, { env: {} })).toBeNull();
  });

  it("does not stop after Jina Cloudflare: continues to the Chrome relay", async () => {
    const fetchMock = vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url === "https://relay.test/listings/page") {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              ok: true,
              status: 200,
              html: '<table class="history">chrome</table>',
              finalUrl: TARGET,
            }),
        };
      }
      return { ok: true, status: 200, text: async () => "<title>Just a moment...</title>" };
    });
    vi.stubGlobal("fetch", fetchMock);

    const html = await fetchListingHistoryHtmlViaRelay(TARGET, { env: CHROME_ENV, retryDelayMs: 0 });

    expect(html).toContain("chrome");
    expect(fetchMock.mock.calls.some((c) => String(c[0]) === "https://relay.test/listings/page")).toBe(true);
  });

  it("skips Chrome when chrome: false (Adify must not block the queue)", async () => {
    const fetchMock = vi.fn(async (input: unknown) => {
      if (String(input) === "https://relay.test/listings/page") {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              ok: true,
              status: 200,
              html: "<html>chrome</html>",
              finalUrl: "https://adify.lv/history",
            }),
        };
      }
      return { ok: true, status: 200, text: async () => "<title>Just a moment...</title>" };
    });
    vi.stubGlobal("fetch", fetchMock);

    const out = await loadListingHistoryHtmlViaRelays("https://adify.lv/history?url=https://www.ss.lv/x", {
      env: CHROME_ENV,
      retryDelayMs: 0,
      chrome: false,
    });

    expect(out.html).toBeNull();
    expect(out.error).toMatch(/Jina: Cloudflare/i);
    expect(out.error ?? "").not.toMatch(/Chrome/i);
    expect(fetchMock.mock.calls.some((c) => String(c[0]) === "https://relay.test/listings/page")).toBe(false);
  });

  it("surfaces Chrome relay error when Jina is also challenged", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => "<title>Just a moment...</title>",
    }));
    vi.stubGlobal("fetch", fetchMock);

    const out = await loadListingHistoryHtmlViaRelays(TARGET, { env: {}, retryDelayMs: 0 });

    expect(out.html).toBeNull();
    expect(out.error).toMatch(/Jina: Cloudflare/i);
    expect(out.error).toMatch(/Chrome relejs: Relejs nav konfigurēts/i);
  });
});

describe("LISTING_HISTORY_CHROME_RELAY_HOSTS", () => {
  it("matches the Hetzner /listings/page allowlist additions", () => {
    const src = readFileSync("relay/provin-listings/lib/vinscan-page.mjs", "utf8");
    for (const host of LISTING_HISTORY_CHROME_RELAY_HOSTS) {
      expect(src).toContain(`"${host}"`);
    }
  });

  it("accepts Adify, Tirgus Dati and ss.lv history URLs", () => {
    expect(isListingHistoryChromeRelayUrl("https://adify.lv/history?url=https://www.ss.lv/x")).toBe(true);
    expect(isListingHistoryChromeRelayUrl("https://tirgusdati.lv/vesture?q=1")).toBe(true);
    expect(isListingHistoryChromeRelayUrl("https://www.ss.lv/msg/lv/x.html")).toBe(true);
    expect(isListingHistoryChromeRelayUrl("https://stat.vin/cars/WBA")).toBe(false);
  });
});
