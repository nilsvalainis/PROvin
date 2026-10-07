import assert from "node:assert/strict";
import test from "node:test";

import { envToken, searchShowsOpenlaneLogin, shouldReadPublic } from "./policy.mjs";

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
});

test("Openlane login is ChassisNumber, not a null placeholder", () => {
  assert.equal(searchShowsOpenlaneLogin({ Auctions: [{ ChassisNumber: null }, { ChassisNumber: "WVWZZZ3CZWE000001" }] }), true);
  assert.equal(searchShowsOpenlaneLogin({ Auctions: [{ ChassisNumber: null }, { ChassisNumber: "" }] }), false);
  assert.equal(searchShowsOpenlaneLogin({ Auctions: [] }), null);
  assert.equal(searchShowsOpenlaneLogin(null), null);
});
