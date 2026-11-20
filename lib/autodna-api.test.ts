import { afterEach, describe, expect, it, vi } from "vitest";
import { testEnv } from "@/lib/test-process-env";

vi.mock("server-only", () => ({}));

describe("readFixieProxyUrl / withAutodnaFixieProxy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not attach a dispatcher when FIXIE_URL is missing", async () => {
    vi.stubEnv("FIXIE_URL", "");
    const { withAutodnaFixieProxy } = await import("@/lib/autodna-api");
    const init = { method: "POST", cache: "no-store" as const };
    expect(withAutodnaFixieProxy(init, { ...process.env, FIXIE_URL: "" })).toEqual(init);
  });

  it("rejects a malformed FIXIE_URL instead of sending traffic through it", async () => {
    const { readFixieProxyUrl } = await import("@/lib/autodna-api");
    expect(readFixieProxyUrl(testEnv({ FIXIE_URL: "not-a-url" }))).toBeNull();
    expect(readFixieProxyUrl(testEnv({ FIXIE_URL: "ftp://proxy.example" }))).toBeNull();
  });

  it("attaches a dispatcher only when FIXIE_URL is a valid http(s) proxy", async () => {
    const { withAutodnaFixieProxy } = await import("@/lib/autodna-api");
    const proxy = "http://fixie:secret@group.usefixie.com:80";
    const out = withAutodnaFixieProxy({ method: "POST" }, testEnv({ FIXIE_URL: proxy }));
    expect(out.method).toBe("POST");
    expect(out.dispatcher).toBeTruthy();
    expect(out.dispatcher?.constructor.name).toBe("ProxyAgent");
  });
});

describe("createAutodnaFixieDispatcher", () => {
  it("vienam proxy URL lieto to pašu ProxyAgent, citam - citu", async () => {
    const { createAutodnaFixieDispatcher } = await import("@/lib/autodna-api");
    const a = createAutodnaFixieDispatcher("http://u:p@proxy-a.example:80");
    expect(createAutodnaFixieDispatcher("http://u:p@proxy-a.example:80")).toBe(a);
    expect(createAutodnaFixieDispatcher("http://u:p@proxy-b.example:80")).not.toBe(a);
  });
});
