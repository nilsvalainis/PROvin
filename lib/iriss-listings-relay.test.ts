import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { platformHealthFromView, mergeRelayHealth } from "@/lib/iriss-listings-session-health";
import {
  buildIrissRelayVncUrl,
  checkIrissRelaySession,
  closeIrissRelayLogin,
  fetchIrissRelayHealth,
  fetchViaIrissRelay,
  listingPlatformFromRelay,
  mapRelayFetchResponse,
  mapRelayItem,
  mapRelayHealth,
  mapRelayLoginClose,
  mapRelayLoginStart,
  readIrissRelayConfig,
  relayPlatformFor,
  startIrissRelayLogin,
  type IrissRelayConfig,
} from "@/lib/iriss-listings-relay";
import type { IrissListingsLatestView } from "@/lib/iriss-listings-types";

const cfg: IrissRelayConfig = { baseUrl: "https://csdd-relay.provin.lv/listings", token: "t0ken-t0ken-t0ken-t0ken", timeoutMs: 20_000 };
const openlaneSrc = { platform: "openline" as const, sourceUrl: "https://www.openlane.eu/en/findcar?makes=volvo", orderId: "o1", orderBrandModel: "Volvo XC60" };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** Minimāls Autobid `__NUXT_DATA__` ar vienu auto (releja raw.nuxtPages[0]). */
function nuxtPage(): string {
  return JSON.stringify([
    ["ShallowReactive", 1],
    { state: 2 },
    { q: 3 },
    { data: 4 },
    { itemPageCount: 5, items: 6 },
    1,
    [7],
    { id: 8, auctionId: 9, name: 10, stage: 11, price: 12, auctionStartDate: 16, slug: 17, manufacturer: 18 },
    3587391,
    83954,
    "Volvo XC60 B5 AWD",
    "BEFORE_AUCTION",
    { start: 13, minimal: 14, current: 15 },
    32500,
    22800,
    0,
    ["Date", "2026-10-08T08:00:00+00:00"],
    "volvo-xc60-b5-awd-3587391",
    { name: 19 },
    "Volvo",
  ]);
}

describe("iriss relay config", () => {
  it("reads URL + token, trims trailing slash, clamps timeout", () => {
    expect(readIrissRelayConfig({ IRISS_LISTINGS_RELAY_URL: "https://x/listings/", IRISS_LISTINGS_RELAY_TOKEN: "abc", IRISS_LISTINGS_RELAY_TIMEOUT_MS: "999999" })).toEqual({
      baseUrl: "https://x/listings",
      token: "abc",
      timeoutMs: 290_000,
    });
    expect(readIrissRelayConfig({ IRISS_LISTINGS_RELAY_URL: "https://x" })).toBeNull();
    expect(readIrissRelayConfig({})).toBeNull();
  });

  it("maps openline -> openlane for the relay", () => {
    expect(relayPlatformFor("openline")).toBe("openlane");
    expect(relayPlatformFor("auto1")).toBe("auto1");
    expect(relayPlatformFor("autobid")).toBe("autobid");
    expect(listingPlatformFromRelay("openlane")).toBe("openline");
    expect(listingPlatformFromRelay("auto1")).toBe("auto1");
  });
});

describe("mapRelayFetchResponse", () => {
  it("maps ok items to fetched vehicles with stable ids", () => {
    const r = mapRelayFetchResponse(
      {
        ok: true,
        status: "ok",
        note: "",
        pagesFetched: 2,
        pageCount: 2,
        elapsedMs: 4321,
        items: [
          {
            platform: "openlane",
            externalId: "A1",
            detailUrl: "https://www.openlane.eu/en/car/A1",
            title: "Volvo XC60 B5",
            manufacturer: "Volvo",
            year: "2021",
            firstRegistration: "2021-03-01",
            mileageKm: 88000,
            fuel: "Diesel",
            transmission: "Automatic",
            powerKw: "173",
            location: "Antwerp",
            countryCode: "BE",
            imageUrl: "",
            currency: "EUR",
            priceStart: 21000,
            priceMinimal: 24500,
            priceCurrent: 22100,
            priceBuyNow: 27900,
            vatNote: "",
            auctionId: "A1",
            auctionStartAt: "2026-10-08T08:00:00.000Z",
            auctionEndAt: "2026-10-09T08:00:00.000Z",
            auctionStage: "IN_AUCTION",
          },
          { externalId: "" },
          "junk",
        ],
      },
      openlaneSrc,
    );
    expect(r.status).toBe("ok");
    expect(r.vehicles).toHaveLength(1);
    const v = r.vehicles[0]!;
    expect(v.platform).toBe("openline");
    expect(v.orderId).toBe("o1");
    expect(v.priceBuyNow).toBe(27900);
    expect(v.auctionEndAt).toBe("2026-10-09T08:00:00.000Z");
    expect(v.id).toMatch(/^[0-9a-f]{12,}$/);
    expect(r.pagesFetched).toBe(2);
    expect(r.elapsedMs).toBe(4321);
  });

  it("login_required / blocked / error map to source statuses with relay note", () => {
    expect(mapRelayFetchResponse({ status: "login_required", note: "Openlane: sesija beigusies" }, openlaneSrc)).toMatchObject({ status: "login_required", note: "Openlane: sesija beigusies", vehicles: [] });
    expect(mapRelayFetchResponse({ status: "blocked", note: "Cloudflare" }, openlaneSrc).status).toBe("blocked_by_waf");
    expect(mapRelayFetchResponse({ status: "error", note: "x" }, openlaneSrc).status).toBe("fetch_failed");
    expect(mapRelayFetchResponse("nope", openlaneSrc).status).toBe("fetch_failed");
  });

  it("ok with zero items adds the 0 auto note", () => {
    const r = mapRelayFetchResponse({ status: "ok", note: "", items: [] }, openlaneSrc);
    expect(r.status).toBe("ok");
    expect(r.note).toContain("0 auto");
  });

  it("autobid raw.nuxtPages is parsed on the Vercel side", () => {
    const src = { platform: "autobid" as const, sourceUrl: "https://autobid.de/en/search-results?x=1", orderId: "o2", orderBrandModel: "Volvo XC60" };
    const r = mapRelayFetchResponse({ status: "ok", note: "", items: [], raw: { kind: "autobid-nuxt", nuxtPages: [nuxtPage()], loggedIn: true }, pagesFetched: 1, pageCount: 1 }, src);
    expect(r.status).toBe("ok");
    expect(r.vehicles).toHaveLength(1);
    expect(r.vehicles[0]).toMatchObject({ platform: "autobid", externalId: "3587391", priceStart: 32500, priceMinimal: 22800, priceCurrent: null, priceBuyNow: null, orderId: "o2" });
    expect(r.rawPages).toHaveLength(1);

    const bad = mapRelayFetchResponse({ status: "ok", items: [], raw: { kind: "autobid-nuxt", nuxtPages: ["not json"] } }, src);
    expect(bad.status).toBe("parse_failed");
  });

  it("strips Autobid Bearer and account fields from stored raw pages", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0IiwibmFtZSI6IkpvaG4ifQ.sflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    const dirty = JSON.parse(nuxtPage()) as unknown[];
    const authIdx = dirty.length;
    dirty.push({ token: authIdx + 1, email: authIdx + 2 });
    dirty.push(jwt, "operator@example.com");
    (dirty[1] as Record<string, unknown>).auth = authIdx;
    const src = { platform: "autobid" as const, sourceUrl: "https://autobid.de/en/search-results?x=1", orderId: "o2", orderBrandModel: "Volvo XC60" };
    const r = mapRelayFetchResponse({ status: "ok", items: [], raw: { kind: "autobid-nuxt", nuxtPages: [JSON.stringify(dirty)], loggedIn: true } }, src);
    expect(r.status).toBe("ok");
    expect(r.vehicles).toHaveLength(1);
    expect(r.rawPages.join("")).not.toContain(jwt);
    expect(r.rawPages.join("")).not.toContain("operator@example.com");
  });

  it("keeps Auto1 euro prices, photos, end time and salesVatType", () => {
    const v = mapRelayItem(
      {
        platform: "auto1",
        externalId: "987654",
        stockNumber: "BW03512",
        imageUrls: ["https://img-pa.auto1.com/img/a.jpg", "https://img-pa.auto1.com/img/b.jpg"],
        imageUrl: "https://img-pa.auto1.com/img/a.jpg",
        priceMinimal: 6513,
        priceStart: 4000,
        priceCurrent: null,
        priceBuyNow: 8900,
        auctionEndAt: "2026-10-08T16:00:00.000Z",
        salesVatType: 1053,
        title: "BMW 320d",
      },
      "auto1",
      "o3",
      "BMW 320d",
    );
    expect(v).toMatchObject({
      platform: "auto1",
      externalId: "987654",
      stockNumber: "BW03512",
      imageUrls: ["https://img-pa.auto1.com/img/a.jpg", "https://img-pa.auto1.com/img/b.jpg"],
      priceMinimal: 6513,
      auctionEndAt: "2026-10-08T16:00:00.000Z",
      salesVatType: 1053,
      orderId: "o3",
    });
  });
});

describe("fetchViaIrissRelay", () => {
  it("posts platform/sourceUrl/orderId with Bearer and maps body", async () => {
    let seen: { url: string; init?: RequestInit } | null = null;
    const fetchImpl = async (url: string, init?: RequestInit) => {
      seen = { url, init };
      return jsonResponse(200, { status: "ok", items: [], note: "" });
    };
    const r = await fetchViaIrissRelay(cfg, openlaneSrc, { maxPages: 3, fetchImpl });
    expect(r.status).toBe("ok");
    expect(seen!.url).toBe("https://csdd-relay.provin.lv/listings/fetch");
    expect((seen!.init!.headers as Record<string, string>).authorization).toBe("Bearer t0ken-t0ken-t0ken-t0ken");
    expect(JSON.parse(String(seen!.init!.body))).toEqual({ platform: "openlane", sourceUrl: openlaneSrc.sourceUrl, orderId: "o1", maxPages: 3 });
  });

  it("HTTP 401 / 429 / 503 become fetch_failed with Latvian notes", async () => {
    const mk = (status: number, body: unknown) => fetchViaIrissRelay(cfg, openlaneSrc, { fetchImpl: async () => jsonResponse(status, body) });
    expect((await mk(401, { error: "nederīgs tokens" })).note).toContain("tokenu");
    expect((await mk(429, { error: "dienas limits" })).note).toContain("limits");
    expect((await mk(503, { error: "rinda pilna" })).note).toContain("aizņemts");
    expect((await mk(500, "oops")).status).toBe("fetch_failed");
  });

  it("network failure is fetch_failed, not a throw", async () => {
    const r = await fetchViaIrissRelay(cfg, openlaneSrc, {
      fetchImpl: async () => {
        throw new Error("ECONNREFUSED");
      },
    });
    expect(r.status).toBe("fetch_failed");
    expect(r.note).toContain("ECONNREFUSED");
  });

  it("shows err.cause.code instead of a bare fetch failed", async () => {
    const err = new TypeError("fetch failed");
    (err as TypeError & { cause?: unknown }).cause = Object.assign(new Error("connect ECONNRESET"), { code: "ECONNRESET" });
    const reset = await fetchViaIrissRelay(cfg, openlaneSrc, {
      fetchImpl: async () => {
        throw err;
      },
    });
    expect(reset.note).toContain("ECONNRESET");
    expect(reset.note).not.toMatch(/fetch failed/i);

    const timeout = new TypeError("fetch failed");
    (timeout as TypeError & { cause?: unknown }).cause = Object.assign(new Error("Connect Timeout Error"), { code: "UND_ERR_CONNECT_TIMEOUT" });
    const timed = await fetchViaIrissRelay(cfg, openlaneSrc, {
      fetchImpl: async () => {
        throw timeout;
      },
    });
    expect(timed.note).toContain("UND_ERR_CONNECT_TIMEOUT");

    const cert = new TypeError("fetch failed");
    (cert as TypeError & { cause?: unknown }).cause = { code: "CERT_HAS_EXPIRED" };
    const expired = await fetchViaIrissRelay(cfg, openlaneSrc, {
      fetchImpl: async () => {
        throw cert;
      },
    });
    expect(expired.note).toContain("CERT_HAS_EXPIRED");
  });
});

describe("relay health merge", () => {
  const view: IrissListingsLatestView = {
    version: 2,
    generatedAt: "2026-10-07T04:10:00.000Z",
    summary: {
      startedAt: "2026-10-07T04:00:00.000Z",
      finishedAt: "2026-10-07T04:10:00.000Z",
      runId: "r",
      totalSources: 2,
      okCount: 1,
      loginRequiredCount: 0,
      blockedByWafCount: 0,
      parseFailedCount: 0,
      fetchFailedCount: 0,
      relayNotConfiguredCount: 1,
      skippedCount: 0,
      vehicleCount: 0,
      newCount: 0,
      priceChangedCount: 0,
      goneCount: 0,
    },
    sources: [
      { id: "s1", orderId: "o1", orderBrandModel: "V", platform: "openline", sourceUrl: "https://www.openlane.eu/en/findcar", status: "ok", note: "", vehicleCount: 3, pagesFetched: 1, pageCount: 1, fetchedAt: "2026-10-07T04:05:00.000Z" },
      { id: "s2", orderId: "o1", orderBrandModel: "V", platform: "auto1", sourceUrl: "https://www.auto1.com/x", status: "relay_not_configured", note: "", vehicleCount: 0, pagesFetched: 0, pageCount: 0, fetchedAt: "2026-10-07T04:05:00.000Z" },
    ],
    vehicles: [],
  };
  const at = "2026-10-07T10:00:00.000Z";

  it("mapRelayHealth reads platform sessions", () => {
    const h = mapRelayHealth({ ok: true, platforms: { openlane: { session: "login_required", lastError: "x" }, auto1: { session: "ok" }, autobid: { session: "weird" } } }, at);
    expect(h.reachable).toBe(true);
    expect(h.platforms.openlane?.session).toBe("login_required");
    expect(h.platforms.auto1?.session).toBe("ok");
    expect(h.platforms.autobid?.session).toBe("unknown");
    expect(mapRelayHealth(null, at).reachable).toBe(false);
    expect(mapRelayHealth(null, at).manualLogin).toBeNull();
    const withLogin = mapRelayHealth({ platforms: { openlane: { session: "ok" } }, manualLogin: { platform: "auto1", startedAt: at, vncReady: true } }, at);
    expect(withLogin.manualLogin).toEqual({ platform: "auto1", startedAt: at, vncReady: true });
  });

  it("live login_required from relay overrides an ok morning run", () => {
    const relay = mapRelayHealth({ platforms: { openlane: { session: "login_required" }, auto1: { session: "ok" }, autobid: { session: "ok" } } }, at);
    const ol = mergeRelayHealth(platformHealthFromView("openline", view, at), relay, { autobidViaRelay: false });
    expect(ol.status).toBe("login_required");
    expect(ol.note).toContain("jāielogojas no jauna");
    const withErr = mapRelayHealth({ platforms: { openlane: { session: "login_required", lastError: "Openlane: login kļūda Timeout" } } }, at);
    const olErr = mergeRelayHealth(platformHealthFromView("openline", view, at), withErr, { autobidViaRelay: false });
    expect(olErr.note).toContain("Timeout");
    const a1 = mergeRelayHealth(platformHealthFromView("auto1", view, at), relay, { autobidViaRelay: false });
    expect(a1.status).toBe("not_run");
    const ab = mergeRelayHealth(platformHealthFromView("autobid", view, at), relay, { autobidViaRelay: false });
    expect(ab.status).toBe("no_sources");
  });

  it("unreachable relay is failed; no relay leaves view health untouched", () => {
    const down = mergeRelayHealth(platformHealthFromView("openline", view, at), { reachable: false, note: "Relejs nav sasniedzams.", checkedAt: at, platforms: {}, manualLogin: null }, { autobidViaRelay: false });
    expect(down.status).toBe("failed");
    expect(mergeRelayHealth(platformHealthFromView("openline", view, at), null, { autobidViaRelay: false }).status).toBe("ok");
  });

  it("fetchIrissRelayHealth tolerates HTTP errors and network failures", async () => {
    expect((await fetchIrissRelayHealth(cfg, { fetchImpl: async () => jsonResponse(502, {}) })).reachable).toBe(false);
    expect(
      (
        await fetchIrissRelayHealth(cfg, {
          fetchImpl: async () => {
            throw new Error("down");
          },
        })
      ).reachable,
    ).toBe(false);
    const ok = await fetchIrissRelayHealth(cfg, { fetchImpl: async () => jsonResponse(200, { platforms: { openlane: { session: "ok" } } }) });
    expect(ok.reachable).toBe(true);
    expect(ok.platforms.openlane?.session).toBe("ok");
  });
});

describe("relay login client", () => {
  const token = "ab".repeat(32);

  it("builds a token-in-path noVNC url without the relay bearer", () => {
    const url = buildIrissRelayVncUrl("https://csdd-relay.provin.lv/listings/", token);
    expect(url).toContain(`/listings/vnc/${token}/vnc.html`);
    expect(url).toContain("autoconnect=true");
    expect(url).toContain("path=listings%2Fvnc%2F");
    expect(url).not.toContain("t0ken");
    expect(buildIrissRelayVncUrl("https://x/listings", "short")).toBe("");
  });

  it("maps start / close / session-check bodies", () => {
    const start = mapRelayLoginStart(
      { ok: true, platform: "auto1", vncToken: token, vncReady: true, minutes: 15, startedAt: "2026-10-08T08:00:00.000Z" },
      cfg.baseUrl,
    );
    expect(start.ok).toBe(true);
    expect(start.vncUrl).toContain(token);
    expect(start.vncReady).toBe(true);
    expect(mapRelayLoginStart({ ok: false, error: "pārlūks aizņemts" }, cfg.baseUrl).note).toContain("aizņemts");
    expect(mapRelayLoginClose({ ok: true, platform: "auto1", loggedIn: true, session: "ok", why: "closed" })).toMatchObject({
      ok: true,
      loggedIn: true,
      session: "ok",
    });
    expect(mapRelayLoginClose({ ok: false, error: "nav atvērta manuālā login" }).ok).toBe(false);
  });

  it("posts start/close/check to the right paths with Bearer", async () => {
    const seen: string[] = [];
    const fetchImpl = async (url: string, init?: RequestInit) => {
      seen.push(`${init?.method} ${url}`);
      expect((init?.headers as Record<string, string>).authorization).toBe("Bearer t0ken-t0ken-t0ken-t0ken");
      if (url.endsWith("/login/auto1")) return jsonResponse(200, { ok: true, platform: "auto1", vncToken: token, vncReady: true, minutes: 15 });
      if (url.endsWith("/login/auto1/close")) return jsonResponse(200, { ok: true, platform: "auto1", loggedIn: true, session: "ok" });
      if (url.endsWith("/session/check")) return jsonResponse(200, { ok: true, status: "ok", note: "session_ok" });
      return jsonResponse(404, { error: "nope" });
    };
    const started = await startIrissRelayLogin(cfg, "auto1", { fetchImpl });
    expect(started.ok).toBe(true);
    expect(started.vncUrl).toContain("/vnc/");
    expect((await closeIrissRelayLogin(cfg, "auto1", { fetchImpl })).loggedIn).toBe(true);
    expect((await checkIrissRelaySession(cfg, "auto1", { fetchImpl })).ok).toBe(true);
    expect(seen).toEqual([
      "POST https://csdd-relay.provin.lv/listings/login/auto1",
      "POST https://csdd-relay.provin.lv/listings/login/auto1/close",
      "POST https://csdd-relay.provin.lv/listings/session/check",
    ]);
  });
});
