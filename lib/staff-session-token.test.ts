import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { verifyAdminSessionToken } from "@/lib/admin-session-token";
import {
  encodeStaffSessionPayload,
  signStaffSessionToken,
  verifyStaffSessionToken,
} from "@/lib/staff-session-token";

const SECRET = "test-admin-secret-0123456789";

describe("staff session token", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_SECRET", SECRET);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts a signed logistics token and rejects it as an admin session", async () => {
    const token = await signStaffSessionToken({
      sid: "ses_abcdefgh",
      uid: "usr_abcdefgh",
      role: "logistics",
      exp: Date.now() + 60_000,
    });
    const payload = await verifyStaffSessionToken(token);
    expect(payload?.role).toBe("logistics");
    expect(payload?.sid).toBe("ses_abcdefgh");
    expect(await verifyAdminSessionToken(token)).toBe(false);
  });

  it("rejects expired, forged and admin-shaped tokens", async () => {
    const expired = await signStaffSessionToken({
      sid: "ses_abcdefgh",
      uid: "usr_abcdefgh",
      role: "logistics",
      exp: Date.now() - 1,
    });
    expect(await verifyStaffSessionToken(expired)).toBeNull();

    const payload = encodeStaffSessionPayload({
      sid: "ses_abcdefgh",
      uid: "usr_abcdefgh",
      role: "logistics",
      exp: Date.now() + 60_000,
    });
    const sig = createHmac("sha256", "wrong-secret-0123456789").update(payload).digest("hex");
    expect(await verifyStaffSessionToken(`${payload}.${sig}`)).toBeNull();

    const adminPayload = Buffer.from(JSON.stringify({ typ: "admin", exp: Date.now() + 60_000 }), "utf8").toString(
      "base64url",
    );
    const adminSig = createHmac("sha256", SECRET).update(adminPayload).digest("hex");
    expect(await verifyStaffSessionToken(`${adminPayload}.${adminSig}`)).toBeNull();
  });
});
