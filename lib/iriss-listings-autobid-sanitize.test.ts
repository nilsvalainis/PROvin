import { describe, expect, it } from "vitest";
import { parseAutobidNuxtJson } from "@/lib/iriss-listings-autobid";
import { isAutobidSecretString, sanitizeAutobidNuxtJson } from "@/lib/iriss-listings-autobid-sanitize";

const JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0IiwibmFtZSI6IkpvaG4ifQ.sflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
const BEARER = `Bearer ${JWT}`;

function fixtureWithSecrets(): unknown[] {
  return [
    ["ShallowReactive", 1],
    { state: 2 },
    { auth: 3, "$svue-query": 10 },
    { token: 4, user: 5, refreshToken: 9 },
    JWT,
    { email: 6, firstName: 7, lastName: 8, id: 11 },
    "operator@example.com",
    "Jānis",
    "Bērziņš",
    JWT,
    { data: 12 },
    42,
    { itemPageCount: 13, items: 14 },
    1,
    [15],
    { id: 16, name: 17, taxInformation: 18, authorization: 19, auctionId: 20, price: 21 },
    3587391,
    "Volvo XC60 B5 AWD",
    "Including 19% VAT",
    BEARER,
    83954,
    { start: 22, minimal: 23, current: 24 },
    32500,
    22800,
    0,
  ];
}

describe("sanitizeAutobidNuxtJson", () => {
  it("treats JWT and Bearer as secrets, not listing copy", () => {
    expect(isAutobidSecretString(JWT)).toBe(true);
    expect(isAutobidSecretString(BEARER)).toBe(true);
    expect(isAutobidSecretString("Including 19% VAT")).toBe(false);
  });

  it("drops Bearer, JWT and account fields but keeps the listing parseable", () => {
    const raw = JSON.stringify(fixtureWithSecrets());
    const out = sanitizeAutobidNuxtJson(raw);
    expect(out).not.toContain(JWT);
    expect(out).not.toMatch(/Bearer\s/i);
    expect(out).not.toContain("operator@example.com");
    expect(out).not.toContain("Jānis");
    expect(out).toContain("Volvo XC60 B5 AWD");
    const page = parseAutobidNuxtJson(out);
    expect(page?.vehicles).toHaveLength(1);
    expect(page?.vehicles[0]).toMatchObject({
      externalId: "3587391",
      title: "Volvo XC60 B5 AWD",
      vatNote: "Including 19% VAT",
      priceStart: 32500,
    });
  });
});
