import { describe, expect, it } from "vitest";

import {
  applyCarinfoSuperSearchHttp,
  applyVinScanRelayIfBlocked,
  fetchCarinfoSuperSearchViaRelay,
  fetchVinScanAuctionPage,
  fetchVinScanPageViaRelay,
  isCarinfoSuperSearchUrl,
  isVinScanRelayUrl,
  vinScanPageNeedsRelay,
  withVinScanRelayDedupe,
} from "@/lib/vin-scan/listings-page-relay";

const ENV = {
  IRISS_LISTINGS_RELAY_URL: "https://csdd-relay.provin.lv/listings",
  IRISS_LISTINGS_RELAY_TOKEN: "t0ken-t0ken-t0ken-t0ken",
};

const WAF = "Access blocked, contact us at support@stat.vin A";

describe("isVinScanRelayUrl", () => {
  it("tikai izsoļu hosti (ne carfax, ne epolicija)", () => {
    expect(isVinScanRelayUrl("https://stat.vin/cars/WBA")).toBe(true);
    expect(isVinScanRelayUrl("https://www.bid.cars/en/search?q=1")).toBe(true);
    expect(isVinScanRelayUrl("https://www.car.info/en-se/vin/S/YV1LW5522V2348444")).toBe(true);
    expect(isVinScanRelayUrl("https://www.carfax.eu/preview-page?vin=1")).toBe(false);
    expect(isVinScanRelayUrl("https://www.epolicija.lt/itpr_paieska/transportas_lt.php")).toBe(false);
  });
});

describe("vinScanPageNeedsRelay", () => {
  it("WAF plaintext un challenge iet uz releju; parasta 200 nē", () => {
    expect(vinScanPageNeedsRelay({ status: 403, text: WAF })).toBe(true);
    expect(vinScanPageNeedsRelay({ status: 200, text: "<title>Just a moment...</title>" })).toBe(true);
    expect(vinScanPageNeedsRelay({ status: 200, text: "<html>Sale History Copart</html>", challengeReason: "CapSolver: x" })).toBe(
      true,
    );
    expect(vinScanPageNeedsRelay({ status: 200, text: "<html>RAM 2500 Sale History</html>" })).toBe(false);
  });
});

describe("fetchVinScanPageViaRelay", () => {
  it("POST /listings/page ar Bearer un atgriež HTML", async () => {
    const calls: { url: string; body: unknown }[] = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), body: JSON.parse(String(init?.body ?? "{}")) });
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            ok: true,
            status: 200,
            finalUrl: "https://stat.vin/cars/WBA",
            html: "<html>Sale History Copart</html>",
          }),
      } as Response;
    }) as typeof fetch;
    const out = await fetchVinScanPageViaRelay("https://stat.vin/cars/WBA", { fetchImpl, env: ENV });
    expect(calls[0]?.url).toBe("https://csdd-relay.provin.lv/listings/page");
    expect(calls[0]?.body).toEqual({ url: "https://stat.vin/cars/WBA" });
    expect(out).toEqual({
      ok: true,
      status: 200,
      finalUrl: "https://stat.vin/cars/WBA",
      html: "<html>Sale History Copart</html>",
    });
  });

  it("bez env nesauc tīklu", async () => {
    let n = 0;
    const fetchImpl = (async () => {
      n += 1;
      return { ok: true, status: 200, text: async () => "{}" } as Response;
    }) as typeof fetch;
    const out = await fetchVinScanPageViaRelay("https://stat.vin/cars/WBA", { fetchImpl, env: {} });
    expect(n).toBe(0);
    expect(out).toEqual({ ok: false, reason: "Relejs nav konfigurēts (IRISS_LISTINGS_RELAY_URL)" });
  });
});

describe("applyVinScanRelayIfBlocked", () => {
  it("WAF lapu aizstāj ar releja HTML", async () => {
    const fetchImpl = (async () =>
      ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ ok: true, status: 200, html: "<html>Sale History Copart</html>", finalUrl: "https://stat.vin/cars/WBA" }),
      }) as Response) as typeof fetch;
    const out = await applyVinScanRelayIfBlocked(
      "https://stat.vin/cars/WBA",
      { status: 403, text: WAF, cookie: "" },
      { fetchImpl, env: ENV },
    );
    expect(out.status).toBe(200);
    expect(out.text).toContain("Sale History");
    expect(out.challengeReason).toBeUndefined();
  });

  it("200 bez WAF releju nesauc", async () => {
    let n = 0;
    const fetchImpl = (async () => {
      n += 1;
      return { ok: true, status: 200, text: async () => "{}" } as Response;
    }) as typeof fetch;
    const page = { status: 200, text: "<html>ok</html>" };
    const out = await applyVinScanRelayIfBlocked("https://stat.vin/cars/WBA", page, { fetchImpl, env: ENV });
    expect(n).toBe(0);
    expect(out).toBe(page);
  });

  it("carfax.eu nav allowlist, releju nesauc", async () => {
    let n = 0;
    const fetchImpl = (async () => {
      n += 1;
      return { ok: true, status: 200, text: async () => "{}" } as Response;
    }) as typeof fetch;
    const page = { status: 403, text: "Access denied", cookie: "" };
    const out = await applyVinScanRelayIfBlocked("https://www.carfax.eu/preview-page?vin=1", page, { fetchImpl, env: ENV });
    expect(n).toBe(0);
    expect(out).toBe(page);
  });

  it("bez IRISS env atstāj WAF lapu (nav konfigurēts)", async () => {
    let n = 0;
    const fetchImpl = (async () => {
      n += 1;
      return { ok: true, status: 200, text: async () => "{}" } as Response;
    }) as typeof fetch;
    const page = { status: 403, text: WAF, cookie: "" };
    const out = await applyVinScanRelayIfBlocked("https://stat.vin/cars/WBA", page, { fetchImpl, env: {} });
    expect(n).toBe(0);
    expect(out).toBe(page);
    expect(out.challengeReason).toBeUndefined();
  });
});

describe("fetchVinScanAuctionPage", () => {
  it("ja relejs ir konfigurēts, stat.vin iet uz Chrome un raw fetch netiek saukts", async () => {
    let direct = 0;
    const fetchImpl = (async () =>
      ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            ok: true,
            status: 200,
            html: "<html>Sale History Copart FI Lot 50558298</html>",
            finalUrl: "https://stat.vin/cars/WDD1173421N570488",
          }),
      }) as Response) as typeof fetch;
    const out = await fetchVinScanAuctionPage(
      "https://stat.vin/cars/WDD1173421N570488",
      async () => {
        direct += 1;
        return { status: 403, text: WAF, cookie: "" };
      },
      { fetchImpl, env: ENV },
    );
    expect(direct).toBe(0);
    expect(out.status).toBe(200);
    expect(out.text).toContain("50558298");
  });

  it("timeout pēc tam Chrome HTML, CapSolver nav iesaistīts", async () => {
    const fetchImpl = (async () =>
      ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ ok: true, status: 200, html: "<html>Sale History Copart</html>", finalUrl: "https://bid.cars/x" }),
      }) as Response) as typeof fetch;
    const out = await fetchVinScanAuctionPage(
      "https://bid.cars/en/search?q=1",
      async () => {
        throw new Error("timeout");
      },
      { fetchImpl, env: ENV },
    );
    expect(out.status).toBe(200);
    expect(out.text).toContain("Sale History");
  });

  it("releja kļūda neizsauc otru /page un atstāj tiešo atbildi", async () => {
    let relayCalls = 0;
    const fetchImpl = (async () => {
      relayCalls += 1;
      return {
        ok: false,
        status: 503,
        text: async () => JSON.stringify({ error: "rinda pilna" }),
      } as Response;
    }) as typeof fetch;
    const out = await fetchVinScanAuctionPage(
      "https://stat.vin/cars/WBA",
      async () => ({ status: 403, text: WAF, cookie: "" }),
      { fetchImpl, env: ENV },
    );
    expect(relayCalls).toBe(1);
    expect(out.status).toBe(403);
    expect(out.text).toBe(WAF);
  });

  it("vienā skenēšanā tas pats URL iet uz releju vienreiz", async () => {
    let n = 0;
    const fetchImpl = (async () => {
      n += 1;
      await new Promise((resolve) => setTimeout(resolve, 15));
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            ok: true,
            status: 200,
            html: "<html>Sale History Copart</html>",
            finalUrl: "https://stat.vin/cars/WBA",
          }),
      } as Response;
    }) as typeof fetch;
    const [a, b] = await withVinScanRelayDedupe(() =>
      Promise.all([
        fetchVinScanPageViaRelay("https://stat.vin/cars/WBA", { fetchImpl, env: ENV }),
        fetchVinScanPageViaRelay("https://stat.vin/cars/WBA", { fetchImpl, env: ENV }),
      ]),
    );
    expect(n).toBe(1);
    expect(a).toEqual(b);
    expect(a.ok).toBe(true);
  });

  it("timeout bez releja env paliek timeout", async () => {
    await expect(
      fetchVinScanAuctionPage("https://bid.cars/en/search?q=1", async () => {
        throw new Error("timeout");
      }, { env: {} }),
    ).rejects.toThrow("timeout");
  });
});

const SUPER = "https://www.car.info/en-se/search/super/WVWZZZ7NZEV015204?time=1";

describe("car.info super-search HTTP relejs", () => {
  it("atpazīst tikai super-search JSON, ne VIN lapu", () => {
    expect(isCarinfoSuperSearchUrl(SUPER)).toBe(true);
    expect(isCarinfoSuperSearchUrl("https://www.car.info/en-dk/vin/DK/WVWZZZ7NZEV015204")).toBe(false);
    expect(isCarinfoSuperSearchUrl("https://stat.vin/cars/WBA")).toBe(false);
  });

  it("POST /listings/http un nekad /page", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            ok: true,
            status: 200,
            html: JSON.stringify({ hits: { idents: [{ country: "DK" }] }, hits_html: "" }),
            finalUrl: SUPER,
          }),
      } as Response;
    }) as typeof fetch;
    const out = await fetchCarinfoSuperSearchViaRelay(SUPER, { fetchImpl, env: ENV, timeoutMs: 1_000 });
    expect(calls).toEqual(["https://csdd-relay.provin.lv/listings/http"]);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.html).toContain("DK");
  });

  it("vecs relejs ar HTTP 400 neatver Chrome un atgriežas uzreiz", async () => {
    const fetchImpl = (async () =>
      ({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ ok: false, error: "platform: openlane | auto1 | autobid | ecarstrade" }),
      }) as Response) as typeof fetch;
    const page = { status: 403, text: "<html><title>403 Forbidden</title></html>", cookie: "" };
    const out = await applyCarinfoSuperSearchHttp(SUPER, page, { fetchImpl, env: ENV, timeoutMs: 1_000 });
    expect(out).toBe(page);
  });

  it("ilga 403 atbilde nepārsniedz īso limitu", async () => {
    const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 5_000);
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
      return { ok: true, status: 200, text: async () => "{}" } as Response;
    }) as typeof fetch;
    const started = Date.now();
    const out = await fetchCarinfoSuperSearchViaRelay(SUPER, { fetchImpl, env: ENV, timeoutMs: 50 });
    expect(Date.now() - started).toBeLessThan(500);
    expect(out).toEqual({ ok: false, reason: "Relejs neatbildēja 1 s laikā" });
  });
});
