import { describe, expect, it } from "vitest";
import { B2bDemoIsolationError } from "./b2b-demo-isolation";
import {
  B2bDemoAuctionSessionError,
  decryptB2bDemoAuctionSession,
  encryptB2bDemoAuctionSession,
  parseAuctionSessionWrite,
  rejectAuctionPasswordPayload,
} from "./b2b-demo-auction-crypto";

describe("b2b demo auction session stub", () => {
  const secret = "wrap-secret-at-least-16";
  const tenantA = "tnt_aaaaaa";
  const tenantB = "tnt_bbbbbb";

  it("šifrē sessionBlob un atšifrē tikai savam tenantam", () => {
    const row = encryptB2bDemoAuctionSession({
      tenantId: tenantA,
      platform: "auto1",
      sessionBlob: "cookie=abc; path=/",
      masterSecret: secret,
    });
    expect(row.tenantId).toBe(tenantA);
    expect(JSON.stringify(row)).not.toContain("cookie=abc");
    expect(JSON.stringify(row).toLowerCase()).not.toContain("password");
    expect(decryptB2bDemoAuctionSession(row, tenantA, secret).sessionBlob).toBe("cookie=abc; path=/");
    expect(() => decryptB2bDemoAuctionSession(row, tenantB, secret)).toThrow(B2bDemoIsolationError);
  });

  it("noraida paroles laukus", () => {
    expect(() => rejectAuctionPasswordPayload({ password: "secret" })).toThrow(B2bDemoAuctionSessionError);
    expect(() => parseAuctionSessionWrite({ platform: "auto1", sessionBlob: "x", password: "x" })).toThrow(
      /parol/i,
    );
    expect(() =>
      encryptB2bDemoAuctionSession({
        tenantId: tenantA,
        platform: "openlane",
        sessionBlob: '"password"="hunter2"',
        masterSecret: secret,
      }),
    ).toThrow(/parol/i);
  });
});
