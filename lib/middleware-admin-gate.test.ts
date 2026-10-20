import { createHmac } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import middleware from "../middleware";
import { STAFF_SESSION_TOKEN_TYP } from "@/lib/staff-session-token";

vi.mock("next-intl/middleware", () => ({ default: () => () => NextResponse.next() }));

const SECRET = "test-admin-secret-0123456789";

function sessionCookie(exp = Date.now() + 60_000): string {
  const payload = Buffer.from(JSON.stringify({ typ: "admin", exp }), "utf8").toString("base64url");
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex");
  return `provin_admin_session=${payload}.${sig}`;
}

function staffCookie(exp = Date.now() + 60_000): string {
  const payload = Buffer.from(
    JSON.stringify({
      typ: STAFF_SESSION_TOKEN_TYP,
      sid: "ses_abcdefgh",
      uid: "usr_abcdefgh",
      role: "logistics",
      exp,
    }),
    "utf8",
  ).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex");
  return `provin_staff_session=${payload}.${sig}`;
}

function req(url: string, cookie?: string): NextRequest {
  const u = new URL(url);
  return new NextRequest(u, { headers: { host: u.host, ...(cookie ? { cookie } : {}) } });
}

function reqInit(url: string, init: { cookie?: string; method?: string; origin?: string; extra?: Record<string, string> }): NextRequest {
  const u = new URL(url);
  const headers: Record<string, string> = { host: u.host, ...init.extra };
  if (init.cookie) headers.cookie = init.cookie;
  if (init.origin) headers.origin = init.origin;
  return new NextRequest(u, { method: init.method ?? "GET", headers });
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

  it.each(["/api/cron/morning-summary", "/api/webhooks/stripe", "/api/b2b-demo/login"])(
    "leaves non-admin API route %s to its own auth",
    async (path) => {
      const res = await middleware(req(`https://www.provin.lv${path}`));
      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    },
  );

  it("does not require a session for /api/admin/login", async () => {
    const res = await middleware(req("https://www.provin.lv/api/admin/login"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("blocks /api/admin/* without an admin session", async () => {
    const res = await middleware(req("https://www.provin.lv/api/admin/badges"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("lets a typed admin session through /api/admin GET", async () => {
    const res = await middleware(req("https://www.provin.lv/api/admin/badges", sessionCookie()));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("rejects mutating /api/admin from a foreign Origin even with a session", async () => {
    const res = await middleware(
      reqInit("https://www.provin.lv/api/admin/partners", {
        method: "POST",
        cookie: sessionCookie(),
        origin: "https://evil.example",
      }),
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden origin" });
  });

  it("allows mutating /api/admin from the site Origin with a session", async () => {
    const res = await middleware(
      reqInit("https://www.provin.lv/api/admin/partners", {
        method: "POST",
        cookie: sessionCookie(),
        origin: "https://www.provin.lv",
      }),
    );
    expect(res.status).toBe(200);
  });

  it("leaves B2B demo pages to their own session", async () => {
    const res = await middleware(req("https://demo.provin.lv/b2b-demo/pasutijumi"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("leaves unpaid payment short links without a locale prefix", async () => {
    const res = await middleware(req("https://www.provin.lv/apmaksa/abcdefghij0123456789ab"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("lets logistics open only the logistika page and redirects other admin pages", async () => {
    const ok = await middleware(req("https://www.provin.lv/admin/iriss/logistika", staffCookie()));
    expect(ok.status).toBe(200);
    const denied = await middleware(req("https://www.provin.lv/admin/iriss/pasutijumi", staffCookie()));
    expect(denied.status).toBe(307);
    expect(new URL(denied.headers.get("location")!).pathname).toBe("/admin/iriss/logistika");
  });

  it("does not gate the invite accept page", async () => {
    const res = await middleware(req("https://www.provin.lv/admin/uzaicinajums/abc"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("returns 403 for logistics on PRO/IRISS admin APIs", async () => {
    const res = await middleware(req("https://www.provin.lv/api/admin/badges", staffCookie()));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden" });
    const allowed = await middleware(req("https://www.provin.lv/api/admin/iriss/logistika/points", staffCookie()));
    expect(allowed.status).toBe(200);
    const storeApi = await middleware(req("https://www.provin.lv/api/admin/iriss-logistics/orders", staffCookie()));
    expect(storeApi.status).toBe(200);
  });

  it("does not touch public pages", async () => {
    const res = await middleware(req("https://www.provin.lv/lv"));
    expect(res.headers.get("location") ?? "").not.toContain("/admin/login");
  });
});
