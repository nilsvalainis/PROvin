import { describe, expect, it } from "vitest";
import {
  b2bPartnerPasswordVersion,
  isB2bPartnerSessionPasswordCurrent,
  resolveB2bPartnerSessionSecret,
} from "./b2b-partner-server-session";

describe("resolveB2bPartnerSessionSecret", () => {
  it("produkcijā lieto tikai B2B_PARTNER_SESSION_SECRET", () => {
    expect(
      resolveB2bPartnerSessionSecret({
        NODE_ENV: "production",
        ADMIN_SECRET: "admin-secret-16chars",
      } as NodeJS.ProcessEnv),
    ).toBe("");
    expect(
      resolveB2bPartnerSessionSecret({
        NODE_ENV: "production",
        B2B_PARTNER_SESSION_SECRET: "partner-session-secret",
        ADMIN_SECRET: "admin-secret-16chars",
      } as NodeJS.ProcessEnv),
    ).toBe("partner-session-secret");
  });

  it("lokāli bez dedicated secret lieto iebūvēto dev secret", () => {
    expect(
      resolveB2bPartnerSessionSecret({
        NODE_ENV: "development",
      } as NodeJS.ProcessEnv).length,
    ).toBeGreaterThanOrEqual(16);
  });
});

describe("b2b partner session password version", () => {
  it("rejects sessions issued before a password change", () => {
    const pv = b2bPartnerPasswordVersion("scrypt$old");
    expect(pv).toMatch(/^[0-9a-f]{16}$/);
    expect(isB2bPartnerSessionPasswordCurrent({ pv }, "scrypt$old")).toBe(true);
    expect(isB2bPartnerSessionPasswordCurrent({ pv }, "scrypt$new")).toBe(false);
  });
  it("accepts legacy cookies without pv", () => {
    expect(isB2bPartnerSessionPasswordCurrent({}, "scrypt$any")).toBe(true);
  });
});
