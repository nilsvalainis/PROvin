import { createHmac } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  adminApiOriginAllowed,
  decideAdminApiGate,
  decidePartnerApiCsrf,
  isAdminApiLoginOrLogoutPath,
  isAdminApiSessionExemptPath,
  isAdminApiWebhookOrCronPath,
} from "@/lib/admin-api-gate";
import { emptyAdminGoogleState, type AdminGoogleState } from "@/lib/admin-google-session-live";
import { ADMIN_GOOGLE_ALLOWED_EMAIL, ADMIN_SESSION_TOKEN_TYP, encodeAdminSessionPayload } from "@/lib/admin-session-token";
import { B2B_DEMO_ADMIN_SECRET_HEADER } from "@/lib/b2b-demo-admin-secret";
import { STAFF_SESSION_TOKEN_TYP } from "@/lib/staff-session-token";

const SECRET = "test-admin-secret-0123456789";
const DEMO_ADMIN = "dedicated-secret-16";

function sessionCookie(exp = Date.now() + 60_000): string {
  const payload = Buffer.from(JSON.stringify({ typ: ADMIN_SESSION_TOKEN_TYP, exp }), "utf8").toString("base64url");
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

const GOOGLE_SUB = "110000000000000000001";
const GOOGLE_NOW = Date.parse("2026-10-21T12:00:00.000Z");

function googleCookie(over: { sid?: string; sub?: string; ver?: number; email?: string; exp?: number } = {}): string {
  const payload = encodeAdminSessionPayload(over.exp ?? GOOGLE_NOW + 60_000, {
    sid: over.sid ?? "ags_1",
    sub: over.sub ?? GOOGLE_SUB,
    ver: over.ver ?? 3,
    email: over.email ?? ADMIN_GOOGLE_ALLOWED_EMAIL,
  });
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function liveGoogleState(over: Partial<AdminGoogleState> = {}): AdminGoogleState {
  return {
    ...emptyAdminGoogleState(),
    pinnedSub: GOOGLE_SUB,
    sessionVersion: 3,
    sessions: [
      {
        id: "ags_1",
        sub: GOOGLE_SUB,
        createdAt: new Date(GOOGLE_NOW - 1000).toISOString(),
        lastSeenAt: new Date(GOOGLE_NOW - 1000).toISOString(),
        ip: "1.1.1.1",
        userAgent: "ua",
        revokedAt: null,
      },
    ],
    ...over,
  };
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

  it("lets a multi-section session through granted APIs only", async () => {
    const payload = Buffer.from(
      JSON.stringify({
        typ: STAFF_SESSION_TOKEN_TYP,
        sid: "ses_abcdefgh",
        uid: "usr_abcdefgh",
        role: "logistics",
        sections: ["logistika", "pavadzimes"],
        exp: Date.now() + 60_000,
      }),
      "utf8",
    ).toString("base64url");
    const sig = createHmac("sha256", SECRET).update(payload).digest("hex");
    const multi = `${payload}.${sig}`;
    expect(
      await decideAdminApiGate(req({ path: "/api/admin/iriss-pavadzimes", staffCookie: multi })),
    ).toEqual({ action: "next" });
    expect(
      await decideAdminApiGate(req({ path: "/api/admin/iriss-pasutijumi", staffCookie: multi })),
    ).toEqual({ action: "forbidden" });
  });

  it("lets Pavadzimes-only staff through waybill APIs and forbids VIN and other agents", async () => {
    const payload = Buffer.from(
      JSON.stringify({
        typ: STAFF_SESSION_TOKEN_TYP,
        sid: "ses_abcdefgh",
        uid: "usr_abcdefgh",
        role: "logistics",
        sections: ["pavadzimes"],
        exp: Date.now() + 60_000,
      }),
      "utf8",
    ).toString("base64url");
    const sig = createHmac("sha256", SECRET).update(payload).digest("hex");
    const cookie = `${payload}.${sig}`;
    expect(
      await decideAdminApiGate(req({ path: "/api/admin/iriss/waybill-requests", staffCookie: cookie })),
    ).toEqual({ action: "next" });
    expect(await decideAdminApiGate(req({ path: "/api/admin/vin-scan", staffCookie: cookie }))).toEqual({
      action: "forbidden",
    });
    expect(await decideAdminApiGate(req({ path: "/api/admin/outvin/purchase", staffCookie: cookie }))).toEqual({
      action: "forbidden",
    });
    expect(await decideAdminApiGate(req({ path: "/api/admin/csdd-tech-data", staffCookie: cookie }))).toEqual({
      action: "forbidden",
    });
  });

  it("lets a logistics session through only on logistics APIs", async () => {
    expect(
      await decideAdminApiGate(req({ path: "/api/admin/iriss/logistika/points", staffCookie: staffCookie() })),
    ).toEqual({ action: "next" });
    expect(
      await decideAdminApiGate(req({ path: "/api/admin/iriss-logistics/orders", staffCookie: staffCookie() })),
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

  it("lets a live Google admin session through after allowlist + session version check", async () => {
    vi.stubEnv("ADMIN_GOOGLE_LOGIN_ENABLED", "1");
    expect(
      await decideAdminApiGate(req({ path: "/api/admin/badges", cookie: googleCookie() }), {
        googleState: liveGoogleState(),
        nowMs: GOOGLE_NOW,
      }),
    ).toEqual({ action: "next" });
  });

  it("rejects a Google cookie after logout-everywhere on every admin API, including logistika and b2b-demo", async () => {
    vi.stubEnv("ADMIN_GOOGLE_LOGIN_ENABLED", "1");
    const cookie = googleCookie({ ver: 3 });
    const revoked = liveGoogleState({ sessionVersion: 4 });
    const opts = { googleState: revoked, nowMs: GOOGLE_NOW };
    for (const path of [
      "/api/admin/badges",
      "/api/admin/iriss/logistika/points",
      "/api/admin/iriss-logistics/orders",
      "/api/admin/b2b-demo/tenants",
    ]) {
      expect(await decideAdminApiGate(req({ path, cookie }), opts), path).toEqual({ action: "unauthorized" });
    }
  });

  it("rejects a Google cookie that is not on the allowlist even if the store is live", async () => {
    vi.stubEnv("ADMIN_GOOGLE_LOGIN_ENABLED", "1");
    expect(
      await decideAdminApiGate(req({ path: "/api/admin/badges", cookie: googleCookie({ email: "other@provin.lv" }) }), {
        googleState: liveGoogleState(),
        nowMs: GOOGLE_NOW,
      }),
    ).toEqual({ action: "unauthorized" });
  });

  it("fails closed in production when Google session state cannot be read", async () => {
    vi.stubEnv("ADMIN_GOOGLE_LOGIN_ENABLED", "1");
    vi.stubEnv("NODE_ENV", "production");
    expect(
      await decideAdminApiGate(req({ path: "/api/admin/badges", cookie: googleCookie() }), {
        loadGoogleState: async () => null,
        nowMs: GOOGLE_NOW,
      }),
    ).toEqual({ action: "unauthorized" });
  });

  it("still lets staff through logistika after Google logout-everywhere", async () => {
    vi.stubEnv("ADMIN_GOOGLE_LOGIN_ENABLED", "1");
    expect(
      await decideAdminApiGate(
        req({ path: "/api/admin/iriss/logistika/points", cookie: googleCookie(), staffCookie: staffCookie() }),
        { googleState: liveGoogleState({ sessionVersion: 4 }), nowMs: GOOGLE_NOW },
      ),
    ).toEqual({ action: "next" });
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

describe("decidePartnerApiCsrf", () => {
  const h = (init: Record<string, string>) => new Headers({ host: "www.provin.lv", ...init });
  it("allows GET without Origin", () => {
    expect(decidePartnerApiCsrf({ method: "GET", headers: h({}) })).toBe("next");
  });
  it("allows same-origin POST", () => {
    expect(decidePartnerApiCsrf({ method: "POST", headers: h({ "sec-fetch-site": "same-origin" }) })).toBe("next");
    expect(decidePartnerApiCsrf({ method: "POST", headers: h({ origin: "https://www.provin.lv" }) })).toBe("next");
  });
  it("blocks cross-site and same-site subdomain POST", () => {
    expect(decidePartnerApiCsrf({ method: "POST", headers: h({ origin: "https://evil.example" }) })).toBe(
      "forbidden_origin",
    );
    expect(
      decidePartnerApiCsrf({ method: "POST", headers: h({ origin: "https://demo.provin.lv", "sec-fetch-site": "same-site" }) }),
    ).toBe("forbidden_origin");
    expect(decidePartnerApiCsrf({ method: "DELETE", headers: h({}) })).toBe("forbidden_origin");
  });
});
