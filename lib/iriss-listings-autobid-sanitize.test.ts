import { describe, expect, it } from "vitest";
import { parseAutobidNuxtJson } from "@/lib/iriss-listings-autobid";
import { isAutobidSecretString, sanitizeAutobidNuxtJson } from "@/lib/iriss-listings-autobid-sanitize";

const JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0IiwibmFtZSI6IkpvaG4ifQ.sflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
const BEARER = `Bearer ${JWT}`;

/** Dzīvais $svue-query cache: nickname, contactPerson.surname, addressBook.items.*.email.to. Auto ir sasniedzams no saknes. */
function fixtureSvueQueryAccount(): unknown[] {
  return [
    ["ShallowReactive", 1],
    { state: 2 },
    { "$svue-query": 3 },
    { queries: 4 },
    [5, 17],
    { state: 6 },
    { data: 7 },
    { nickname: 8, extendedData: 9 },
    "op-nick",
    { contactPerson: 10, addressBook: 11 },
    { surname: 12 },
    { items: 13 },
    "Kalniņš",
    [14],
    { email: 15 },
    { to: 16 },
    "leak@example.com",
    { state: 18 },
    { data: 19 },
    { itemPageCount: 20, items: 21 },
    1,
    [22],
    { id: 23, auctionId: 26, name: 24, taxInformation: 25, price: 27 },
    1001,
    "Audi A6",
    "Including 19% VAT",
    9001,
    { start: 28, minimal: 29, current: 30 },
    15000,
    0,
    0,
  ];
}

/**
 * Kopīgs devalue slots: items[].name un user.displayName rāda uz to pašu "Audi A6";
 * taxInformation ir arī dropped extendedData apakškokā. Tukšot apakškoku iznīcinātu auto laukus.
 */
function fixtureSharedSlots(): unknown[] {
  return [
    ["ShallowReactive", 1],
    { state: 2 },
    { user: 3, "$svue-query": 8 },
    { nickname: 4, displayName: 5, email: 6, extendedData: 7 },
    "op-nick",
    "Audi A6",
    "leak@example.com",
    { taxInformation: 16, contactPerson: 17 },
    { queries: 9 },
    [10],
    { state: 11 },
    { data: 12 },
    { itemPageCount: 13, items: 14 },
    1,
    [15],
    { id: 18, auctionId: 26, name: 5, slug: 19, stage: 20, auctionStartDate: 21, taxInformation: 16, equipments: 22, price: 27 },
    "Including 19% VAT",
    { surname: 23 },
    1001,
    "audi-a6",
    "IN_AUCTION",
    "2026-10-01T08:00:00.000Z",
    { eq68: 24 },
    "Kalniņš",
    { value: 25 },
    "120000",
    9001,
    { start: 28, minimal: 29, current: 30 },
    15000,
    0,
    0,
  ];
}

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

  it("empties $svue-query nickname, surname and nested email.to", () => {
    const out = sanitizeAutobidNuxtJson(JSON.stringify(fixtureSvueQueryAccount()));
    expect(out).not.toContain("leak@example.com");
    expect(out).not.toContain("op-nick");
    expect(out).not.toContain("Kalniņš");
    expect(out).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    expect(out).toContain("Audi A6");
    expect(out).toContain("Including 19% VAT");
    const page = parseAutobidNuxtJson(out);
    expect(page?.vehicles[0]).toMatchObject({ title: "Audi A6", vatNote: "Including 19% VAT" });
  });

  it("keeps items[].name and taxInformation when those slots are shared with dropped account keys", () => {
    const out = sanitizeAutobidNuxtJson(JSON.stringify(fixtureSharedSlots()));
    expect(out).not.toContain("leak@example.com");
    expect(out).not.toContain("op-nick");
    expect(out).not.toContain("Kalniņš");
    expect(out).toContain("Audi A6");
    expect(out).toContain("Including 19% VAT");
    expect(out).toContain("audi-a6");
    expect(out).toContain("IN_AUCTION");
    expect(out).toContain("120000");
    const page = parseAutobidNuxtJson(out);
    expect(page?.vehicles).toHaveLength(1);
    expect(page?.vehicles[0]).toMatchObject({
      externalId: "1001",
      title: "Audi A6",
      slug: "audi-a6",
      auctionStage: "IN_AUCTION",
      vatNote: "Including 19% VAT",
      mileageKm: 120000,
    });
  });
});
