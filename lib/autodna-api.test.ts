import { afterEach, describe, expect, it, vi } from "vitest";

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
    expect(readFixieProxyUrl({ FIXIE_URL: "not-a-url" })).toBeNull();
    expect(readFixieProxyUrl({ FIXIE_URL: "ftp://proxy.example" })).toBeNull();
  });

  it("attaches a dispatcher only when FIXIE_URL is a valid http(s) proxy", async () => {
    const { withAutodnaFixieProxy } = await import("@/lib/autodna-api");
    const proxy = "http://fixie:secret@group.usefixie.com:80";
    const out = withAutodnaFixieProxy({ method: "POST" }, { FIXIE_URL: proxy });
    expect(out.method).toBe("POST");
    expect(out.dispatcher).toBeTruthy();
    expect(out.dispatcher?.constructor.name).toBe("ProxyAgent");
  });
});
