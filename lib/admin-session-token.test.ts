import { createHmac } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyToken } from "@/lib/admin-auth";
import {
  ADMIN_DEV_FALLBACK_SECRET,
  ADMIN_SESSION_TOKEN_TYP,
  encodeAdminSessionPayload,
  resolveAdminSessionSecret,
  verifyAdminSessionToken,
} from "@/lib/admin-session-token";

const SECRET = "test-admin-secret-0123456789";

function signPayload(json: unknown, secret = SECRET): string {
  const payload = Buffer.from(JSON.stringify(json), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function sign(exp: number, secret = SECRET): string {
  return signPayload({ typ: ADMIN_SESSION_TOKEN_TYP, exp }, secret);
}

describe("verifyAdminSessionToken", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_SECRET", SECRET);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const now = Date.now();
  const valid = sign(now + 60_000);
  const cases: Array<[string, string]> = [
    ["valid", valid],
    ["expired", sign(now - 1)],
    ["wrong secret", sign(now + 60_000, "another-secret-0123456789")],
    ["tampered payload", `${Buffer.from(JSON.stringify({ typ: ADMIN_SESSION_TOKEN_TYP, exp: now + 9e9 })).toString("base64url")}.${valid.split(".")[1]}`],
    ["tampered signature", `${valid.split(".")[0]}.${"0".repeat(64)}`],
    ["uppercase signature", `${valid.split(".")[0]}.${valid.split(".")[1]!.toUpperCase()}`],
    ["no dot", valid.replace(".", "")],
    ["three parts", `${valid}.x`],
    ["empty", ""],
    ["non-json payload", `${Buffer.from("nope").toString("base64url")}.${createHmac("sha256", SECRET).update(Buffer.from("nope").toString("base64url")).digest("hex")}`],
    ["exp as string", signPayload({ typ: ADMIN_SESSION_TOKEN_TYP, exp: "9999999999999" })],
  ];

  it.each(cases)("matches Node verifyToken: %s", async (_name, token) => {
    expect(await verifyAdminSessionToken(token)).toBe(verifyToken(token));
  });

  it("accepts a fresh token and rejects missing cookie", async () => {
    expect(await verifyAdminSessionToken(valid)).toBe(true);
    expect(await verifyAdminSessionToken(undefined)).toBe(false);
  });

  it("rejects everything when production has no secret", async () => {
    vi.stubEnv("ADMIN_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(resolveAdminSessionSecret()).toBe("");
    expect(await verifyAdminSessionToken(valid)).toBe(false);
  });

  it("uses the dev fallback only outside production", () => {
    expect(resolveAdminSessionSecret({ NODE_ENV: "development" } as NodeJS.ProcessEnv)).toBe(ADMIN_DEV_FALLBACK_SECRET);
    expect(resolveAdminSessionSecret({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toBe("");
  });

  it("rejects legacy exp-only tokens even with a valid HMAC", async () => {
    const token = signPayload({ exp: now + 60_000 });
    expect(await verifyAdminSessionToken(token)).toBe(false);
    expect(verifyToken(token)).toBe(false);
  });

  it("rejects partner-shaped payload signed with the admin secret", async () => {
    const token = signPayload({
      partnerId: "p_partner1",
      email: "partner@example.com",
      exp: now + 60_000,
    });
    expect(await verifyAdminSessionToken(token)).toBe(false);
    expect(verifyToken(token)).toBe(false);
  });

  it("rejects demo-shaped payload signed with the admin secret", async () => {
    const token = signPayload({
      tenantId: "tnt_sess01",
      userId: "usr_sess01",
      email: "a@b.lv",
      role: "employee",
      exp: now + 60_000,
    });
    expect(await verifyAdminSessionToken(token)).toBe(false);
    expect(verifyToken(token)).toBe(false);
  });

  it("rejects a foreign typ even with a valid HMAC", async () => {
    const token = signPayload({ typ: "partner", exp: now + 60_000 });
    expect(await verifyAdminSessionToken(token)).toBe(false);
    expect(verifyToken(token)).toBe(false);
  });

  it("encodeAdminSessionPayload is what verify accepts", async () => {
    const payload = encodeAdminSessionPayload(now + 60_000);
    const sig = createHmac("sha256", SECRET).update(payload).digest("hex");
    expect(await verifyAdminSessionToken(`${payload}.${sig}`)).toBe(true);
  });
});
