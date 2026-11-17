import assert from "node:assert/strict";
import test from "node:test";

import { envToken, shouldReadPublic } from "./policy.mjs";

test("envToken drops an inline systemd comment", () => {
  assert.equal(envToken("chrome          # sistēmas Google Chrome", "chromium"), "chrome");
  assert.equal(envToken("", "chrome"), "chrome");
  assert.equal(envToken(undefined, "chrome"), "chrome");
});

test("public fallback also runs when auto-login returns error", () => {
  assert.equal(shouldReadPublic("autobid", "login_required", false), true);
  assert.equal(shouldReadPublic("autobid", "error", false), true);
  assert.equal(shouldReadPublic("openlane", "error", true), true);
  assert.equal(shouldReadPublic("openlane", "error", false), false);
  assert.equal(shouldReadPublic("openlane", "ok", true), false);
  assert.equal(shouldReadPublic("auto1", "error", true), false);
  assert.equal(shouldReadPublic("auto1", "login_required", true), false);
  assert.equal(shouldReadPublic("ecarstrade", "login_required", false), true);
  assert.equal(shouldReadPublic("ecarstrade", "error", false), true);
});


test("envPositiveInt: systemd komentārs, teksts un 0 dod noklusējumu, nevis NaN", async () => {
  const { envPositiveInt } = await import("./policy.mjs");
  assert.equal(envPositiveInt("400 # dienas limits", 7), 400);
  assert.equal(envPositiveInt("abc", 400), 400);
  assert.equal(envPositiveInt("", 400), 400);
  assert.equal(envPositiveInt(undefined, 400), 400);
  assert.equal(envPositiveInt("0", 400), 400);
  assert.equal(envPositiveInt("-5", 400), 400);
  assert.equal(envPositiveInt("12.7", 400), 12);
  assert.equal(envPositiveInt("9", 2, 3), 3);
  assert.ok(Number.isFinite(envPositiveInt("400 # komentārs", 1)));
});
