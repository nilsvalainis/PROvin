import { describe, expect, it } from "vitest";
import { readB2bDemoSessionToken, resolveB2bDemoSessionSecret, signB2bDemoSessionToken } from "./b2b-demo-session-token";

describe("b2b demo session token", () => {
  const session = {
    tenantId: "tnt_sess01",
    userId: "usr_sess01",
    email: "a@b.lv",
    role: "employee" as const,
  };

  it("paraksta un verificē, noraida svešu secret", () => {
    const token = signB2bDemoSessionToken(session, "session-secret-16ch");
    expect(readB2bDemoSessionToken(token, "session-secret-16ch")).toEqual(session);
    expect(readB2bDemoSessionToken(token, "other-secret-16char")).toBeNull();
    expect(readB2bDemoSessionToken(token, "session-secret-16ch", Date.now() + 8 * 24 * 60 * 60 * 1000)).toBeNull();
  });

  it("produkcijā bez secret neatgriež fallback", () => {
    expect(resolveB2bDemoSessionSecret({ NODE_ENV: "production" })).toBe("");
    expect(resolveB2bDemoSessionSecret({ NODE_ENV: "development" }).length).toBeGreaterThanOrEqual(16);
  });
});
