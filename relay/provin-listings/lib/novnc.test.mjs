import assert from "node:assert/strict";
import test from "node:test";

import {
  buildVncViewerUrl,
  createVncToken,
  parseVncRequestPath,
  tokenLooksValid,
  tokensEqual,
  vncViewerPath,
  vncViewerQuery,
} from "./novnc.mjs";

test("createVncToken is 64 hex chars", () => {
  const t = createVncToken();
  assert.equal(t.length, 64);
  assert.equal(tokenLooksValid(t), true);
  assert.equal(tokenLooksValid("short"), false);
  assert.equal(tokenLooksValid("g".repeat(64)), false);
});

test("tokensEqual is exact and rejects mismatched length", () => {
  const t = createVncToken();
  assert.equal(tokensEqual(t, t), true);
  assert.equal(tokensEqual(t, t.toUpperCase()), true);
  assert.equal(tokensEqual(t, createVncToken()), false);
  assert.equal(tokensEqual(t, t.slice(0, 32)), false);
  assert.equal(tokensEqual("", t), false);
});

test("parseVncRequestPath accepts listings prefix and stripped path", () => {
  const token = "a".repeat(64);
  assert.deepEqual(parseVncRequestPath(`/listings/vnc/${token}/vnc.html`), { token, rest: "/vnc.html" });
  assert.deepEqual(parseVncRequestPath(`/vnc/${token}/`), { token, rest: "/" });
  assert.deepEqual(parseVncRequestPath(`/vnc/${token}`), { token, rest: "/" });
  assert.deepEqual(parseVncRequestPath(`/vnc/${token}/app/ui.js`), { token, rest: "/app/ui.js" });
  assert.equal(parseVncRequestPath("/listings/health"), null);
  assert.equal(parseVncRequestPath(`/listings/vnc/${"a".repeat(32)}/vnc.html`), null);
});

test("buildVncViewerUrl keeps path under /listings and sets noVNC query", () => {
  const token = "b".repeat(64);
  const url = buildVncViewerUrl("https://csdd-relay.provin.lv/listings/", token);
  assert.equal(url.startsWith(`https://csdd-relay.provin.lv/listings/vnc/${token}/vnc.html?`), true);
  assert.match(url, /autoconnect=true/);
  assert.match(url, /path=listings%2Fvnc%2F/);
  assert.equal(buildVncViewerUrl("https://x/listings", "nope"), "");
  assert.equal(vncViewerPath(token), `/listings/vnc/${token}/vnc.html`);
  assert.match(vncViewerQuery(token), /path=listings%2Fvnc%2F/);
});
