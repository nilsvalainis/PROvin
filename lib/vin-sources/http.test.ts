import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { resetVinHttpProxyAgentsForTests, vinHttpFetch, vinHttpProxyFailureCode } from "@/lib/vin-sources/http";

const PROXY = "http://vinuser:vinpass123@proxy.test.invalid:3128";

function tunnelError(code: string): Error {
  const cause = Object.assign(new Error(`connect ${code} 10.0.0.1:3128`), { code });
  return new TypeError("fetch failed", { cause });
}

type FetchCall = [string, RequestInit & { dispatcher?: unknown }];

describe("vinHttpFetch proxy", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetVinHttpProxyAgentsForTests();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    warn.mockRestore();
  });

  it("proxy savienojuma kļūdas gadījumā vienu reizi mēģina tieši", async () => {
    fetchMock
      .mockRejectedValueOnce(tunnelError("ECONNREFUSED"))
      .mockResolvedValueOnce(new Response("<html>ok</html>", { status: 200 }));

    const out = await vinHttpFetch("https://www.mnt.ee/x", { proxyUrl: PROXY });

    expect(out.status).toBe(200);
    expect(out.text).toBe("<html>ok</html>");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const calls = fetchMock.mock.calls as FetchCall[];
    expect(calls[0][1].dispatcher).toBeDefined();
    expect(calls[1][1].dispatcher).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    const logged = String(warn.mock.calls[0][0]);
    expect(JSON.parse(logged)).toMatchObject({ vinHttp: true, event: "proxy_failed_direct_retry", code: "ECONNREFUSED" });
    expect(logged).not.toContain("vinpass123");
    expect(logged).not.toContain("proxy.test.invalid");
  });

  it("proxy 407 tunelī (undici kļūda) un 407 atbilde arī dod tiešu mēģinājumu", async () => {
    const err407 = Object.assign(new Error("Proxy response (407) !== 200 when HTTP Tunneling"), {
      code: "UND_ERR_ABORTED",
    });
    fetchMock
      .mockRejectedValueOnce(new TypeError("fetch failed", { cause: err407 }))
      .mockResolvedValueOnce(new Response("a", { status: 200 }))
      .mockResolvedValueOnce(new Response("auth", { status: 407 }))
      .mockResolvedValueOnce(new Response("b", { status: 200 }));

    expect((await vinHttpFetch("https://lkf.ee/a", { proxyUrl: PROXY })).text).toBe("a");
    expect((await vinHttpFetch("http://lkf.ee/b", { proxyUrl: PROXY })).text).toBe("b");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const calls = fetchMock.mock.calls as FetchCall[];
    expect(calls[3][1].dispatcher).toBeUndefined();
  });

  it("neatkārto pēc mūsu noildzes", async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          });
        }),
    );

    await expect(vinHttpFetch("https://www.mnt.ee/x", { proxyUrl: PROXY, timeoutMs: 20 })).rejects.toThrow("timeout");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it("neatkārto pēc parastas HTTP 500 atbildes", async () => {
    fetchMock.mockResolvedValueOnce(new Response("server error", { status: 500 }));

    const out = await vinHttpFetch("https://www.mnt.ee/x", { proxyUrl: PROXY });

    expect(out.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("bez proxy kļūdu neatkārto", async () => {
    fetchMock.mockRejectedValueOnce(tunnelError("ECONNREFUSED"));

    await expect(vinHttpFetch("https://www.mnt.ee/x")).rejects.toThrow("fetch failed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("tiešā mēģinājuma kļūda tiek izmesta (tikai viens atkārtojums)", async () => {
    fetchMock.mockRejectedValue(tunnelError("ECONNRESET"));

    await expect(vinHttpFetch("https://www.mnt.ee/x", { proxyUrl: PROXY })).rejects.toThrow("fetch failed");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("vienam proxy URL lieto to pašu ProxyAgent", async () => {
    fetchMock.mockImplementation(async () => new Response("ok", { status: 200 }));

    await vinHttpFetch("https://a.test.invalid/", { proxyUrl: PROXY });
    await vinHttpFetch("https://b.test.invalid/", { proxyUrl: PROXY });
    await vinHttpFetch("https://c.test.invalid/", { proxyUrl: "http://other.test.invalid:8080" });

    const calls = fetchMock.mock.calls as FetchCall[];
    expect(calls[0][1].dispatcher).toBeDefined();
    expect(calls[0][1].dispatcher).toBe(calls[1][1].dispatcher);
    expect(calls[2][1].dispatcher).not.toBe(calls[0][1].dispatcher);
  });
});

describe("vinHttpProxyFailureCode", () => {
  it("atpazīst proxy kļūdas un ignorē noildzi", () => {
    expect(vinHttpProxyFailureCode(tunnelError("ENOTFOUND"))).toBe("ENOTFOUND");
    expect(vinHttpProxyFailureCode(new Error("net::ERR_TUNNEL_CONNECTION_FAILED"))).toBe("PROXY_TUNNEL");
    expect(vinHttpProxyFailureCode(Object.assign(new Error("aborted"), { name: "AbortError" }))).toBeNull();
    expect(vinHttpProxyFailureCode(new Error("timeout"))).toBeNull();
    expect(vinHttpProxyFailureCode(new Error("Unexpected token < in JSON"))).toBeNull();
  });
});
