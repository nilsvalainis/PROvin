import { createHmac } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyToken } from "@/lib/admin-auth";
import { encodeAdminSessionPayload, verifyAdminSessionToken } from "@/lib/admin-session-token";

const SECRET = "test-admin-secret-0123456789";

function signPayload(json: unknown): string {
  const payload = Buffer.from(JSON.stringify(json), "utf8").toString("base64url");
  return `${payload}.${createHmac("sha256", SECRET).update(payload).digest("hex")}`;
}

const now = Date.now();
const google = { typ: "admin", exp: now + 60_000, via: "google", sid: "ags_1", sub: "110", ver: 1, email: "info@provin.lv" };

describe("Google admin session token (Edge + Node static checks)", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_SECRET", SECRET);
    vi.stubEnv("ADMIN_GOOGLE_LOGIN_ENABLED", "1");
  });
  afterEach(() => vi.unstubAllEnvs());

  const cases: Array<[string, unknown, boolean]> = [
    ["valid google token", google, true],
    ["other e-mail", { ...google, email: "nils@provin.lv" }, false],
    ["missing sid", { ...google, sid: undefined }, false],
    ["missing sub", { ...google, sub: "" }, false],
    ["ver as string", { ...google, ver: "1" }, false],
    ["unknown via", { ...google, via: "github" }, false],
    ["expired", { ...google, exp: now - 1 }, false],
  ];

  it.each(cases)("%s", async (_name, payload, expected) => {
    const token = signPayload(payload);
    expect(await verifyAdminSessionToken(token)).toBe(expected);
    expect(verifyToken(token)).toBe(expected);
  });

  it("flag off kills every google session at the edge and on the server", async () => {
    vi.stubEnv("ADMIN_GOOGLE_LOGIN_ENABLED", "");
    const token = signPayload(google);
    expect(await verifyAdminSessionToken(token)).toBe(false);
    expect(verifyToken(token)).toBe(false);
  });

  it("flag off does not affect password sessions", async () => {
    vi.stubEnv("ADMIN_GOOGLE_LOGIN_ENABLED", "");
    const token = signPayload({ typ: "admin", exp: now + 60_000 });
    expect(await verifyAdminSessionToken(token)).toBe(true);
    expect(verifyToken(token)).toBe(true);
  });

  it("encodeAdminSessionPayload with google fields round-trips", async () => {
    const payload = encodeAdminSessionPayload(now + 60_000, { sid: "ags_2", sub: "110", ver: 2, email: "info@provin.lv" });
    const token = `${payload}.${createHmac("sha256", SECRET).update(payload).digest("hex")}`;
    expect(await verifyAdminSessionToken(token)).toBe(true);
  });
});
