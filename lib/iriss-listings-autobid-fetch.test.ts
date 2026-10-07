import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { fetchAutobidSource, randomPauseMs } from "@/lib/iriss-listings-autobid-fetch";

function pageHtml(ids: number[], pageCount: number): string {
  // devalue: [root, data, pageCount, items[], ...vehicles]
  const flat: unknown[] = [{ data: 1 }, { itemPageCount: 2, items: 3 }, pageCount, [] as number[]];
  const items = flat[3] as number[];
  for (const id of ids) {
    const base = flat.length;
    flat.push({ id: base + 1, auctionId: base + 2, name: base + 3, price: base + 4 }, id, 77, `Car ${id}`, { start: base + 5 }, 1000 + id);
    items.push(base);
  }
  return `<html><script id="__NUXT_DATA__" type="application/json">${JSON.stringify(flat)}</script></html>`;
}

function fetchMock(handler: (url: string) => { status: number; body: string } | Error) {
  const calls: string[] = [];
  const impl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const r = handler(url);
    if (r instanceof Error) throw r;
    return new Response(r.body, { status: r.status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const opts = { maxPages: 3, timeoutMs: 8000, pauseMinMs: 0, pauseMaxMs: 0, sleep: async () => undefined };
const SRC = "https://autobid.de/en/search-results?brandId-brand=49&name-model=XC60";

describe("fetchAutobidSource", () => {
  it("walks pages with currentPage and dedupes vehicles", async () => {
    const { impl, calls } = fetchMock((url) => {
      const page = Number(new URL(url).searchParams.get("currentPage") ?? "1");
      if (page === 1) return { status: 200, body: pageHtml([1, 2], 2) };
      return { status: 200, body: pageHtml([2, 3], 2) };
    });
    const r = await fetchAutobidSource(SRC, { ...opts, fetchImpl: impl });
    expect(r.status).toBe("ok");
    expect(r.vehicles.map((v) => v.externalId)).toEqual(["1", "2", "3"]);
    expect(r.pagesFetched).toBe(2);
    expect(r.pageCount).toBe(2);
    expect(r.rawPages).toHaveLength(2);
    expect(calls[0]).toBe(SRC);
    expect(calls[1]).toContain("currentPage=2");
  });

  it("respects maxPages and notes the limit", async () => {
    const { impl, calls } = fetchMock(() => ({ status: 200, body: pageHtml([1], 9) }));
    const r = await fetchAutobidSource(SRC, { ...opts, maxPages: 2, fetchImpl: impl });
    expect(r.status).toBe("ok");
    expect(calls).toHaveLength(2);
    expect(r.note).toContain("2/9");
  });

  it("maps 403 / 401 / 500 on the first page and keeps partial results later", async () => {
    const r403 = await fetchAutobidSource(SRC, { ...opts, fetchImpl: fetchMock(() => ({ status: 403, body: "" })).impl });
    expect(r403.status).toBe("blocked_by_waf");
    const r401 = await fetchAutobidSource(SRC, { ...opts, fetchImpl: fetchMock(() => ({ status: 401, body: "" })).impl });
    expect(r401.status).toBe("login_required");
    const r500 = await fetchAutobidSource(SRC, { ...opts, fetchImpl: fetchMock(() => ({ status: 500, body: "" })).impl });
    expect(r500.status).toBe("fetch_failed");

    const partial = await fetchAutobidSource(SRC, {
      ...opts,
      fetchImpl: fetchMock((url) => (url.includes("currentPage") ? { status: 429, body: "" } : { status: 200, body: pageHtml([1], 3) })).impl,
    });
    expect(partial.status).toBe("ok");
    expect(partial.vehicles).toHaveLength(1);
    expect(partial.note).toContain("2. lapa");
  });

  it("flags parse failure when the page has no list structure, keeps raw html", async () => {
    const r = await fetchAutobidSource(SRC, { ...opts, fetchImpl: fetchMock(() => ({ status: 200, body: "<html>Just a moment...</html>" })).impl });
    expect(r.status).toBe("parse_failed");
    expect(r.rawPages[0]).toContain("Just a moment");
  });

  it("zero results is ok with a note", async () => {
    const r = await fetchAutobidSource(SRC, { ...opts, fetchImpl: fetchMock(() => ({ status: 200, body: pageHtml([], 0) })).impl });
    expect(r.status).toBe("ok");
    expect(r.vehicles).toHaveLength(0);
    expect(r.note).toContain("0 auto");
  });

  it("network error on first page is fetch_failed", async () => {
    const r = await fetchAutobidSource(SRC, { ...opts, fetchImpl: fetchMock(() => new Error("ECONNRESET")).impl });
    expect(r.status).toBe("fetch_failed");
    expect(r.note).toContain("ECONNRESET");
  });

  it("unwraps fetch failed to the cause code", async () => {
    const err = new TypeError("fetch failed");
    (err as TypeError & { cause?: unknown }).cause = Object.assign(new Error("getaddrinfo"), { code: "ENOTFOUND" });
    const r = await fetchAutobidSource(SRC, { ...opts, fetchImpl: fetchMock(() => err).impl });
    expect(r.note).toContain("ENOTFOUND");
    expect(r.note).not.toMatch(/fetch failed/i);
  });
});

describe("randomPauseMs", () => {
  it("stays inside bounds", () => {
    for (let i = 0; i < 50; i += 1) {
      const v = randomPauseMs(700, 1800);
      expect(v).toBeGreaterThanOrEqual(700);
      expect(v).toBeLessThanOrEqual(1800);
    }
    expect(randomPauseMs(0, 0)).toBe(0);
  });
});
