import { describe, expect, it } from "vitest";
import { generateTotpCode, generateTotpSecret, totpAuthUrl, verifyTotpCode } from "@/lib/staff-totp";

describe("staff TOTP", () => {
  it("accepts the current code and rejects a wrong one", () => {
    const secret = generateTotpSecret();
    const at = Date.UTC(2026, 9, 20, 12, 0, 0);
    const code = generateTotpCode(secret, at);
    expect(code).toMatch(/^\d{6}$/);
    expect(verifyTotpCode(secret, code, at)).toBe(true);
    expect(verifyTotpCode(secret, "000000", at)).toBe(false);
    expect(totpAuthUrl({ secret, account: "anna@example.lv" })).toContain("otpauth://totp/");
  });
});
