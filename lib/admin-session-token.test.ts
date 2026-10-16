import { createHmac } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyToken } from "@/lib/admin-auth";
import { ADMIN_DEV_FALLBACK_SECRET, resolveAdminSessionSecret, verifyAdminSessionToken } from "@/lib/admin-session-token";

const SECRET = "test-admin-secret-0123456789";

function sign(exp: number, secret = SECRET): string {
  const payload = Buffer.from(JSON.stringify({ exp }), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
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
    ["tampered payload", `${Buffer.from(JSON.stringify({ exp: now + 9e9 })).toString("base64url")}.${valid.split(".")[1]}`],
    ["tampered signature", `${valid.split(".")[0]}.${"0".repeat(64)}`],
    ["uppercase signature", `${valid.split(".")[0]}.${valid.split(".")[1]!.toUpperCase()}`],
    ["no dot", valid.replace(".", "")],
    ["three parts", `${valid}.x`],
    ["empty", ""],
    ["non-json payload", `${Buffer.from("nope").toString("base64url")}.${createHmac("sha256", SECRET).update(Buffer.from("nope").toString("base64url")).digest("hex")}`],
    ["exp as string", sign("9999999999999" as unknown as number)],
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
});
