import { afterEach, describe, expect, it, vi } from "vitest";
import {
  adifyChronologicalPriceRows,
  adifyDurationDays,
  adifyHistoryPageLookupUrl,
  applyAdifyHistoryToTirgus,
  extractAdifyHistorySsrPayload,
  formatAdifyDurationLabel,
  formatAdifySignedEur,
  normalizeAdifyHistoryItems,
  parseAdifyHistoryUrl,
} from "@/lib/adify-listing-history";
import { fetchAdifyListingHistory } from "@/lib/adify-listing-history-fetch";
import { createDefaultSourceBlocks, emptyTirgusFields } from "@/lib/admin-source-blocks";

const Q7_URL = "https://www.ss.lv/msg/lv/transport/cars/audi/q7/bcdpnx.html";

describe("parseAdifyHistoryUrl", () => {
  it("reads ss.lv car listing id and kind", () => {
    expect(parseAdifyHistoryUrl(Q7_URL)).toEqual({ source: 0, kind: "car", id: "bcdpnx" });
  });

  it("accepts ss.com", () => {
    expect(parseAdifyHistoryUrl("https://www.ss.com/msg/lv/transport/cars/audi/q7/bcdpnx.html")?.id).toBe(
      "bcdpnx",
    );
  });
});

describe("normalizeAdifyHistoryItems — cenas paraugs", () => {
  const now = new Date(2026, 7, 13);
  const json = [
    [
      { price: 13700, mileage: 364584, year: 2016, created: "2026-08-01T10:00:00" },
      { price: 13700, mileage: 364584, year: 2016, created: "2026-07-25T10:00:00" },
      { price: 13700, mileage: 364584, year: 2016, created: "2026-06-27T10:00:00" },
      { price: 15999, mileage: 364584, year: 2016, created: "2026-06-10T10:00:00" },
      { price: 16500, mileage: 364584, year: 2016, created: "2026-05-26T10:00:00" },
      { price: 17490, mileage: 364584, year: 2016, created: "2026-05-20T10:00:00" },
    ],
  ];

  it("computes 85-day duration, oldest date and total price change", () => {
    const snap = normalizeAdifyHistoryItems(json, now);
    expect(snap.found).toBe(true);
    expect(snap.rows).toHaveLength(6);
    expect(snap.oldestDate).toBe("20.05.2026");
    expect(snap.newestDate).toBe("01.08.2026");
    expect(snap.priceChangeEur).toBe(-3790);
    expect(snap.durationDays).toBe(85);
    expect(formatAdifySignedEur(snap.priceChangeEur)).toBe("€ -3 790");
    expect(snap.rows[2]?.delta).toBe(-2299);
    expect(snap.rows[3]?.delta).toBe(-501);
    expect(snap.rows[4]?.delta).toBe(-990);
    expect(snap.rows[5]?.delta).toBe(0);
  });

  it("fills tirgus fields from Adify snapshot", () => {
    const snap = normalizeAdifyHistoryItems(json, now);
    const next = applyAdifyHistoryToTirgus(emptyTirgusFields(), snap);
    expect(next.listedForSale).toBe("85");
    expect(next.listingCreated).toBe("20.05.2026");
    expect(next.priceDrop).toBe("€ -3 790");
    expect(next.priceHistory).toHaveLength(6);
  });
});

describe("normalizeAdifyHistoryItems — Audi Q7 bcdpnx fixture", () => {
  const now = new Date(2026, 7, 13);
  const json = [
    [
      { price: 23950, mileage: 233000, year: 2015, created: "2026-08-13T15:33:01" },
      { price: 24500, mileage: 233000, year: 2015, created: "2026-07-30T14:57:02" },
      { price: 24900, mileage: 233000, year: 2015, created: "2026-07-16T13:48:01" },
    ],
  ];

  it("maps Q7 snapshots to days, created date and signed drop", () => {
    const snap = normalizeAdifyHistoryItems(json, now);
    expect(snap.durationDays).toBe(28);
    expect(snap.oldestDate).toBe("16.07.2026");
    expect(snap.priceChangeEur).toBe(-950);
    const next = applyAdifyHistoryToTirgus(createDefaultSourceBlocks().tirgus, snap);
    expect(next.listedForSale).toBe("28");
    expect(next.listingCreated).toBe("16.07.2026");
    expect(next.priceDrop).toBe("€ -950");
  });
});

describe("adifyDurationDays", () => {
  it("is at least 1 for a same-day listing", () => {
    expect(adifyDurationDays("2026-08-13T12:00:00", new Date(2026, 7, 13))).toBe(1);
  });
});

describe("formatAdifyDurationLabel", () => {
  it("uses Latvian singular after 21", () => {
    expect(formatAdifyDurationLabel(1)).toBe("1 diena");
    expect(formatAdifyDurationLabel(11)).toBe("11 dienas");
    expect(formatAdifyDurationLabel(21)).toBe("21 diena");
    expect(formatAdifyDurationLabel(85)).toBe("85 dienas");
  });
});

describe("adifyHistoryPageLookupUrl", () => {
  it("encodes the listing URL as the history page query", () => {
    expect(adifyHistoryPageLookupUrl(Q7_URL)).toBe(
      "https://adify.lv/history?url=https%3A%2F%2Fwww.ss.lv%2Fmsg%2Flv%2Ftransport%2Fcars%2Faudi%2Fq7%2Fbcdpnx.html",
    );
  });
});

describe("extractAdifyHistorySsrPayload", () => {
  const series = [
    { price: 23950, mileage: 233000, year: 2015, created: "2026-08-13T15:33:01" },
    { price: 24500, mileage: 233000, year: 2015, created: "2026-07-30T14:57:02" },
  ];

  it("reads items from Next.js __NEXT_DATA__", () => {
    const html = `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: { pageProps: { items: series, retryAfter: null, url: Q7_URL } },
    })}</script></html>`;
    const payload = extractAdifyHistorySsrPayload(html);
    expect(payload.retryAfter).toBeNull();
    expect(payload.items).toEqual(series);
    const snap = normalizeAdifyHistoryItems(payload.items, new Date(2026, 7, 13));
    expect(snap.found).toBe(true);
    expect(snap.rows).toHaveLength(2);
    expect(snap.priceChangeEur).toBe(-550);
  });

  it("surfaces Adify retryAfter", () => {
    const html = `<html><script id="__NEXT_DATA__">${JSON.stringify({
      props: { pageProps: { items: null, retryAfter: 12.2 } },
    })}</script></html>`;
    expect(extractAdifyHistorySsrPayload(html)).toEqual({ items: null, retryAfter: 13 });
  });

  it("returns empty payload when the script is missing", () => {
    expect(extractAdifyHistorySsrPayload("<html><body>nav datu</body></html>")).toEqual({
      items: null,
      retryAfter: null,
    });
  });
});

describe("fetchAdifyListingHistory", () => {
  const NOW = new Date(2026, 7, 13);
  const SSR_HTML = `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: {
      pageProps: {
        items: [
          { price: 23950, mileage: 233000, year: 2015, created: "2026-08-13T15:33:01" },
          { price: 24500, mileage: 233000, year: 2015, created: "2026-07-30T14:57:02" },
        ],
        retryAfter: null,
        url: Q7_URL,
      },
    },
  })}</script></html>`;

  const blocked = () => ({
    ok: false,
    status: 403,
    headers: { get: () => "cloudflare", getSetCookie: () => [] },
    clone: () => ({ text: async () => "<title>Just a moment...</title>" }),
    text: async () => "<title>Just a moment...</title>",
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("reads the SSR page through an own HTTP relay when the datacenter IP gets HTTP 403", async () => {
    const fetchMock = vi.fn(async (input: unknown) =>
      String(input).startsWith("https://relay.own.test/")
        ? { ok: true, status: 200, text: async () => SSR_HTML }
        : blocked(),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("LISTING_HISTORY_RELAY_URLS", "https://relay.own.test/?u={encoded}");

    const snap = await fetchAdifyListingHistory(Q7_URL, NOW);

    expect(snap.found).toBe(true);
    expect(snap.source).toBe("adify");
    expect(snap.priceChangeEur).toBe(-550);
  });

  it("does not spend time on Jina for Adify (Jina never passes the Adify challenge)", async () => {
    const fetchMock = vi.fn(async (input: unknown) =>
      String(input).startsWith("https://r.jina.ai/")
        ? { ok: true, status: 200, text: async () => SSR_HTML }
        : blocked(),
    );
    vi.stubGlobal("fetch", fetchMock);

    const snap = await fetchAdifyListingHistory(Q7_URL, NOW, {
      bypass: async () => ({ html: null, error: "Adify: CapSolver: custom proxy connect failed. (HTTP 400)" }),
    });

    expect(snap.found).toBe(false);
    expect(snap.blocked).toBe(true);
    expect(fetchMock.mock.calls.some((c) => String(c[0]).startsWith("https://r.jina.ai/"))).toBe(false);
    expect(snap.message).not.toMatch(/Jina/);
  });

  it("keeps the HTTP 403 message when the relay is blocked too", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => blocked()));

    const snap = await fetchAdifyListingHistory(Q7_URL, NOW);

    expect(snap.found).toBe(false);
    expect(snap.blocked).toBe(true);
    expect(snap.message).toMatch(/Cloudflare bloķēja/i);
    expect(snap.message).toMatch(/CapSolver|HTTP/i);
  });

  it("reads SSR HTML from CapSolver + Fixie and does not queue Chrome", async () => {
    const fetchMock = vi.fn(async (input: unknown) => {
      if (String(input).startsWith("https://r.jina.ai/")) {
        return { ok: true, status: 200, text: async () => "<title>Just a moment...</title>" };
      }
      return blocked();
    });
    vi.stubGlobal("fetch", fetchMock);

    const snap = await fetchAdifyListingHistory(Q7_URL, NOW, {
      bypass: async () => ({ html: SSR_HTML, error: null }),
    });

    expect(snap.found).toBe(true);
    expect(snap.source).toBe("adify");
    expect(snap.priceChangeEur).toBe(-550);
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/listings/page"))).toBe(false);
  });

  it("does not call the Chrome relay for Adify when Jina is also challenged", async () => {
    const fetchMock = vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url === "https://relay.test/listings/page") {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({ ok: true, status: 200, html: SSR_HTML, finalUrl: "https://adify.lv/history" }),
        };
      }
      if (url.startsWith("https://r.jina.ai/")) {
        return { ok: true, status: 200, text: async () => "<title>Just a moment...</title>" };
      }
      return blocked();
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("IRISS_LISTINGS_RELAY_URL", "https://relay.test/listings");
    vi.stubEnv("IRISS_LISTINGS_RELAY_TOKEN", "t0ken");

    const snap = await fetchAdifyListingHistory(Q7_URL, NOW, {
      bypass: async () => ({ html: null, error: "Adify CapSolver: nav CAPSOLVER_API_KEY" }),
    });

    expect(snap.found).toBe(false);
    expect(snap.blocked).toBe(true);
    expect(fetchMock.mock.calls.some((c) => String(c[0]) === "https://relay.test/listings/page")).toBe(false);
  });

  it("fails fast on Cloudflare challenge HTML without treating it as data", async () => {
    const cfHtml = "<html><title>Just a moment...</title><body>Checking your browser</body></html>";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) => {
        if (String(input).startsWith("https://r.jina.ai/")) {
          return { ok: true, status: 200, text: async () => cfHtml };
        }
        return {
          ok: false,
          status: 403,
          headers: { get: () => "cloudflare", getSetCookie: () => [] },
          text: async () => cfHtml,
        };
      }),
    );

    const snap = await fetchAdifyListingHistory(Q7_URL, NOW);

    expect(snap.found).toBe(false);
    expect(snap.blocked).toBe(true);
    expect(snap.message).toMatch(/pārlūkā/i);
  });
});

describe("adifyChronologicalPriceRows", () => {
  it("puts the first listing day first", () => {
    const snap = normalizeAdifyHistoryItems(
      [[{ price: 100, created: "2026-08-10" }, { price: 90, created: "2026-08-01" }]],
      new Date(2026, 7, 13),
    );
    const chrono = adifyChronologicalPriceRows(snap.rows);
    expect(chrono[0]?.price).toBe(90);
    expect(chrono[chrono.length - 1]?.price).toBe(100);
  });
});
