import { afterEach, describe, expect, it, vi } from "vitest";
import { isAllowedListingScrapeHost } from "@/lib/listing-scrape";
import { fetchListingAiSnapshot } from "@/lib/listing-scrape-server";

describe("mobile.de listing fetch stays off this process", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a note and does not call fetch for mobile.de, but still fetches ss.lv", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("mobile.de")) throw new Error(`mobile.de fetch ${url}`);
      return new Response("<html><head><title>ss</title></head><body>Cena 5000</body></html>", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const denied = await fetchListingAiSnapshot("https://www.mobile.de/home/login.html");
    expect(denied.ok).toBe(false);
    expect(denied.note).toMatch(/neielādē/);
    const suchen = await fetchListingAiSnapshot("https://suchen.mobile.de/fahrzeuge/details.html?id=1");
    expect(suchen.ok).toBe(false);
    expect(suchen.note).toMatch(/neielādē/);
    expect(isAllowedListingScrapeHost("m.mobile.de")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    await fetchListingAiSnapshot("https://www.ss.lv/msg/lv/transport/cars/a.html");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("ss.lv");
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain("mobile.de");
  });
});
