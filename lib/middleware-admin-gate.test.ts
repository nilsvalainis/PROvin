import { createHmac } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import middleware from "../middleware";

vi.mock("next-intl/middleware", () => ({ default: () => () => NextResponse.next() }));

const SECRET = "test-admin-secret-0123456789";

function sessionCookie(exp = Date.now() + 60_000): string {
  const payload = Buffer.from(JSON.stringify({ exp }), "utf8").toString("base64url");
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex");
  return `provin_admin_session=${payload}.${sig}`;
}

function req(url: string, cookie?: string): NextRequest {
  const u = new URL(url);
  return new NextRequest(u, { headers: { host: u.host, ...(cookie ? { cookie } : {}) } });
}

describe("middleware admin gate", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_SECRET", SECRET);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    "/admin",
    "/admin/dashboard",
    "/admin/iriss/pasutijumi",
    "/admin/iriss/sludinajumi",
    "/admin/iriss/pasutijumi/00000000-0000-4000-8000-000000000000",
    "/admin/orders/cs_test_1",
  ])("redirects %s to login without a session, with an empty body", async (path) => {
    const res = await middleware(req(`https://www.provin.lv${path}?room=search`));
    expect(res.status).toBe(307);
    const loc = new URL(res.headers.get("location")!);
    expect(loc.pathname).toBe("/admin/login");
    expect(loc.searchParams.get("next")).toBe(`${path}?room=search`);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.text()).toBe("");
  });

  it("redirects with an expired or forged cookie", async () => {
    expect((await middleware(req("https://www.provin.lv/admin/dashboard", sessionCookie(Date.now() - 1)))).status).toBe(307);
    expect((await middleware(req("https://www.provin.lv/admin/dashboard", "provin_admin_session=abc.def"))).status).toBe(307);
  });

  it("lets a valid session through and keeps the intended path header", async () => {
    const res = await middleware(req("https://www.provin.lv/admin/iriss/pasutijumi", sessionCookie()));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-request-x-admin-intended-path")).toBe("/admin/iriss/pasutijumi");
  });

  it("does not gate the login page", async () => {
    const res = await middleware(req("https://www.provin.lv/admin/login?next=%2Fadmin%2Fdashboard"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it.each(["/api/admin/badges", "/api/admin/login", "/api/cron/morning-summary", "/api/webhooks/stripe", "/api/b2b-demo/login"])(
    "leaves API route %s to its own auth",
    async (path) => {
      const res = await middleware(req(`https://www.provin.lv${path}`));
      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    },
  );

  it("leaves B2B demo pages to their own session", async () => {
    const res = await middleware(req("https://demo.provin.lv/b2b-demo/pasutijumi"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("does not touch public pages", async () => {
    const res = await middleware(req("https://www.provin.lv/lv"));
    expect(res.headers.get("location") ?? "").not.toContain("/admin/login");
  });
});
