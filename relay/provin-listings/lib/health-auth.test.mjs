import assert from "node:assert/strict";
import test from "node:test";

import { bearerTokenMatches, healthResponseBody } from "./health-auth.mjs";

const TOKEN = "relay-token-0123456789abcdef";

test("bearerTokenMatches accepts only the exact Bearer token", () => {
  assert.equal(bearerTokenMatches(`Bearer ${TOKEN}`, TOKEN), true);
  assert.equal(bearerTokenMatches(`Bearer ${TOKEN}x`, TOKEN), false);
  assert.equal(bearerTokenMatches(`Bearer ${TOKEN.slice(0, -1)}X`, TOKEN), false);
  assert.equal(bearerTokenMatches(TOKEN, TOKEN), false);
  assert.equal(bearerTokenMatches("", TOKEN), false);
  assert.equal(bearerTokenMatches(undefined, TOKEN), false);
  assert.equal(bearerTokenMatches("Bearer ", ""), false);
});

test("health without valid token returns only ok and never builds details", async () => {
  let built = 0;
  const full = async () => {
    built++;
    return { ok: true, lastError: "secret", discoveredApis: ["x"], daily: { openlane: 3 } };
  };
  const anon = await healthResponseBody(bearerTokenMatches(undefined, TOKEN), full);
  assert.deepEqual(anon, { ok: true });
  const wrong = await healthResponseBody(bearerTokenMatches("Bearer nope", TOKEN), full);
  assert.deepEqual(wrong, { ok: true });
  assert.equal(built, 0);
});

test("health with valid token returns full details", async () => {
  const body = await healthResponseBody(bearerTokenMatches(`Bearer ${TOKEN}`, TOKEN), async () => ({
    ok: true,
    lastError: "boom",
    discoveredApis: ["a"],
  }));
  assert.deepEqual(body, { ok: true, lastError: "boom", discoveredApis: ["a"] });
});
