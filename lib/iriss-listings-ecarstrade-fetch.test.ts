import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ecarstradeAuthCookieHeader, fetchEcarstradeSource, parseEcarstradeLoginBody } from "@/lib/iriss-listings-ecarstrade-fetch";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__", "iriss-ecarstrade");
const SRC = "https://ecarstrade.com/search?mark[]=68";

function apiPage(ids: string[], extra = ""): string {
  const html = readFileSync(join(FIX, "card-volvo.html"), "utf8");
  const parts = ["{}"];
  for (const id of ids) {
    const card = html.replaceAll("7672194", id);
    parts.push(
      JSON.stringify({
        status: "101",
        car_id: id,
        data: { id, max_bid: "1000" },
        result: Buffer.from(card, "utf8").toString("base64"),
      }),
    );
  }
  return parts.join("") + extra;
}

function fetchMock(handler: (url: string, init?: RequestInit) => { status: number; body: string } | Error) {
  const calls: Array<{ url: string; cookie: string; method: string; auth: string }> = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    calls.push({
      url,
      cookie: headers.get("cookie") ?? "",
      method: init?.method ?? "GET",
      auth: headers.get("authorization") ?? "",
    });
    const r = handler(url, init);
    if (r instanceof Error) throw r;
    return new Response(r.body, { status: r.status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

function tucsonPublicPage(): string {
  const html = readFileSync(join(FIX, "card-tucson-public.html"), "utf8");
  return (
    "{}" +
    JSON.stringify({
      status: "200",
      car_id: "7602956",
      data: { id: "7602956", max_bid: null, close_date: "31 Dec 2036 23:59", close_time: false },
      result: Buffer.from(html, "utf8").toString("base64"),
    })
  );
}

const opts = { maxPages: 3, timeoutMs: 8000, pauseMinMs: 0, pauseMaxMs: 0, perPage: 1, sleep: async () => undefined, env: {} };

describe("fetchEcarstradeSource", () => {
  it("walks future_api pages without credentials and still returns cars", async () => {
    const { impl, calls } = fetchMock((url) => {
      if (url.includes("/api/v1/auth/login")) return { status: 422, body: "{}" };
      const start = Number(new URL(url).searchParams.get("start") ?? "0");
      if (start === 0) return { status: 200, body: apiPage(["1"]) };
      return { status: 200, body: apiPage(["2"]) };
    });
    const r = await fetchEcarstradeSource(SRC, { ...opts, fetchImpl: impl });
    expect(r.status).toBe("ok");
    expect(r.loggedIn).toBe(false);
    expect(r.note).toMatch(/publiski/i);
    expect(r.vehicles.map((v) => v.externalId)).toEqual(["1", "2"]);
    expect(r.pagesFetched).toBeGreaterThanOrEqual(2);
    expect(calls.some((c) => c.url.includes("/api/v1/auth/login"))).toBe(false);
    expect(calls[0]!.url).toContain("future_api.php");
    expect(new URL(calls[0]!.url).searchParams.getAll("country[]")).toEqual(["BEL", "NET", "LUX", "GER"]);
  });

  it("logs in with {username,password} (not email) and stores data.accessToken / data.refreshToken", async () => {
    const bodies: string[] = [];
    const accepts: string[] = [];
    const { impl, calls } = fetchMock((url, init) => {
      if (url.includes("/api/v1/auth/login")) {
        bodies.push(String(init?.body ?? ""));
        accepts.push(new Headers(init?.headers).get("accept") ?? "");
        return { status: 200, body: JSON.stringify({ data: { accessToken: "tok-a", refreshToken: "tok-r" } }) };
      }
      return { status: 200, body: apiPage(["9"]) };
    });
    const r = await fetchEcarstradeSource(SRC, {
      ...opts,
      fetchImpl: impl,
      env: { ECARSTRADE_USER: "sia-iriss@inbox.lv", ECARSTRADE_PASS: "x" },
    });
    expect(r.status).toBe("ok");
    expect(r.loggedIn).toBe(true);
    expect(calls[0]!.url).toBe("https://ecarstrade.com/api/v1/auth/login");
    expect(calls[0]!.method).toBe("POST");
    expect(accepts[0]).toMatch(/application\/json/);
    expect(JSON.parse(bodies[0]!)).toEqual({ username: "sia-iriss@inbox.lv", password: "x" });
    expect(bodies[0]).not.toContain("email");
    expect(calls[1]!.cookie).toBe(ecarstradeAuthCookieHeader("tok-a", "tok-r"));
    expect(r.vehicles[0]!.externalId).toBe("9");
  });

  it("maps 403 / 401 / 500 on the first page", async () => {
    const r403 = await fetchEcarstradeSource(SRC, { ...opts, fetchImpl: fetchMock(() => ({ status: 403, body: "" })).impl });
    expect(r403.status).toBe("blocked_by_waf");
    const r401 = await fetchEcarstradeSource(SRC, { ...opts, fetchImpl: fetchMock(() => ({ status: 401, body: "" })).impl });
    expect(r401.status).toBe("login_required");
    const r500 = await fetchEcarstradeSource(SRC, { ...opts, fetchImpl: fetchMock(() => ({ status: 500, body: "" })).impl });
    expect(r500.status).toBe("fetch_failed");
  });

  it("flags parse failure when the body is not a card stream", async () => {
    const r = await fetchEcarstradeSource(SRC, {
      ...opts,
      fetchImpl: fetchMock(() => ({ status: 200, body: "<html>Just a moment...</html>" })).impl,
    });
    expect(r.status).toBe("parse_failed");
    expect(r.rawPages[0]).toContain("Just a moment");
  });

  it("parses login tokens from the Laravel envelope", () => {
    expect(parseEcarstradeLoginBody({ data: { accessToken: "a", refreshToken: "b" } })).toEqual({
      accessToken: "a",
      refreshToken: "b",
    });
    expect(parseEcarstradeLoginBody({ access_token: "z" })).toEqual({ accessToken: "z", refreshToken: "" });
    expect(parseEcarstradeLoginBody({ errors: [] })).toBeNull();
  });

  it("enriches a logged-in stock card from /api/v1/cars with Bearer and skips the 2036 close", async () => {
    const { impl, calls } = fetchMock((url) => {
      if (url.includes("/api/v1/auth/login")) {
        return { status: 200, body: JSON.stringify({ data: { accessToken: "tok-a", refreshToken: "tok-r" } }) };
      }
      if (url.includes("/api/v1/cars/7602956")) {
        return {
          status: 200,
          body: JSON.stringify({
            data: { id: "7602956", auction_type: "stock", buy_now_price: 16200, total_price: 16500, close_date: "31 Dec 2036 23:59" },
          }),
        };
      }
      return { status: 200, body: tucsonPublicPage() };
    });
    const r = await fetchEcarstradeSource(SRC, {
      ...opts,
      fetchImpl: impl,
      env: { ECARSTRADE_USER: "sia-iriss@inbox.lv", ECARSTRADE_PASS: "x" },
    });
    expect(r.status).toBe("ok");
    expect(r.loggedIn).toBe(true);
    expect(r.vehicles).toHaveLength(1);
    expect(r.vehicles[0]).toMatchObject({
      externalId: "7602956",
      priceBuyNow: 16200,
      priceCurrent: null,
      auctionEndAt: "",
      auctionStage: "STOCK",
    });
    const carCall = calls.find((c) => c.url.includes("/api/v1/cars/7602956"));
    expect(carCall?.auth).toBe("Bearer tok-a");
    expect(carCall?.cookie).toContain("eCT/user=tok-a");
    expect(r.note).toMatch(/Cenas no \/api\/v1\/cars/);
  });
});
