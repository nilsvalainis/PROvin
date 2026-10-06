import { describe, expect, it } from "vitest";

import {
  CAPSOLVER_PROXIED_TIMEOUT_MS,
  CAPSOLVER_PROXYLESS_TIMEOUT_MS,
  captchaCreateTaskBody,
  capsolverProxyFromUrl,
  defaultCaptchaSolveTimeoutMs,
  getCaptchaSolverProxy,
  httpProxyUrlFromCapsolver,
  isCapsolverForceProxy,
  mntFormHttpProxyUrl,
  mntRecaptchaV3Proxy,
  parseCaptchaCreateTask,
  parseCaptchaTaskResult,
  prefixCaptchaSourceReason,
  solveCaptcha,
  vinStickyHttpProxyUrl,
} from "@/lib/captcha-solver";

const FIXIE_URL = "http://fixie:secret@group.usefixie.com:80";

function jsonFetch(handler: (url: string) => unknown): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    return { json: async () => handler(String(input)) } as Response;
  }) as typeof fetch;
}

describe("captchaCreateTaskBody", () => {
  it("veido reCAPTCHA v3 uzdevumu ar pageAction", () => {
    const body = captchaCreateTaskBody("key-1", {
      kind: "recaptcha_v3",
      websiteURL: "https://eteenindus.mnt.ee/public/soidukTaustakontroll.jsf",
      websiteKey: "6LfM2VUpAAAAAIxz2LW7-pZy2tcQpV1lA-B1kHCa",
      pageAction: "soiduk_otsing",
    });
    expect(body.clientKey).toBe("key-1");
    expect(body.task).toMatchObject({
      type: "ReCaptchaV3TaskProxyLess",
      pageAction: "soiduk_otsing",
    });
  });

  it("veido reCAPTCHA v2 uzdevumu", () => {
    const body = captchaCreateTaskBody("key-1", {
      kind: "recaptcha_v2",
      websiteURL: "https://lkf.ee/et/kahjukontroll",
      websiteKey: "6LdtedISAAAAABWNkw4vodbhMcB1SZ-ykU6A04fL",
    });
    expect(body.task).toMatchObject({ type: "ReCaptchaV2TaskProxyLess" });
  });

  it("reCAPTCHA v3 ar Fixie proxy lieto ReCaptchaV3Task URL formā", () => {
    const body = captchaCreateTaskBody("key-1", {
      kind: "recaptcha_v3",
      websiteURL: "https://eteenindus.mnt.ee/public/soidukTaustakontroll.jsf",
      websiteKey: "6LfM2VUpAAAAAIxz2LW7-pZy2tcQpV1lA-B1kHCa",
      pageAction: "soiduk_otsing",
      proxy: FIXIE_URL,
    });
    expect(body.task).toMatchObject({
      type: "ReCaptchaV3Task",
      proxy: FIXIE_URL,
      pageAction: "soiduk_otsing",
    });
  });

  it("reCAPTCHA v2 ar colon proxy pārveido uz URL formu", () => {
    const body = captchaCreateTaskBody("key-1", {
      kind: "recaptcha_v2",
      websiteURL: "https://lkf.ee/et/kahjukontroll",
      websiteKey: "6LdtedISAAAAABWNkw4vodbhMcB1SZ-ykU6A04fL",
      proxy: "group.usefixie.com:80:fixie:secret",
    });
    expect(body.task).toMatchObject({
      type: "ReCaptchaV2Task",
      proxy: FIXIE_URL,
    });
  });

  it("veido Cloudflare Challenge uzdevumu ar proxy URL formā", () => {
    const body = captchaCreateTaskBody("key-1", {
      kind: "cloudflare_challenge",
      websiteURL: "https://www.car.info/en-se/",
      proxy: "host.example:80:user:pass",
    });
    expect(body.task).toMatchObject({
      type: "AntiCloudflareTask",
      proxy: "http://user:pass@host.example:80",
    });
  });

  it("veido Turnstile uzdevumu", () => {
    const body = captchaCreateTaskBody("key-1", {
      kind: "turnstile",
      websiteURL: "https://www.car.info/en-se/",
      websiteKey: "0x4AAAAAAAtest",
    });
    expect(body.task).toMatchObject({ type: "AntiTurnstileTaskProxyLess" });
  });
});

describe("capsolverProxyFromUrl", () => {
  it("Fixie HTTP URL paliek CapSolver URL formā (DNS)", () => {
    expect(capsolverProxyFromUrl("http://fixie:secret@group.usefixie.com:80")).toBe(FIXIE_URL);
    expect(capsolverProxyFromUrl("http://fixie:secret@group.usefixie.com")).toBe(FIXIE_URL);
  });

  it("colon proxy pārveido uz CapSolver URL formu", () => {
    expect(capsolverProxyFromUrl("group.usefixie.com:80:fixie:secret")).toBe(FIXIE_URL);
    expect(capsolverProxyFromUrl("http:group.usefixie.com:80:fixie:secret")).toBe(FIXIE_URL);
  });

  it("atgriež HTTP URL undici ProxyAgent", () => {
    expect(httpProxyUrlFromCapsolver("group.usefixie.com:80:fixie:secret")).toBe(FIXIE_URL);
    expect(httpProxyUrlFromCapsolver(FIXIE_URL)).toBe(FIXIE_URL);
  });

  it("FIXIE_URL bez CAPSOLVER_PROXY dod sticky HTTP proxy", () => {
    const prevFixie = process.env.FIXIE_URL;
    const prevCap = process.env.CAPSOLVER_PROXY;
    process.env.FIXIE_URL = "http://fixie:secret@group.usefixie.com:80";
    delete process.env.CAPSOLVER_PROXY;
    try {
      expect(getCaptchaSolverProxy()).toBe(FIXIE_URL);
      expect(vinStickyHttpProxyUrl()).toBe(FIXIE_URL);
    } finally {
      if (prevFixie === undefined) delete process.env.FIXIE_URL;
      else process.env.FIXIE_URL = prevFixie;
      if (prevCap === undefined) delete process.env.CAPSOLVER_PROXY;
      else process.env.CAPSOLVER_PROXY = prevCap;
    }
  });

  it("CAPSOLVER_PROXY colon formu pārveido uz URL", () => {
    const prevFixie = process.env.FIXIE_URL;
    const prevCap = process.env.CAPSOLVER_PROXY;
    process.env.CAPSOLVER_PROXY = "group.usefixie.com:80:fixie:secret";
    delete process.env.FIXIE_URL;
    try {
      expect(getCaptchaSolverProxy()).toBe(FIXIE_URL);
      expect(vinStickyHttpProxyUrl()).toBe(FIXIE_URL);
    } finally {
      if (prevFixie === undefined) delete process.env.FIXIE_URL;
      else process.env.FIXIE_URL = prevFixie;
      if (prevCap === undefined) delete process.env.CAPSOLVER_PROXY;
      else process.env.CAPSOLVER_PROXY = prevCap;
    }
  });
});

describe("defaultCaptchaSolveTimeoutMs", () => {
  it("proxied reCAPTCHA gaida 120 s", () => {
    expect(
      defaultCaptchaSolveTimeoutMs({
        kind: "recaptcha_v3",
        websiteURL: "https://eteenindus.mnt.ee/",
        websiteKey: "k",
        pageAction: "soiduk_otsing",
        proxy: FIXIE_URL,
      }),
    ).toBe(CAPSOLVER_PROXIED_TIMEOUT_MS);
    expect(CAPSOLVER_PROXIED_TIMEOUT_MS).toBe(120_000);
  });

  it("ProxyLess paliek 45 s", () => {
    expect(
      defaultCaptchaSolveTimeoutMs({
        kind: "recaptcha_v2",
        websiteURL: "https://lkf.ee/",
        websiteKey: "k",
      }),
    ).toBe(CAPSOLVER_PROXYLESS_TIMEOUT_MS);
  });
});

describe("parseCaptchaCreateTask", () => {
  it("ņem taskId", () => {
    expect(parseCaptchaCreateTask({ errorId: 0, taskId: "abc-1" })).toEqual({ taskId: "abc-1" });
  });

  it("kļūdu tekstu neslēpj", () => {
    const parsed = parseCaptchaCreateTask({ errorId: 1, errorDescription: "ERROR_KEY_DENIED" });
    expect("reason" in parsed && parsed.reason).toContain("ERROR_KEY_DENIED");
  });
});

describe("parseCaptchaTaskResult", () => {
  it("gaida, kamēr statuss processing", () => {
    expect(parseCaptchaTaskResult({ errorId: 0, status: "processing" })).toEqual({ pending: true });
  });

  it("atdod gRecaptchaResponse", () => {
    expect(parseCaptchaTaskResult({ errorId: 0, status: "ready", solution: { gRecaptchaResponse: "tok-9" } })).toEqual({
      ok: true,
      token: "tok-9",
      cookies: {},
      userAgent: "",
    });
  });

  it("ņem recaptcha-ca-t sīkdatni no v3 solution", () => {
    expect(
      parseCaptchaTaskResult({
        errorId: 0,
        status: "ready",
        solution: { gRecaptchaResponse: "tok-v3", "recaptcha-ca-t": "ca-t-1" },
      }),
    ).toEqual({
      ok: true,
      token: "tok-v3",
      cookies: { "recaptcha-ca-t": "ca-t-1" },
      userAgent: "",
    });
  });

  it("ņem cf_clearance no Cloudflare solution", () => {
    expect(
      parseCaptchaTaskResult({
        errorId: 0,
        status: "ready",
        solution: {
          cookies: { cf_clearance: "cf-1" },
          userAgent: "Mozilla/5.0",
        },
      }),
    ).toEqual({
      ok: true,
      token: "cf-1",
      cookies: { cf_clearance: "cf-1" },
      userAgent: "Mozilla/5.0",
    });
  });
});

describe("solveCaptcha", () => {
  const proxiedV2 = {
    kind: "recaptcha_v2" as const,
    websiteURL: "https://lkf.ee/et/kahjukontroll",
    websiteKey: "6LdtedISAAAAABWNkw4vodbhMcB1SZ-ykU6A04fL",
    proxy: FIXIE_URL,
  };

  it("atkārto createTask vienu reizi pie custom proxy connect failed", async () => {
    let creates = 0;
    const fetchImpl = jsonFetch((url) => {
      if (url.includes("createTask")) {
        creates += 1;
        if (creates === 1) {
          return { errorId: 1, errorDescription: "custom proxy connect failed" };
        }
        return { errorId: 0, taskId: "t-2" };
      }
      return { errorId: 0, status: "ready", solution: { gRecaptchaResponse: "tok" } };
    });
    const result = await solveCaptcha(proxiedV2, {
      apiKey: "12345678key",
      fetchImpl,
      sleep: async () => undefined,
      timeoutMs: 5_000,
    });
    expect(creates).toBe(2);
    expect(result).toMatchObject({ ok: true, token: "tok" });
  });

  it("neatkārto createTask bez proxy", async () => {
    let creates = 0;
    const fetchImpl = jsonFetch((url) => {
      if (url.includes("createTask")) {
        creates += 1;
        return { errorId: 1, errorDescription: "custom proxy connect failed" };
      }
      return { errorId: 0, status: "ready", solution: { gRecaptchaResponse: "tok" } };
    });
    const result = await solveCaptcha(
      { kind: "recaptcha_v2", websiteURL: "https://lkf.ee/", websiteKey: "k" },
      { apiKey: "12345678key", fetchImpl, sleep: async () => undefined, timeoutMs: 5_000 },
    );
    expect(creates).toBe(1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("custom proxy connect failed");
  });

  it("otro createTask kļūdu vairs neatkārto", async () => {
    let creates = 0;
    const fetchImpl = jsonFetch((url) => {
      if (url.includes("createTask")) {
        creates += 1;
        return { errorId: 1, errorDescription: "custom proxy connect failed" };
      }
      return { errorId: 0, status: "ready", solution: { gRecaptchaResponse: "tok" } };
    });
    const result = await solveCaptcha(proxiedV2, {
      apiKey: "12345678key",
      fetchImpl,
      sleep: async () => undefined,
      timeoutMs: 5_000,
    });
    expect(creates).toBe(2);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("custom proxy connect failed");
  });

  it("pievieno avota prefiksu CapSolver kļūdai", async () => {
    const fetchImpl = jsonFetch(() => ({ errorId: 1, errorDescription: "Failed to solve the captcha: 1001" }));
    const result = await solveCaptcha(
      {
        kind: "recaptcha_v3",
        websiteURL: "https://eteenindus.mnt.ee/public/soidukTaustakontroll.jsf",
        websiteKey: "6LfM2VUpAAAAAIxz2LW7-pZy2tcQpV1lA-B1kHCa",
        pageAction: "soiduk_otsing",
      },
      { apiKey: "12345678key", fetchImpl, sleep: async () => undefined, timeoutMs: 5_000, sourceLabel: "mnt.ee" },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("mnt.ee: CapSolver: Failed to solve the captcha: 1001");
  });

  it("lkf.ee prefiksu nedubulto, ja jau ir", () => {
    expect(prefixCaptchaSourceReason("lkf.ee: CapSolver: timeout", "lkf.ee")).toBe("lkf.ee: CapSolver: timeout");
    expect(prefixCaptchaSourceReason("CapSolver: žetons neatnāca laikā", "lkf.ee")).toBe(
      "lkf.ee: CapSolver: žetons neatnāca laikā",
    );
  });
});

describe("mnt.ee ProxyLess vs CAPSOLVER_FORCE_PROXY", () => {
  const prev = {
    FIXIE_URL: process.env.FIXIE_URL,
    CAPSOLVER_PROXY: process.env.CAPSOLVER_PROXY,
    CAPSOLVER_FORCE_PROXY: process.env.CAPSOLVER_FORCE_PROXY,
  };

  function restoreEnv() {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }

  it("ar FIXIE_URL bez FORCE_PROXY neatdod V3 proxy un HTTP paliek tiešs", () => {
    process.env.FIXIE_URL = FIXIE_URL;
    delete process.env.CAPSOLVER_PROXY;
    delete process.env.CAPSOLVER_FORCE_PROXY;
    try {
      expect(isCapsolverForceProxy()).toBe(false);
      expect(mntRecaptchaV3Proxy()).toBeUndefined();
      expect(mntFormHttpProxyUrl()).toBeUndefined();
      expect(vinStickyHttpProxyUrl()).toBe(FIXIE_URL);
      const body = captchaCreateTaskBody("key-1", {
        kind: "recaptcha_v3",
        websiteURL: "https://eteenindus.mnt.ee/public/soidukTaustakontroll.jsf",
        websiteKey: "6LfM2VUpAAAAAIxz2LW7-pZy2tcQpV1lA-B1kHCa",
        pageAction: "soiduk_otsing",
        proxy: mntRecaptchaV3Proxy(),
      });
      expect(body.task).toMatchObject({ type: "ReCaptchaV3TaskProxyLess" });
      expect((body.task as { proxy?: string }).proxy).toBeUndefined();
    } finally {
      restoreEnv();
    }
  });

  it("CAPSOLVER_FORCE_PROXY=1 atjauno Fixie V3 un HTTP proxy", () => {
    process.env.FIXIE_URL = FIXIE_URL;
    delete process.env.CAPSOLVER_PROXY;
    process.env.CAPSOLVER_FORCE_PROXY = "1";
    try {
      expect(isCapsolverForceProxy()).toBe(true);
      expect(mntRecaptchaV3Proxy()).toBe(FIXIE_URL);
      expect(mntFormHttpProxyUrl()).toBe(FIXIE_URL);
      const body = captchaCreateTaskBody("key-1", {
        kind: "recaptcha_v3",
        websiteURL: "https://eteenindus.mnt.ee/public/soidukTaustakontroll.jsf",
        websiteKey: "6LfM2VUpAAAAAIxz2LW7-pZy2tcQpV1lA-B1kHCa",
        pageAction: "soiduk_otsing",
        proxy: mntRecaptchaV3Proxy(),
      });
      expect(body.task).toMatchObject({ type: "ReCaptchaV3Task", proxy: FIXIE_URL });
    } finally {
      restoreEnv();
    }
  });
});
