import { describe, expect, it } from "vitest";
import { resolveB2bPartnerSessionSecret } from "./b2b-partner-server-session";

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
