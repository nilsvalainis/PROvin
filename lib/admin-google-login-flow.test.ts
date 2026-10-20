import { createSign, generateKeyPairSync } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/** Sīkdatņu "burka" `next/headers` vietā: route handler un `getAdminSession` lieto to pašu. */
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string, opts?: { maxAge?: number }) => {
      if (opts?.maxAge === 0 || value === "") jar.delete(name);
      else jar.set(name, value);
    },
  }),
  headers: async () => new Headers(),
}));

const CLIENT_ID = "flow-client.apps.googleusercontent.com";
const SUB = "110000000000000000001";
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...(publicKey.export({ format: "jwk" }) as object), kid: "k1", alg: "RS256", use: "sig" };

let nextClaims: Record<string, unknown> = {};
let tmp = "";

function idToken(claims: Record<string, unknown>): string {
  const h = Buffer.from(JSON.stringify({ alg: "RS256", kid: "k1" })).toString("base64url");
  const p = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${h}.${p}.${createSign("RSA-SHA256").update(`${h}.${p}`).sign(privateKey).toString("base64url")}`;
}

const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input);
  if (url === "https://www.googleapis.com/oauth2/v3/certs") {
    return new Response(JSON.stringify({ keys: [jwk] }), { headers: { "cache-control": "max-age=3600" } });
  }
  if (url === "https://oauth2.googleapis.com/token") {
    const body = new URLSearchParams(String(init?.body));
    if (!body.get("code_verifier") || body.get("client_id") !== CLIENT_ID) return new Response("{}", { status: 400 });
    return new Response(JSON.stringify({ id_token: idToken(nextClaims) }));
  }
  return new Response("nope", { status: 404 });
});

let ipCounter = 0;
function freshIp(): string {
  ipCounter += 1;
  return `10.0.0.${ipCounter}`;
}

async function startLogin(ip: string) {
  const { GET } = await import("@/app/api/admin/login/google/route");
  const res = await GET(new Request("https://www.provin.lv/api/admin/login/google?next=/admin/orders", {
    headers: { "x-real-ip": ip },
  }));
  const location = new URL(res.headers.get("location")!);
  const flowCookie = res.cookies.get("provin_admin_google_oauth")!.value;
  return { res, location, flowCookie, state: location.searchParams.get("state")!, nonce: location.searchParams.get("nonce")! };
}

async function callback(ip: string, flowCookie: string | null, state: string, code = "auth-code") {
  const { GET } = await import("@/app/api/admin/login/google/callback/route");
  const headers: Record<string, string> = { "x-real-ip": ip, "user-agent": "vitest-ua" };
  if (flowCookie) headers.cookie = `provin_admin_google_oauth=${flowCookie}`;
  const url = `https://www.provin.lv/api/admin/login/google/callback?state=${encodeURIComponent(state)}&code=${code}`;
  return GET(new NextRequest(url, { headers }));
}

function goodClaims(nonce: string, over: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: "https://accounts.google.com",
    aud: CLIENT_ID,
    azp: CLIENT_ID,
    sub: SUB,
    email: "info@provin.lv",
    email_verified: true,
    hd: "provin.lv",
    nonce,
    iat: now,
    exp: now + 3600,
    ...over,
  };
}

async function loginWith(over: Record<string, unknown> = {}) {
  const ip = freshIp();
  const { flowCookie, state, nonce } = await startLogin(ip);
  nextClaims = goodClaims(nonce, over);
  return callback(ip, flowCookie, state);
}

describe("admin Google login flow (route handlers + server session check)", () => {
  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "provin-admin-google-"));
    vi.spyOn(process, "cwd").mockReturnValue(tmp);
    vi.stubGlobal("fetch", fetchMock);
  });
  afterAll(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    fs.rmSync(tmp, { recursive: true, force: true });
  });
  beforeEach(() => {
    jar.clear();
    vi.stubEnv("ADMIN_SECRET", "test-admin-secret-0123456789");
    vi.stubEnv("ADMIN_GOOGLE_LOGIN_ENABLED", "1");
    vi.stubEnv("ADMIN_GOOGLE_CLIENT_ID", CLIENT_ID);
    vi.stubEnv("ADMIN_GOOGLE_CLIENT_SECRET", "client-secret-for-tests");
    vi.stubEnv("ADMIN_GOOGLE_SUB", "");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("VERCEL", "");
  });

  it("returns 404 on both routes while the flag is off", async () => {
    vi.stubEnv("ADMIN_GOOGLE_LOGIN_ENABLED", "");
    const start = await import("@/app/api/admin/login/google/route");
    const res = await start.GET(new Request("https://www.provin.lv/api/admin/login/google"));
    expect(res.status).toBe(404);
    const res2 = await callback(freshIp(), null, "x");
    expect(res2.status).toBe(404);
  });

  it("logs in info@provin.lv, pins sub, and the server accepts the session", async () => {
    const res = await loginWith();
    expect(res.status).toBe(303);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/admin/orders");
    expect(jar.has("provin_admin_session")).toBe(true);
    const { getAdminSession } = await import("@/lib/admin-auth");
    expect(await getAdminSession()).toBe(true);
    const { readAdminGoogleState } = await import("@/lib/admin-google-sessions");
    const state = await readAdminGoogleState();
    expect(state.pinnedSub).toBe(SUB);
    const success = state.audit.find((a) => a.action === "login_success")!;
    expect(success.ip).toMatch(/^10\.0\.0\./);
    expect(success.userAgent).toBe("vitest-ua");
    expect(success.at).toBeTruthy();
  });

  const rejected: Array<[string, Record<string, unknown>]> = [
    ["other Google account (different sub)", { sub: "220000000000000000002" }],
    ["other e-mail", { email: "someone@provin.lv" }],
    ["other hd", { hd: "gmail.com" }],
    ["email_verified=false", { email_verified: false }],
    ["wrong aud", { aud: "other-client", azp: "other-client" }],
    ["wrong iss", { iss: "https://login.evil.example" }],
    ["expired", { exp: Math.floor(Date.now() / 1000) - 7200 }],
    ["wrong nonce", { nonce: "replayed-nonce" }],
  ];

  it.each(rejected)("rejects %s and issues no session", async (_name, over) => {
    const res = await loginWith(over);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/admin/login?google_error=1");
    expect(jar.has("provin_admin_session")).toBe(false);
  });

  it("rejects an invalid signature", async () => {
    const ip = freshIp();
    const { flowCookie, state, nonce } = await startLogin(ip);
    const { privateKey: other } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const claims = goodClaims(nonce);
    const h = Buffer.from(JSON.stringify({ alg: "RS256", kid: "k1" })).toString("base64url");
    const p = Buffer.from(JSON.stringify(claims)).toString("base64url");
    const forged = `${h}.${p}.${createSign("RSA-SHA256").update(`${h}.${p}`).sign(other).toString("base64url")}`;
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ id_token: forged })));
    const res = await callback(ip, flowCookie, state);
    expect(res.headers.get("location")).toContain("google_error=1");
    expect(jar.has("provin_admin_session")).toBe(false);
  });

  it("rejects a wrong state and a missing flow cookie", async () => {
    const ip = freshIp();
    const { flowCookie, nonce } = await startLogin(ip);
    nextClaims = goodClaims(nonce);
    expect((await callback(ip, flowCookie, "attacker-state")).headers.get("location")).toContain("google_error=1");
    expect((await callback(ip, null, "whatever")).headers.get("location")).toContain("google_error=1");
    expect(jar.has("provin_admin_session")).toBe(false);
  });

  it("rate-limits the callback route", async () => {
    const ip = freshIp();
    let last: Response | null = null;
    for (let i = 0; i < 11; i++) last = await callback(ip, null, "x");
    expect(last!.status).toBe(429);
  });

  it("logout revokes the session; logout-all invalidates every session", async () => {
    const { getAdminSession } = await import("@/lib/admin-auth");
    await loginWith();
    const first = jar.get("provin_admin_session")!;
    const logout = await import("@/app/api/admin/logout/route");
    await logout.POST(new Request("https://www.provin.lv/api/admin/logout", { method: "POST" }));
    jar.set("provin_admin_session", first);
    expect(await getAdminSession()).toBe(false);

    await loginWith();
    expect(await getAdminSession()).toBe(true);
    const sessions = await import("@/app/api/admin/google-sessions/route");
    const res = await sessions.POST(
      new Request("https://www.provin.lv/api/admin/google-sessions", {
        method: "POST",
        body: JSON.stringify({ action: "logout_all" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(await getAdminSession()).toBe(false);
  });

  it("flag off immediately invalidates an existing Google session", async () => {
    const { getAdminSession } = await import("@/lib/admin-auth");
    await loginWith();
    expect(await getAdminSession()).toBe(true);
    vi.stubEnv("ADMIN_GOOGLE_LOGIN_ENABLED", "");
    expect(await getAdminSession()).toBe(false);
  });
});
