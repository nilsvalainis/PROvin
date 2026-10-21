import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  THANKS_SESSION_DEV_FALLBACK_SECRET,
  THANKS_SESSION_TOKEN_TYP,
  THANKS_SESSION_URL_CLEANUP_SNIPPET,
  applyThanksSessionUrlCleanup,
  authorizeInvoiceDownload,
  buildInvoiceDownloadUrl,
  decideThanksSessionCapture,
  isThanksPagePath,
  parseThanksCheckoutSessionId,
  readInvoiceLinkSessionId,
  readThanksSessionIdFromToken,
  resolveThanksSessionSecret,
  signInvoiceLinkToken,
  signThanksSessionToken,
  stripSessionIdFromHref,
  thanksSessionCookieOptions,
  thanksUrlIsSafeForPixels,
} from "./thanks-session";

const SECRET = "test-thanks-secret-0123456789";

describe("parseThanksCheckoutSessionId", () => {
  it("accepts Stripe live and test session ids", () => {
    expect(parseThanksCheckoutSessionId("cs_live_abcdefgh")).toBe("cs_live_abcdefgh");
    expect(parseThanksCheckoutSessionId(" cs_test_a1b2c3d4e5 ")).toBe("cs_test_a1b2c3d4e5");
  });

  it("rejects missing, short, or unsubstituted ids", () => {
    expect(parseThanksCheckoutSessionId("")).toBeNull();
    expect(parseThanksCheckoutSessionId("cs_ab")).toBeNull();
    expect(parseThanksCheckoutSessionId("{CHECKOUT_SESSION_ID}")).toBeNull();
    expect(parseThanksCheckoutSessionId("demo_order_1")).toBeNull();
    expect(parseThanksCheckoutSessionId("../etc/passwd")).toBeNull();
  });
});

describe("isThanksPagePath", () => {
  it("matches locale-prefixed /paldies", () => {
    expect(isThanksPagePath("/lv/paldies")).toBe(true);
    expect(isThanksPagePath("/en/paldies/")).toBe(true);
    expect(isThanksPagePath("/de/paldies")).toBe(true);
    expect(isThanksPagePath("/ru/paldies")).toBe(true);
    expect(isThanksPagePath("/paldies")).toBe(true);
  });

  it("does not match other public paths", () => {
    expect(isThanksPagePath("/lv")).toBe(false);
    expect(isThanksPagePath("/lv/pakalpojumi")).toBe(false);
    expect(isThanksPagePath("/admin/paldies")).toBe(false);
  });
});

describe("thanks session cookie token", () => {
  beforeEach(() => {
    vi.stubEnv("THANKS_SESSION_SECRET", SECRET);
    vi.stubEnv("ADMIN_SECRET", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips a signed session id", async () => {
    const token = await signThanksSessionToken("cs_live_order12345");
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[0-9a-f]+$/);
    await expect(readThanksSessionIdFromToken(token)).resolves.toBe("cs_live_order12345");
  });

  it("rejects a tampered payload and a wrong secret", async () => {
    const token = await signThanksSessionToken("cs_live_order12345");
    expect(token).toBeTruthy();
    const [, sig] = token!.split(".");
    const swapped = Buffer.from(
      JSON.stringify({ typ: THANKS_SESSION_TOKEN_TYP, sid: "cs_live_other9999", exp: Date.now() + 60_000 }),
    ).toString("base64url");
    await expect(readThanksSessionIdFromToken(`${swapped}.${sig}`)).resolves.toBeNull();
    await expect(readThanksSessionIdFromToken(token, { secret: "another-secret-0123456789" })).resolves.toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await signThanksSessionToken("cs_live_order12345", { nowMs: 1_000, maxAgeSec: 10 });
    await expect(readThanksSessionIdFromToken(token, { nowMs: 20_000 })).resolves.toBeNull();
  });

  it("uses ADMIN_SECRET when a dedicated secret is not set", () => {
    expect(resolveThanksSessionSecret({ ADMIN_SECRET: "admin-secret-16ch", NODE_ENV: "production" } as NodeJS.ProcessEnv)).toBe(
      "admin-secret-16ch",
    );
    expect(resolveThanksSessionSecret({ NODE_ENV: "development" } as NodeJS.ProcessEnv)).toBe(
      THANKS_SESSION_DEV_FALLBACK_SECRET,
    );
    expect(resolveThanksSessionSecret({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toBe("");
  });

  it("sets httpOnly Secure SameSite=Lax on /", () => {
    expect(thanksSessionCookieOptions({ secure: true })).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  });
});

describe("URL cleanup before pixels", () => {
  it("removes session_id and keeps other query params", () => {
    expect(stripSessionIdFromHref("https://www.provin.lv/lv/paldies?session_id=cs_live_abc12345&utm=1#x")).toEqual({
      next: "/lv/paldies?utm=1#x",
      changed: true,
    });
    expect(stripSessionIdFromHref("/lv/paldies")).toEqual({ next: "/lv/paldies", changed: false });
  });

  it("treats a URL with session_id as unsafe for GA/Meta", () => {
    expect(thanksUrlIsSafeForPixels("https://www.provin.lv/lv/paldies?session_id=cs_live_abc12345")).toBe(false);
    expect(thanksUrlIsSafeForPixels("https://www.provin.lv/lv/paldies")).toBe(true);
  });

  it("replaceState snippet deletes session_id with history.replaceState", () => {
    expect(THANKS_SESSION_URL_CLEANUP_SNIPPET).toContain("history.replaceState");
    expect(THANKS_SESSION_URL_CLEANUP_SNIPPET).toContain('searchParams.delete("session_id")');
    expect(THANKS_SESSION_URL_CLEANUP_SNIPPET).not.toContain("—");
  });

  it("applyThanksSessionUrlCleanup calls replaceState before returning", () => {
    const replaceState = vi.fn();
    vi.stubGlobal("history", { state: { keep: true }, replaceState });
    const result = applyThanksSessionUrlCleanup("https://www.provin.lv/lv/paldies?session_id=cs_live_abc12345");
    expect(result).toEqual({ next: "/lv/paldies", changed: true });
    expect(replaceState).toHaveBeenCalledWith({ keep: true }, "", "/lv/paldies");
    vi.unstubAllGlobals();
  });
});

describe("decideThanksSessionCapture", () => {
  it("redirects /lv/paldies?session_id= to the same path without the param", () => {
    const searchParams = new URLSearchParams("session_id=cs_live_abc12345&utm=ad");
    expect(decideThanksSessionCapture({ pathname: "/lv/paldies", searchParams })).toEqual({
      action: "redirect",
      pathname: "/lv/paldies",
      search: "?utm=ad",
      sessionId: "cs_live_abc12345",
    });
  });

  it("does nothing without session_id or off the thanks page", () => {
    expect(decideThanksSessionCapture({ pathname: "/lv/paldies", searchParams: new URLSearchParams() })).toEqual({
      action: "none",
    });
    expect(
      decideThanksSessionCapture({
        pathname: "/lv/pakalpojumi",
        searchParams: new URLSearchParams("session_id=cs_live_abc12345"),
      }),
    ).toEqual({ action: "none" });
  });
});

describe("authorizeInvoiceDownload", () => {
  it("rejects URL-only session_id", () => {
    expect(authorizeInvoiceDownload({ cookieSessionId: null, querySessionId: "cs_live_abc12345" })).toEqual({
      ok: false,
      status: 401,
      error: "unauthorized",
    });
  });

  it("accepts a matching cookie and ignores a matching query", () => {
    expect(
      authorizeInvoiceDownload({ cookieSessionId: "cs_live_abc12345", querySessionId: "cs_live_abc12345" }),
    ).toEqual({ ok: true, sessionId: "cs_live_abc12345" });
    expect(authorizeInvoiceDownload({ cookieSessionId: "cs_live_abc12345" })).toEqual({
      ok: true,
      sessionId: "cs_live_abc12345",
    });
  });

  it("rejects a cookie/query mismatch", () => {
    expect(
      authorizeInvoiceDownload({ cookieSessionId: "cs_live_abc12345", querySessionId: "cs_live_other9999" }),
    ).toEqual({ ok: false, status: 403, error: "forbidden" });
  });
});

describe("invoice email link token", () => {
  it("builds a signed ?t= link without the raw session id", async () => {
    const url = await buildInvoiceDownloadUrl("https://www.provin.lv/", "cs_live_order12345", { secret: SECRET });
    expect(url.startsWith("https://www.provin.lv/api/invoice/download?t=")).toBe(true);
    expect(url).not.toContain("session_id");
    expect(url).not.toContain("cs_live_order12345");
    const t = new URL(url).searchParams.get("t");
    expect(await readInvoiceLinkSessionId(t, { secret: SECRET })).toBe("cs_live_order12345");
  });

  it("is not interchangeable with the /paldies cookie token", async () => {
    const link = await signInvoiceLinkToken("cs_live_order12345", { secret: SECRET });
    const cookie = await signThanksSessionToken("cs_live_order12345", { secret: SECRET });
    expect(await readThanksSessionIdFromToken(link, { secret: SECRET })).toBeNull();
    expect(await readInvoiceLinkSessionId(cookie, { secret: SECRET })).toBeNull();
    expect(await readInvoiceLinkSessionId(link, { secret: "another-secret-0123456789" })).toBeNull();
  });

  it("authorizes the email link on a device without the /paldies cookie", () => {
    expect(authorizeInvoiceDownload({ cookieSessionId: null, linkSessionId: "cs_live_abc12345" })).toEqual({
      ok: true,
      sessionId: "cs_live_abc12345",
    });
    expect(
      authorizeInvoiceDownload({
        cookieSessionId: null,
        linkSessionId: "cs_live_abc12345",
        querySessionId: "cs_live_other9999",
      }),
    ).toEqual({ ok: false, status: 403, error: "forbidden" });
  });
});
