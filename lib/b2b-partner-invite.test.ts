import { describe, expect, it } from "vitest";
import {
  b2bInviteRegisterPath,
  isB2bInviteOpen,
  isSafeB2bInviteToken,
  newB2bInviteToken,
  parseB2bInviteRecord,
} from "@/lib/b2b-partner-invite";

describe("B2B partner invites", () => {
  it("issues a safe token and public register path", () => {
    const token = newB2bInviteToken();
    expect(isSafeB2bInviteToken(token)).toBe(true);
    expect(b2bInviteRegisterPath(token)).toBe(`/partneriem/registracija?token=${token}`);
  });

  it("rejects used or expired invites", () => {
    const open = parseB2bInviteRecord({
      token: "inv_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      createdAt: "2026-09-01T00:00:00.000Z",
      expiresAt: "2026-09-20T00:00:00.000Z",
      usedAt: null,
      usedPartnerId: null,
    });
    expect(open && isB2bInviteOpen(open, Date.parse("2026-09-10T00:00:00.000Z"))).toBe(true);
    expect(
      open && isB2bInviteOpen({ ...open, usedAt: "2026-09-02T00:00:00.000Z" }, Date.parse("2026-09-10T00:00:00.000Z")),
    ).toBe(false);
    expect(open && isB2bInviteOpen(open, Date.parse("2026-09-21T00:00:00.000Z"))).toBe(false);
  });
});
