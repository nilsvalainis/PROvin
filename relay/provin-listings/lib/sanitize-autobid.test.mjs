import assert from "node:assert/strict";
import test from "node:test";

import { isAutobidSecretString, sanitizeAutobidNuxtJson, sanitizeAutobidRelayRaw } from "./sanitize-autobid.mjs";

const JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0IiwibmFtZSI6IkpvaG4ifQ.sflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
const BEARER = `Bearer ${JWT}`;

function fixtureWithSecrets() {
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
    { id: 16, name: 17, taxInformation: 18, authorization: 19 },
    3587391,
    "Volvo XC60 B5 AWD",
    "Including 19% VAT",
    BEARER,
  ];
}

test("JWT and Bearer strings are secrets", () => {
  assert.equal(isAutobidSecretString(JWT), true);
  assert.equal(isAutobidSecretString(BEARER), true);
  assert.equal(isAutobidSecretString("Including 19% VAT"), false);
  assert.equal(isAutobidSecretString("Volvo XC60 B5 AWD"), false);
});

test("sanitizeAutobidNuxtJson drops Bearer, JWT and account fields but keeps listing data", () => {
  const out = JSON.parse(sanitizeAutobidNuxtJson(JSON.stringify(fixtureWithSecrets())));
  const dumped = JSON.stringify(out);
  assert.equal(dumped.includes(JWT), false);
  assert.equal(/Bearer\s/i.test(dumped), false);
  assert.equal(dumped.includes("operator@example.com"), false);
  assert.equal(dumped.includes("Jānis"), false);
  assert.equal(dumped.includes("Bērziņš"), false);
  assert.equal(dumped.includes("Volvo XC60 B5 AWD"), true);
  assert.equal(dumped.includes("Including 19% VAT"), true);
  assert.equal(out[16], 3587391);
});

test("invalid JSON still has JWT/Bearer stripped", () => {
  const raw = `not-json ${BEARER} tail ${JWT}`;
  const out = sanitizeAutobidNuxtJson(raw);
  assert.equal(out.includes(JWT), false);
  assert.equal(/Bearer\s/i.test(out), false);
});

test("sanitizeAutobidRelayRaw maps nuxtPages only", () => {
  const raw = sanitizeAutobidRelayRaw({ kind: "autobid-nuxt", loggedIn: true, nuxtPages: [JSON.stringify(fixtureWithSecrets())] });
  assert.equal(JSON.stringify(raw).includes(JWT), false);
  assert.equal(raw.loggedIn, true);
  assert.equal(sanitizeAutobidRelayRaw({ kind: "openlane" }).kind, "openlane");
});
