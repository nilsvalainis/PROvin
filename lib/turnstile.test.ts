import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TURNSTILE_SECRET_KEY_ENV,
  TURNSTILE_SITE_KEY_ENV,
  TURNSTILE_SITEVERIFY_URL,
  gatePartnerLoginTurnstile,
  getTurnstileSecretKey,
  getTurnstileSiteKey,
  isPartnerLoginTurnstileEnabled,
  parseTurnstileKey,
  parseTurnstileToken,
  verifyTurnstileToken,
} from "./turnstile";

const SITE = "0x4AAAAAABtestsitekey01";
const SECRET = "0x4AAAAAABtestsecretkey01";
const TOKEN = "0.abcdefghijklmnopqrstuvwxyz0123456789";

function envWith(keys: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { ...keys } as NodeJS.ProcessEnv;
}

describe("Turnstile env flag", () => {
  it("parses Cloudflare-shaped keys and rejects junk", () => {
    expect(parseTurnstileKey(SITE)).toBe(SITE);
    expect(parseTurnstileKey(` ${SECRET} `)).toBe(SECRET);
    expect(parseTurnstileKey("")).toBeNull();
    expect(parseTurnstileKey("0")).toBeNull();
    expect(parseTurnstileKey("short")).toBeNull();
    expect(parseTurnstileKey("<script>")).toBeNull();
  });

  it("stays off unless both site and secret keys exist", () => {
    expect(isPartnerLoginTurnstileEnabled(envWith({}))).toBe(false);
    expect(isPartnerLoginTurnstileEnabled(envWith({ [TURNSTILE_SITE_KEY_ENV]: SITE }))).toBe(false);
    expect(isPartnerLoginTurnstileEnabled(envWith({ [TURNSTILE_SECRET_KEY_ENV]: SECRET }))).toBe(false);
    expect(
      isPartnerLoginTurnstileEnabled(
        envWith({ [TURNSTILE_SITE_KEY_ENV]: SITE, [TURNSTILE_SECRET_KEY_ENV]: SECRET }),
      ),
    ).toBe(true);
    expect(getTurnstileSiteKey(envWith({ [TURNSTILE_SITE_KEY_ENV]: SITE }))).toBe(SITE);
    expect(getTurnstileSecretKey(envWith({ [TURNSTILE_SECRET_KEY_ENV]: SECRET }))).toBe(SECRET);
  });
});

describe("parseTurnstileToken", () => {
  it("accepts a compact widget token", () => {
    expect(parseTurnstileToken(TOKEN)).toBe(TOKEN);
  });

  it("rejects empty, short, or spaced values", () => {
    expect(parseTurnstileToken("")).toBeNull();
    expect(parseTurnstileToken("tok")).toBeNull();
    expect(parseTurnstileToken("abc def")).toBeNull();
    expect(parseTurnstileToken(1)).toBeNull();
  });
});

describe("verifyTurnstileToken", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("posts secret+response to siteverify and accepts success", async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe(TURNSTILE_SITEVERIFY_URL);
      const posted = decodeURIComponent(String(init?.body));
      expect(posted).toContain(`secret=${SECRET}`);
      expect(posted).toContain(`response=${TOKEN}`);
      expect(posted).toContain("remoteip=1.2.3.4");
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });
    await expect(
      verifyTurnstileToken({ token: TOKEN, remoteIp: "1.2.3.4", secret: SECRET, fetchImpl }),
    ).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("rejects Cloudflare failure and missing token without calling network", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ success: false }), { status: 200 }));
    await expect(verifyTurnstileToken({ token: TOKEN, secret: SECRET, fetchImpl })).resolves.toEqual({
      ok: false,
      reason: "rejected",
    });
    await expect(verifyTurnstileToken({ token: null, secret: SECRET, fetchImpl })).resolves.toEqual({
      ok: false,
      reason: "missing",
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("treats a down siteverify as unavailable", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network");
    });
    await expect(verifyTurnstileToken({ token: TOKEN, secret: SECRET, fetchImpl })).resolves.toEqual({
      ok: false,
      reason: "unavailable",
    });
  });
});

describe("gatePartnerLoginTurnstile", () => {
  it("allows login unchanged when env keys are missing", async () => {
    const verify = vi.fn();
    await expect(
      gatePartnerLoginTurnstile({ token: null, env: envWith({}), verify }),
    ).resolves.toEqual({ ok: true, required: false });
    expect(verify).not.toHaveBeenCalled();
  });

  it("blocks strangers without a token before password checks", async () => {
    const env = envWith({ [TURNSTILE_SITE_KEY_ENV]: SITE, [TURNSTILE_SECRET_KEY_ENV]: SECRET });
    await expect(gatePartnerLoginTurnstile({ token: null, env })).resolves.toEqual({
      ok: false,
      required: true,
      status: 400,
      error: "turnstile_required",
    });
  });

  it("accepts a server-verified token", async () => {
    const env = envWith({ [TURNSTILE_SITE_KEY_ENV]: SITE, [TURNSTILE_SECRET_KEY_ENV]: SECRET });
    const verify = vi.fn(async () => ({ ok: true as const }));
    await expect(gatePartnerLoginTurnstile({ token: TOKEN, remoteIp: "9.9.9.9", env, verify })).resolves.toEqual({
      ok: true,
      required: true,
    });
    expect(verify).toHaveBeenCalledWith({ token: TOKEN, remoteIp: "9.9.9.9", secret: SECRET });
  });

  it("rejects a failed siteverify", async () => {
    const env = envWith({ [TURNSTILE_SITE_KEY_ENV]: SITE, [TURNSTILE_SECRET_KEY_ENV]: SECRET });
    const verify = vi.fn(async () => ({ ok: false as const, reason: "rejected" as const }));
    await expect(gatePartnerLoginTurnstile({ token: TOKEN, env, verify })).resolves.toEqual({
      ok: false,
      required: true,
      status: 400,
      error: "turnstile_failed",
    });
  });
});

describe("client bundle site key", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads NEXT_PUBLIC_TURNSTILE_SITE_KEY literally so Next.js can inline it in the browser", () => {
    const src = readFileSync(join(__dirname, "turnstile.ts"), "utf8");
    expect(src).toContain("process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY");
    vi.stubEnv(TURNSTILE_SITE_KEY_ENV, SITE);
    expect(getTurnstileSiteKey()).toBe(SITE);
  });
});
