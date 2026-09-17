import { describe, expect, it } from "vitest";
import {
  b2bEmailVerifyPath,
  b2bPartnerLocale,
  b2bPartnerPasswordResetAbsoluteUrl,
  b2bPartnerVerifyAbsoluteUrl,
  b2bPasswordResetPath,
  b2bVerifyTokensEqual,
  hashB2bVerifyToken,
  isB2bVerifyHashOpen,
  isPartnerEmailVerified,
  isSafeB2bResetToken,
  isSafeB2bVerifyToken,
  newB2bResetToken,
  newB2bVerifyToken,
} from "@/lib/b2b-partner-verify";

describe("b2b email verify tokens", () => {
  it("issues a hashed one-time token", () => {
    const token = newB2bVerifyToken();
    expect(isSafeB2bVerifyToken(token)).toBe(true);
    expect(hashB2bVerifyToken(token)).toHaveLength(64);
    expect(b2bVerifyTokensEqual(hashB2bVerifyToken(token), token)).toBe(true);
    expect(b2bVerifyTokensEqual(hashB2bVerifyToken(token), newB2bVerifyToken())).toBe(false);
    expect(b2bEmailVerifyPath(token)).toBe(`/partneriem/apstiprinat?token=${token}`);
    expect(b2bPartnerLocale("en")).toBe("en");
    expect(b2bPartnerLocale("lv")).toBe("lv");
    expect(b2bPartnerLocale("de")).toBe("de");
    expect(b2bPartnerLocale("ru")).toBe("ru");
    expect(b2bPartnerVerifyAbsoluteUrl("https://provin.lv", "de", token)).toBe(
      `https://provin.lv/de/partneriem/apstiprinat?token=${token}`,
    );
  });

  it("issues a hashed one-time password reset token", () => {
    const token = newB2bResetToken();
    expect(isSafeB2bResetToken(token)).toBe(true);
    expect(isSafeB2bVerifyToken(token)).toBe(false);
    expect(b2bPasswordResetPath(token)).toBe(`/partneriem/parole?token=${token}`);
    expect(b2bPartnerPasswordResetAbsoluteUrl("https://provin.lv", "lv", token)).toBe(
      `https://provin.lv/lv/partneriem/parole?token=${token}`,
    );
  });

  it("treats missing verify timestamp as unverified only when explicitly null", () => {
    expect(isPartnerEmailVerified({ emailVerifiedAt: "2026-09-14T00:00:00.000Z" })).toBe(true);
    expect(isPartnerEmailVerified({ emailVerifiedAt: null })).toBe(false);
    expect(isPartnerEmailVerified({})).toBe(false);
    expect(isB2bVerifyHashOpen("2026-09-14T12:00:00.000Z", Date.parse("2026-09-14T11:00:00.000Z"))).toBe(true);
    expect(isB2bVerifyHashOpen("2026-09-14T12:00:00.000Z", Date.parse("2026-09-14T13:00:00.000Z"))).toBe(false);
  });
});
