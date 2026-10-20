import { describe, expect, it } from "vitest";
import { getClientIpFromHeaders } from "./client-ip";

describe("getClientIpFromHeaders", () => {
  it("prefers Vercel edge headers over client-controllable x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "6.6.6.6, 1.1.1.1", "x-real-ip": "2.2.2.2", "x-vercel-forwarded-for": "3.3.3.3" });
    expect(getClientIpFromHeaders(h)).toBe("3.3.3.3");
    expect(getClientIpFromHeaders(new Headers({ "x-forwarded-for": "6.6.6.6", "x-real-ip": "2.2.2.2" }))).toBe("2.2.2.2");
    expect(getClientIpFromHeaders(new Headers({ "x-forwarded-for": "6.6.6.6, 1.1.1.1" }))).toBe("6.6.6.6");
    expect(getClientIpFromHeaders(new Headers())).toBe("unknown");
  });
});
