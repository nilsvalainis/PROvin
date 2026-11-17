import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  cloudflareChallengeTaskQueue,
  getCaptchaSolverProxy,
  mntFormHttpProxyUrl,
  mntRecaptchaV3Proxy,
  parseCaptchaCreateTask,
  parseCaptchaTaskResult,
  redactProxySecrets,
  solveCaptcha,
  vinStickyHttpProxyUrl,
} from "@/lib/captcha-solver";

const OWN = "http://vinuser:ownSecret77@vinproxy.test.invalid:3128";
const CAP = "http://capuser:capSecret88@cap.test.invalid:8000";
const FIXIE = "http://fixie:fixieSecret99@group.usefixie.test.invalid:80";

function setProxies(env: { own?: string; cap?: string; fixie?: string; force?: string }) {
  vi.stubEnv("VIN_PROXY_URL", env.own ?? "");
  vi.stubEnv("CAPSOLVER_PROXY", env.cap ?? "");
  vi.stubEnv("FIXIE_URL", env.fixie ?? "");
  vi.stubEnv("CAPSOLVER_FORCE_PROXY", env.force ?? "");
}

describe("sticky proxy prioritāte", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("VIN_PROXY_URL pirms CAPSOLVER_PROXY un FIXIE_URL", () => {
    setProxies({ own: OWN, cap: CAP, fixie: FIXIE });
    expect(getCaptchaSolverProxy()).toBe(OWN);
    expect(vinStickyHttpProxyUrl()).toBe(OWN);
  });

  it("bez VIN_PROXY_URL - CAPSOLVER_PROXY, tad FIXIE_URL", () => {
    setProxies({ cap: CAP, fixie: FIXIE });
    expect(getCaptchaSolverProxy()).toBe(CAP);
    setProxies({ fixie: FIXIE });
    expect(getCaptchaSolverProxy()).toBe(FIXIE);
    expect(vinStickyHttpProxyUrl()).toBe(FIXIE);
  });

  it("VIN_PROXY_URL colon formu pārveido uz URL", () => {
    setProxies({ own: "vinproxy.test.invalid:3128:vinuser:ownSecret77", fixie: FIXIE });
    expect(getCaptchaSolverProxy()).toBe(OWN);
  });

  it("nederīgu VIN_PROXY_URL izlaiž un ņem nākamo", () => {
    setProxies({ own: "nav-proxy", fixie: FIXIE });
    expect(getCaptchaSolverProxy()).toBe(FIXIE);
  });

  it("bez neviena proxy - tukšs", () => {
    setProxies({});
    expect(getCaptchaSolverProxy()).toBe("");
    expect(vinStickyHttpProxyUrl()).toBeUndefined();
  });

  it("mnt.ee getteri joprojām tikai ar CAPSOLVER_FORCE_PROXY, bet ņem VIN_PROXY_URL", () => {
    setProxies({ own: OWN, fixie: FIXIE });
    expect(mntFormHttpProxyUrl()).toBeUndefined();
    expect(mntRecaptchaV3Proxy()).toBeUndefined();
    setProxies({ own: OWN, fixie: FIXIE, force: "1" });
    expect(mntFormHttpProxyUrl()).toBe(OWN);
    expect(mntRecaptchaV3Proxy()).toBe(OWN);
  });

  it("Cloudflare rinda sāk ar VIN_PROXY_URL, Fixie paliek kā rezerve", () => {
    setProxies({ own: OWN, fixie: FIXIE });
    const queue = cloudflareChallengeTaskQueue({ kind: "cloudflare_challenge", websiteURL: "https://x.test.invalid/" });
    expect(queue[0]).toMatchObject({ proxy: "http:vinproxy.test.invalid:3128:vinuser:ownSecret77" });
    expect(queue.some((t) => t.proxy?.includes("usefixie"))).toBe(true);
  });

  it("Cloudflare rinda tikai ar VIN_PROXY_URL nav tukša", () => {
    setProxies({ own: OWN });
    expect(cloudflareChallengeTaskQueue({ kind: "cloudflare_challenge", websiteURL: "https://x.test.invalid/" })).not.toEqual(
      [],
    );
  });
});

describe("redactProxySecrets", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("noņem user:pass no jebkura URL", () => {
    const out = redactProxySecrets("connect failed http://someone:p4ss@1.2.3.4:80 and socks5://a:b@h:1", {});
    expect(out).toBe("connect failed http://***@1.2.3.4:80 and socks5://***@h:1");
  });

  it("noņem konfigurēto proxy URL un colon formas", () => {
    const env = { VIN_PROXY_URL: OWN, FIXIE_URL: FIXIE };
    const text = [
      "a vinproxy.test.invalid:3128:vinuser:ownSecret77",
      "b http:vinproxy.test.invalid:3128:vinuser:ownSecret77",
      "c group.usefixie.test.invalid:80:fixie:fixieSecret99",
      "d pass=ownSecret77",
    ].join(" | ");
    const out = redactProxySecrets(text, env);
    expect(out).not.toContain("ownSecret77");
    expect(out).not.toContain("fixieSecret99");
    expect(out).not.toContain("vinuser");
    expect(out).toContain("***");
  });

  it("bez proxy env teksts bez URL paliek nemainīts", () => {
    expect(redactProxySecrets("CapSolver: ERROR_ZERO_BALANCE", {})).toBe("CapSolver: ERROR_ZERO_BALANCE");
  });

  it("risinātāja errorDescription iemesli ir bez paroles", () => {
    setProxies({ own: OWN });
    const created = parseCaptchaCreateTask({
      errorId: 1,
      errorDescription: "custom proxy connect failed: vinproxy.test.invalid:3128:vinuser:ownSecret77",
    });
    expect("reason" in created && created.reason).toBeTruthy();
    expect(JSON.stringify(created)).not.toContain("ownSecret77");
    const result = parseCaptchaTaskResult({ errorId: 1, errorDescription: `bad proxy ${OWN}` });
    expect(JSON.stringify(result)).not.toContain("ownSecret77");
  });
});

describe("solveCaptcha tīkla kļūda bez paroles", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    warn.mockRestore();
  });

  it("e.message ar proxy URL tiek aizvietots", async () => {
    setProxies({ own: OWN });
    const fetchImpl = vi.fn(async () => {
      throw new Error(`connect ECONNREFUSED via ${OWN}`);
    }) as unknown as typeof fetch;
    const out = await solveCaptcha(
      { kind: "recaptcha_v2", websiteURL: "https://lkf.test.invalid/", websiteKey: "k", proxy: OWN },
      { apiKey: "test-key-123456", fetchImpl, sleep: async () => {} },
    );
    expect(out.ok).toBe(false);
    expect(JSON.stringify(out)).not.toContain("ownSecret77");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("ownSecret77");
  });
});
