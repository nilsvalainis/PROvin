import { createHmac } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  adminApiOriginAllowed,
  decideAdminApiGate,
  isAdminApiLoginOrLogoutPath,
  isAdminApiSessionExemptPath,
  isAdminApiWebhookOrCronPath,
} from "@/lib/admin-api-gate";
import { ADMIN_SESSION_TOKEN_TYP } from "@/lib/admin-session-token";
import { B2B_DEMO_ADMIN_SECRET_HEADER } from "@/lib/b2b-demo-admin-secret";
import { STAFF_SESSION_TOKEN_TYP } from "@/lib/staff-session-token";

const SECRET = "test-admin-secret-0123456789";
const DEMO_ADMIN = "dedicated-secret-16";

function sessionCookie(exp = Date.now() + 60_000): string {
  const payload = Buffer.from(JSON.stringify({ typ: ADMIN_SESSION_TOKEN_TYP, exp }), "utf8").toString("base64url");
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex");
  return `${payload}.${sig}`;
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
  return `${payload}.${sig}`;
}

function headers(init: Record<string, string>): Headers {
  return new Headers(init);
}

function req(opts: {
  path: string;
  method?: string;
  cookie?: string;
  staffCookie?: string;
  origin?: string;
  referer?: string;
  host?: string;
  extra?: Record<string, string>;
}) {
  const host = opts.host ?? "www.provin.lv";
  const h: Record<string, string> = {
    host,
    "x-forwarded-proto": host.includes("localhost") ? "http" : "https",
    ...opts.extra,
  };
  if (opts.origin) h.origin = opts.origin;
  if (opts.referer) h.referer = opts.referer;
  return {
    nextUrl: { pathname: opts.path },
    method: opts.method ?? "GET",
    headers: headers(h),
    cookies: {
      get(name: string) {
        if (name === "provin_admin_session" && opts.cookie) return { value: opts.cookie };
        if (name === "provin_staff_session" && opts.staffCookie) return { value: opts.staffCookie };
        return undefined;
      },
    },
  };
}

describe("admin API gate helpers", () => {
  it("exempts login/logout from session, not ordinary admin APIs", () => {
    expect(isAdminApiLoginOrLogoutPath("/api/admin/login")).toBe(true);
    expect(isAdminApiLoginOrLogoutPath("/api/admin/logout")).toBe(true);
    expect(isAdminApiSessionExemptPath("/api/admin/login")).toBe(true);
    expect(isAdminApiSessionExemptPath("/api/admin/badges")).toBe(false);
  });

  it("exempts webhook/cron paths under /api/admin if they exist later", () => {
    expect(isAdminApiWebhookOrCronPath("/api/admin/webhooks/stripe")).toBe(true);
    expect(isAdminApiWebhookOrCronPath("/api/admin/cron/morning-summary")).toBe(true);
    expect(isAdminApiWebhookOrCronPath("/api/admin/badges")).toBe(false);
  });

  it("allows same-host Origin and Referer, rejects other sites and same-site demo host", () => {
    const h = headers({ host: "www.provin.lv", "x-forwarded-proto": "https", origin: "https://www.provin.lv" });
    expect(adminApiOriginAllowed(h)).toBe(true);
    expect(
      adminApiOriginAllowed(headers({ host: "www.provin.lv", "x-forwarded-proto": "https", origin: "https://provin.lv" })),
    ).toBe(true);
    expect(
      adminApiOriginAllowed(
        headers({ host: "www.provin.lv", "x-forwarded-proto": "https", referer: "https://www.provin.lv/admin" }),
      ),
    ).toBe(true);
    expect(
      adminApiOriginAllowed(headers({ host: "www.provin.lv", "x-forwarded-proto": "https", origin: "https://evil.example" })),
    ).toBe(false);
    expect(
      adminApiOriginAllowed(
        headers({ host: "www.provin.lv", "x-forwarded-proto": "https", origin: "https://demo.provin.lv" }),
      ),
    ).toBe(false);
    expect(adminApiOriginAllowed(headers({ host: "www.provin.lv", "x-forwarded-proto": "https" }))).toBe(false);
  });

  it("accepts Sec-Fetch-Site same-origin, not same-site", () => {
    expect(
      adminApiOriginAllowed(
        headers({ host: "www.provin.lv", "x-forwarded-proto": "https", "sec-fetch-site": "same-origin" }),
      ),
    ).toBe(true);
    expect(
      adminApiOriginAllowed(
        headers({ host: "www.provin.lv", "x-forwarded-proto": "https", "sec-fetch-site": "same-site" }),
      ),
    ).toBe(false);
  });
});

describe("decideAdminApiGate", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_SECRET", SECRET);
    vi.stubEnv("B2B_DEMO_ADMIN_SECRET", DEMO_ADMIN);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lets login through without a session", async () => {
    expect(await decideAdminApiGate(req({ path: "/api/admin/login" }))).toEqual({ action: "next" });
  });

  it("requires Origin on login POST", async () => {
    expect(await decideAdminApiGate(req({ path: "/api/admin/login", method: "POST" }))).toEqual({
      action: "forbidden_origin",
    });
    expect(
      await decideAdminApiGate(
        req({ path: "/api/admin/login", method: "POST", origin: "https://www.provin.lv" }),
      ),
    ).toEqual({ action: "next" });
  });

  it("rejects admin APIs without a session", async () => {
    expect(await decideAdminApiGate(req({ path: "/api/admin/badges" }))).toEqual({ action: "unauthorized" });
    expect(await decideAdminApiGate(req({ path: "/api/admin/partners/invites", method: "GET" }))).toEqual({
      action: "unauthorized",
    });
  });

  it("lets a typed admin session through on GET", async () => {
    expect(await decideAdminApiGate(req({ path: "/api/admin/badges", cookie: sessionCookie() }))).toEqual({
      action: "next",
    });
  });

  it("rejects a forged exp-only cookie on admin APIs", async () => {
    const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 60_000 }), "utf8").toString("base64url");
    const sig = createHmac("sha256", SECRET).update(payload).digest("hex");
    expect(await decideAdminApiGate(req({ path: "/api/admin/badges", cookie: `${payload}.${sig}` }))).toEqual({
      action: "unauthorized",
    });
  });

  it("requires Origin on mutating admin APIs even with a session", async () => {
    const cookie = sessionCookie();
    expect(
      await decideAdminApiGate(req({ path: "/api/admin/partners", method: "POST", cookie })),
    ).toEqual({ action: "forbidden_origin" });
    expect(
      await decideAdminApiGate(
        req({
          path: "/api/admin/partners",
          method: "POST",
          cookie,
          origin: "https://evil.example",
        }),
      ),
    ).toEqual({ action: "forbidden_origin" });
    expect(
      await decideAdminApiGate(
        req({
          path: "/api/admin/partners",
          method: "POST",
          cookie,
          origin: "https://www.provin.lv",
        }),
      ),
    ).toEqual({ action: "next" });
  });

  it("skips session and Origin for /api/admin webhook/cron paths", async () => {
    expect(await decideAdminApiGate(req({ path: "/api/admin/webhooks/stripe", method: "POST" }))).toEqual({
      action: "next",
    });
    expect(await decideAdminApiGate(req({ path: "/api/admin/cron/morning-summary", method: "POST" }))).toEqual({
      action: "next",
    });
  });

  it("lets a logistics session through only on logistics APIs", async () => {
    expect(
      await decideAdminApiGate(req({ path: "/api/admin/iriss/logistika/points", staffCookie: staffCookie() })),
    ).toEqual({ action: "next" });
    expect(await decideAdminApiGate(req({ path: "/api/admin/badges", staffCookie: staffCookie() }))).toEqual({
      action: "forbidden",
    });
    expect(await decideAdminApiGate(req({ path: "/api/admin/staff/users", staffCookie: staffCookie() }))).toEqual({
      action: "forbidden",
    });
  });

  it("lets invite accept through without a session", async () => {
    expect(await decideAdminApiGate(req({ path: "/api/admin/staff/accept-invite" }))).toEqual({ action: "next" });
  });

  it("lets b2b-demo platform scripts through with the dedicated header", async () => {
    expect(
      await decideAdminApiGate(
        req({
          path: "/api/admin/b2b-demo/tenants",
          method: "POST",
          extra: { [B2B_DEMO_ADMIN_SECRET_HEADER]: DEMO_ADMIN },
        }),
      ),
    ).toEqual({ action: "next" });
    expect(
      await decideAdminApiGate(
        req({
          path: "/api/admin/b2b-demo/tenants",
          method: "POST",
          extra: { [B2B_DEMO_ADMIN_SECRET_HEADER]: "wrong-secret-value" },
        }),
      ),
    ).toEqual({ action: "unauthorized" });
  });
});
