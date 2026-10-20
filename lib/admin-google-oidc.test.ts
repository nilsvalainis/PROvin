import { createSign, generateKeyPairSync, type KeyObject } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  adminGoogleStateMatches,
  buildAdminGoogleStart,
  pkceChallenge,
  resolveAdminGoogleConfig,
  sanitizeAdminNextPath,
  signAdminGoogleFlow,
  verifyAdminGoogleFlow,
  verifyAdminGoogleIdToken,
  type GoogleJwk,
} from "@/lib/admin-google-oidc";

const CLIENT_ID = "test-client.apps.googleusercontent.com";
const NONCE = "nonce-abc";
const SECRET = "test-admin-secret-0123456789";

function keyPair(kid: string): { privateKey: KeyObject; jwk: GoogleJwk } {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return { privateKey, jwk: { ...(publicKey.export({ format: "jwk" }) as GoogleJwk), kid, alg: "RS256", use: "sig" } };
}

const good = keyPair("kid-1");
const attacker = keyPair("kid-1");

function b64(o: unknown): string {
  return Buffer.from(JSON.stringify(o)).toString("base64url");
}

function sign(
  claims: Record<string, unknown>,
  opts: { key?: KeyObject; header?: Record<string, unknown> } = {},
): string {
  const h = b64(opts.header ?? { alg: "RS256", kid: "kid-1", typ: "JWT" });
  const p = b64(claims);
  const s = createSign("RSA-SHA256").update(`${h}.${p}`).sign(opts.key ?? good.privateKey).toString("base64url");
  return `${h}.${p}.${s}`;
}

const nowSec = Math.floor(Date.now() / 1000);
const validClaims = {
  iss: "https://accounts.google.com",
  aud: CLIENT_ID,
  azp: CLIENT_ID,
  sub: "110000000000000000001",
  email: "info@provin.lv",
  email_verified: true,
  hd: "provin.lv",
  nonce: NONCE,
  iat: nowSec,
  exp: nowSec + 3600,
};

function check(token: string, nonce = NONCE) {
  return verifyAdminGoogleIdToken(token, { clientId: CLIENT_ID, nonce, jwks: [good.jwk] });
}

describe("verifyAdminGoogleIdToken", () => {
  it("accepts info@provin.lv with verified email, hd and valid signature", () => {
    expect(check(sign(validClaims))).toEqual({ ok: true, sub: validClaims.sub, email: "info@provin.lv" });
  });

  it("accepts the legacy issuer form", () => {
    expect(check(sign({ ...validClaims, iss: "accounts.google.com" })).ok).toBe(true);
  });

  const rejections: Array<[string, string, string]> = [
    ["other e-mail same domain", sign({ ...validClaims, email: "nils@provin.lv" }), "email_not_allowed"],
    ["gmail account", sign({ ...validClaims, email: "info.provin@gmail.com", hd: undefined }), "email_not_allowed"],
    ["upper-case e-mail is not exact", sign({ ...validClaims, email: "INFO@provin.lv" }), "email_not_allowed"],
    ["other hd", sign({ ...validClaims, hd: "example.com" }), "hd_not_allowed"],
    ["missing hd (consumer account)", sign({ ...validClaims, hd: undefined }), "hd_not_allowed"],
    ["email_verified=false", sign({ ...validClaims, email_verified: false }), "email_unverified"],
    ["email_verified missing", sign({ ...validClaims, email_verified: undefined }), "email_unverified"],
    ["signed by another key with same kid", sign(validClaims, { key: attacker.privateKey }), "bad_signature"],
    ["unknown kid", sign(validClaims, { header: { alg: "RS256", kid: "other" } }), "unknown_kid"],
    ["alg none", `${b64({ alg: "none", kid: "kid-1" })}.${b64(validClaims)}.AAAA`, "bad_alg"],
    ["alg HS256", sign(validClaims, { header: { alg: "HS256", kid: "kid-1" } }), "bad_alg"],
    ["wrong aud", sign({ ...validClaims, aud: "other-client" }), "bad_aud"],
    ["wrong azp", sign({ ...validClaims, azp: "other-client" }), "bad_aud"],
    ["aud array without matching azp", sign({ ...validClaims, aud: [CLIENT_ID, "x"], azp: undefined }), "bad_aud"],
    ["wrong iss", sign({ ...validClaims, iss: "https://evil.example" }), "bad_iss"],
    ["expired", sign({ ...validClaims, exp: nowSec - 3600 }), "expired"],
    ["exp missing", sign({ ...validClaims, exp: undefined }), "expired"],
    ["iat far in future", sign({ ...validClaims, iat: nowSec + 3600 }), "iat_future"],
    ["wrong nonce", sign({ ...validClaims, nonce: "other" }), "bad_nonce"],
    ["missing nonce", sign({ ...validClaims, nonce: undefined }), "bad_nonce"],
    ["missing sub", sign({ ...validClaims, sub: undefined }), "no_sub"],
    ["garbage", "not-a-jwt", "malformed"],
  ];

  it.each(rejections)("rejects: %s", (_name, token, reason) => {
    expect(check(token)).toEqual({ ok: false, reason });
  });

  it("rejects a tampered payload re-using a valid signature", () => {
    const [h, , s] = sign(validClaims).split(".");
    const forged = `${h}.${b64({ ...validClaims, email: "info@provin.lv", sub: "attacker" })}.${s}`;
    expect(check(forged)).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects when the expected nonce is empty", () => {
    expect(check(sign({ ...validClaims, nonce: "" }), "")).toEqual({ ok: false, reason: "bad_nonce" });
  });
});

describe("OAuth flow cookie (state + PKCE + nonce)", () => {
  afterEach(() => vi.unstubAllEnvs());

  const config = { clientId: CLIENT_ID, clientSecret: "x", redirectUri: "https://www.provin.lv/cb", envSub: "" };

  it("builds an auth URL with S256 PKCE, nonce, state, hd and login hint", () => {
    const { authUrl, flowCookie } = buildAdminGoogleStart(config, SECRET, "/admin/orders");
    const url = new URL(authUrl);
    const flow = verifyAdminGoogleFlow(flowCookie, SECRET);
    expect(flow).not.toBeNull();
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe(flow!.state);
    expect(url.searchParams.get("nonce")).toBe(flow!.nonce);
    expect(url.searchParams.get("code_challenge")).toBe(pkceChallenge(flow!.verifier));
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("hd")).toBe("provin.lv");
    expect(url.searchParams.get("login_hint")).toBe("info@provin.lv");
    expect(url.searchParams.get("redirect_uri")).toBe("https://www.provin.lv/cb");
    expect(url.toString()).not.toContain(flow!.verifier);
    expect(flow!.next).toBe("/admin/orders");
  });

  it("state must match exactly", () => {
    const { flowCookie } = buildAdminGoogleStart(config, SECRET, "/admin");
    const flow = verifyAdminGoogleFlow(flowCookie, SECRET)!;
    expect(adminGoogleStateMatches(flow, flow.state)).toBe(true);
    expect(adminGoogleStateMatches(flow, `${flow.state}x`)).toBe(false);
    expect(adminGoogleStateMatches(flow, "")).toBe(false);
    expect(adminGoogleStateMatches(flow, null)).toBe(false);
  });

  it("rejects tampered, foreign-secret and expired flow cookies", () => {
    const now = Date.now();
    const flow = { state: "s", nonce: "n", verifier: "v", next: "/admin", exp: now + 60_000 };
    const cookie = signAdminGoogleFlow(flow, SECRET);
    expect(verifyAdminGoogleFlow(cookie, SECRET, now)).toEqual(flow);
    expect(verifyAdminGoogleFlow(cookie, "another-secret-0123456789", now)).toBeNull();
    const [, sig] = cookie.split(".");
    expect(verifyAdminGoogleFlow(`${b64({ ...flow, state: "evil" })}.${sig}`, SECRET, now)).toBeNull();
    expect(verifyAdminGoogleFlow(signAdminGoogleFlow({ ...flow, exp: now - 1 }, SECRET), SECRET, now)).toBeNull();
    expect(verifyAdminGoogleFlow(undefined, SECRET, now)).toBeNull();
  });

  it("sanitizes the post-login path (no open redirect)", () => {
    expect(sanitizeAdminNextPath("/admin/orders?x=1")).toBe("/admin/orders?x=1");
    expect(sanitizeAdminNextPath("https://evil.example")).toBe("/admin");
    expect(sanitizeAdminNextPath("//evil.example/admin")).toBe("/admin");
    expect(sanitizeAdminNextPath("/admin\\@evil")).toBe("/admin");
    expect(sanitizeAdminNextPath("/adminevil")).toBe("/admin");
    expect(sanitizeAdminNextPath("/admin/login")).toBe("/admin");
  });

  it("config is null while the flag is off or env is incomplete (no invented secrets)", () => {
    vi.stubEnv("ADMIN_SECRET", SECRET);
    vi.stubEnv("ADMIN_GOOGLE_CLIENT_ID", CLIENT_ID);
    vi.stubEnv("ADMIN_GOOGLE_CLIENT_SECRET", "secret");
    vi.stubEnv("ADMIN_GOOGLE_LOGIN_ENABLED", "");
    expect(resolveAdminGoogleConfig()).toBeNull();
    vi.stubEnv("ADMIN_GOOGLE_LOGIN_ENABLED", "1");
    expect(resolveAdminGoogleConfig()?.clientId).toBe(CLIENT_ID);
    vi.stubEnv("ADMIN_GOOGLE_CLIENT_SECRET", "");
    expect(resolveAdminGoogleConfig()).toBeNull();
  });
});
