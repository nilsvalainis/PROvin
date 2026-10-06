import { describe, expect, it } from "vitest";

import {
  CAPSOLVER_PROXIED_TIMEOUT_MS,
  CAPSOLVER_PROXYLESS_TIMEOUT_MS,
  captchaCreateTaskBody,
  captchaProvider,
  captchaTaskDisplayName,
  captchaTaskTypeName,
  capsolverProxyFromUrl,
  defaultCaptchaSolveTimeoutMs,
  formatCaptchaPollTimeoutReason,
  getCaptchaSolverProxy,
  httpProxyUrlFromCapsolver,
  isCapsolverForceProxy,
  isMntRecaptchaM1FallbackEnabled,
  mntFormHttpProxyUrl,
  mntRecaptchaV3Proxy,
  parseCaptchaCreateTask,
  parseCaptchaTaskResult,
  prefixCaptchaSourceReason,
  recaptchaV3FallbackProviders,
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

  it("reCAPTCHA v3 variant m1 dod ReCaptchaV3M1Task / ProxyLess", () => {
    const base = {
      kind: "recaptcha_v3" as const,
      websiteURL: "https://eteenindus.mnt.ee/public/soidukTaustakontroll.jsf",
      websiteKey: "6LfM2VUpAAAAAIxz2LW7-pZy2tcQpV1lA-B1kHCa",
      pageAction: "soiduk_otsing",
    };
    expect(captchaCreateTaskBody("key-1", { ...base, variant: "m1" }).task).toMatchObject({
      type: "ReCaptchaV3M1TaskProxyLess",
      pageAction: "soiduk_otsing",
    });
    expect(captchaTaskTypeName({ ...base, variant: "m1" })).toBe("ReCaptchaV3M1TaskProxyLess");
    expect(captchaTaskTypeName({ ...base, variant: "standard" })).toBe("ReCaptchaV3TaskProxyLess");
    expect(captchaCreateTaskBody("key-1", { ...base, variant: "m1", proxy: FIXIE_URL }).task).toMatchObject({
      type: "ReCaptchaV3M1Task",
      proxy: FIXIE_URL,
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

  it("ProxyLess gaida 90 s", () => {
    expect(
      defaultCaptchaSolveTimeoutMs({
        kind: "recaptcha_v2",
        websiteURL: "https://lkf.ee/",
        websiteKey: "k",
      }),
    ).toBe(CAPSOLVER_PROXYLESS_TIMEOUT_MS);
    expect(CAPSOLVER_PROXYLESS_TIMEOUT_MS).toBe(90_000);
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

  it("Anti-Captcha risinātājs: savi URL, skaitlisks taskId un savs kļūdu prefikss", async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      calls.push({ url, body });
      if (url.includes("getTaskResult")) {
        return {
          json: async () => ({ errorId: 0, status: "ready", solution: { gRecaptchaResponse: "tok-anti" } }),
        } as Response;
      }
      return { json: async () => ({ errorId: 0, taskId: 987654321 }) } as Response;
    }) as typeof fetch;
    const result = await solveCaptcha(
      {
        kind: "recaptcha_v3",
        websiteURL: "https://eteenindus.mnt.ee/public/soidukTaustakontroll.jsf",
        websiteKey: "6LfM2VUpAAAAAIxz2LW7-pZy2tcQpV1lA-B1kHCa",
        pageAction: "soiduk_otsing",
        minScore: 0.9,
      },
      {
        provider: captchaProvider("anticaptcha", "anticaptcha-key-123"),
        fetchImpl,
        sleep: async () => undefined,
        timeoutMs: 5_000,
        sourceLabel: "mnt.ee",
      },
    );
    expect(result).toMatchObject({ ok: true, token: "tok-anti" });
    expect(calls[0]?.url).toBe("https://api.anti-captcha.com/createTask");
    expect(calls[0]?.body).toMatchObject({
      clientKey: "anticaptcha-key-123",
      task: { type: "RecaptchaV3TaskProxyless", minScore: 0.9, pageAction: "soiduk_otsing" },
    });
    expect(calls[1]?.url).toBe("https://api.anti-captcha.com/getTaskResult");
    expect(calls[1]?.body).toEqual({ clientKey: "anticaptcha-key-123", taskId: 987654321 });

    const failing = await solveCaptcha(
      {
        kind: "recaptcha_v3",
        websiteURL: "https://eteenindus.mnt.ee/public/soidukTaustakontroll.jsf",
        websiteKey: "6LfM2VUpAAAAAIxz2LW7-pZy2tcQpV1lA-B1kHCa",
        pageAction: "soiduk_otsing",
      },
      {
        provider: captchaProvider("2captcha", "twocaptcha-key-123"),
        fetchImpl: jsonFetch(() => ({ errorId: 1, errorCode: "ERROR_ZERO_BALANCE" })),
        sleep: async () => undefined,
        timeoutMs: 5_000,
        sourceLabel: "mnt.ee",
      },
    );
    expect(failing).toEqual({ ok: false, reason: "mnt.ee: 2Captcha: ERROR_ZERO_BALANCE" });

    const noKey = await solveCaptcha(
      {
        kind: "recaptcha_v3",
        websiteURL: "https://eteenindus.mnt.ee/public/soidukTaustakontroll.jsf",
        websiteKey: "k",
        pageAction: "soiduk_otsing",
      },
      { provider: captchaProvider("capmonster", ""), fetchImpl, sleep: async () => undefined, timeoutMs: 5_000 },
    );
    expect(noKey).toEqual({ ok: false, reason: "Nav CAPMONSTER_API_KEY" });
  });

  it("ņem žetonu no createTask ready, bez getTaskResult", async () => {
    let polls = 0;
    const fetchImpl = jsonFetch((url) => {
      if (url.includes("getTaskResult")) {
        polls += 1;
        return { errorId: 0, status: "processing" };
      }
      return {
        errorId: 0,
        status: "ready",
        taskId: "t-ready",
        solution: { gRecaptchaResponse: "tok-now" },
      };
    });
    const result = await solveCaptcha(
      {
        kind: "recaptcha_v3",
        websiteURL: "https://eteenindus.mnt.ee/public/soidukTaustakontroll.jsf",
        websiteKey: "6LfM2VUpAAAAAIxz2LW7-pZy2tcQpV1lA-B1kHCa",
        pageAction: "soiduk_otsing",
      },
      { apiKey: "12345678key", fetchImpl, sleep: async () => undefined, timeoutMs: 5_000 },
    );
    expect(polls).toBe(0);
    expect(result).toMatchObject({ ok: true, token: "tok-now" });
  });

  it("createTask tukšu HTTP 502 neslēpj aiz poll noildzes", async () => {
    const fetchImpl = (async () =>
      ({
        status: 502,
        json: async () => {
          throw new Error("no json");
        },
      }) as unknown as Response) as typeof fetch;
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
    if (!result.ok) {
      expect(result.reason).toContain("mnt.ee: CapSolver createTask: tukša atbilde (HTTP 502)");
      expect(result.reason).not.toContain("žetons neatnāca laikā");
    }
  });

  it("ProxyLess pēc pending noildzes atkārto createTask vienu reizi", async () => {
    let creates = 0;
    let t = 0;
    const fetchImpl = jsonFetch((url) => {
      if (url.includes("createTask")) {
        creates += 1;
        return { errorId: 0, taskId: `t-${creates}` };
      }
      if (creates === 1) return { errorId: 0, status: "processing" };
      return { errorId: 0, status: "ready", solution: { gRecaptchaResponse: "tok-retry" } };
    });
    const result = await solveCaptcha(
      {
        kind: "recaptcha_v3",
        websiteURL: "https://eteenindus.mnt.ee/public/soidukTaustakontroll.jsf",
        websiteKey: "6LfM2VUpAAAAAIxz2LW7-pZy2tcQpV1lA-B1kHCa",
        pageAction: "soiduk_otsing",
      },
      {
        apiKey: "12345678key",
        fetchImpl,
        timeoutMs: 4_000,
        now: () => t,
        sleep: async (ms) => {
          t += ms;
        },
      },
    );
    expect(creates).toBe(2);
    expect(result).toMatchObject({ ok: true, token: "tok-retry" });
  });

  it("ProxyLess otrā mēģinājuma noildzē rāda taskId un statusu", async () => {
    let creates = 0;
    let t = 0;
    const fetchImpl = jsonFetch((url) => {
      if (url.includes("createTask")) {
        creates += 1;
        return { errorId: 0, taskId: "abcdef01-rest-of-id" };
      }
      return { errorId: 0, status: "processing" };
    });
    const result = await solveCaptcha(
      {
        kind: "recaptcha_v3",
        websiteURL: "https://eteenindus.mnt.ee/public/soidukTaustakontroll.jsf",
        websiteKey: "6LfM2VUpAAAAAIxz2LW7-pZy2tcQpV1lA-B1kHCa",
        pageAction: "soiduk_otsing",
      },
      {
        apiKey: "12345678key",
        fetchImpl,
        timeoutMs: 4_000,
        sourceLabel: "mnt.ee",
        now: () => t,
        sleep: async (ms) => {
          t += ms;
        },
      },
    );
    expect(creates).toBe(2);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe(
        "mnt.ee: CapSolver: žetons neatnāca laikā (ReCaptchaV3TaskProxyLess, uzdevums abcdef01, statuss processing, mēģinājums 2/2)",
      );
    }
  });

  it("proxied pending noildzi neatkarī createTask", async () => {
    let creates = 0;
    let t = 0;
    const fetchImpl = jsonFetch((url) => {
      if (url.includes("createTask")) {
        creates += 1;
        return { errorId: 0, taskId: "proxied-1" };
      }
      return { errorId: 0, status: "idle" };
    });
    const result = await solveCaptcha(proxiedV2, {
      apiKey: "12345678key",
      fetchImpl,
      timeoutMs: 4_000,
      now: () => t,
      sleep: async (ms) => {
        t += ms;
      },
    });
    expect(creates).toBe(1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("ReCaptchaV2Task");
      expect(result.reason).toContain("statuss idle");
      expect(result.reason).not.toContain("mēģinājums");
    }
  });

  it("formatē noildzes iemeslu ar ProxyLess tipu", () => {
    expect(captchaTaskTypeName({ kind: "recaptcha_v2", websiteURL: "https://lkf.ee/", websiteKey: "k" })).toBe(
      "ReCaptchaV2TaskProxyLess",
    );
    expect(
      formatCaptchaPollTimeoutReason({
        taskType: "ReCaptchaV3TaskProxyLess",
        taskId: "37223a89-06ed-442c-a0b8",
        lastStatus: "processing",
        attempt: 2,
        maxAttempts: 2,
      }),
    ).toBe(
      "CapSolver: žetons neatnāca laikā (ReCaptchaV3TaskProxyLess, uzdevums 37223a89, statuss processing, mēģinājums 2/2)",
    );
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

  it("rezerves risinātāji tikai ar atslēgu env, Anti-Captcha protokola secībā", () => {
    expect(recaptchaV3FallbackProviders({})).toEqual([]);
    const providers = recaptchaV3FallbackProviders({
      TWOCAPTCHA_API_KEY: "twocaptcha-key-123",
      ANTICAPTCHA_API_KEY: "anticaptcha-key-123",
      CAPMONSTER_API_KEY: "short",
    });
    expect(providers.map((p) => p.id)).toEqual(["anticaptcha", "2captcha"]);
    expect(providers[0]).toMatchObject({
      label: "Anti-Captcha",
      createUrl: "https://api.anti-captcha.com/createTask",
      resultUrl: "https://api.anti-captcha.com/getTaskResult",
    });
    expect(providers[1]?.createUrl).toBe("https://api.2captcha.com/createTask");
  });

  it("citam risinātājam V3 uzdevums ir RecaptchaV3TaskProxyless ar minScore, bez M1 un proxy", () => {
    const task = {
      kind: "recaptcha_v3" as const,
      websiteURL: "https://eteenindus.mnt.ee/public/soidukTaustakontroll.jsf",
      websiteKey: "6LfM2VUpAAAAAIxz2LW7-pZy2tcQpV1lA-B1kHCa",
      pageAction: "soiduk_otsing",
      variant: "m1" as const,
      proxy: FIXIE_URL,
    };
    const body = captchaCreateTaskBody("anti-key", task, "anticaptcha");
    expect(body).toEqual({
      clientKey: "anti-key",
      task: {
        type: "RecaptchaV3TaskProxyless",
        websiteURL: task.websiteURL,
        websiteKey: task.websiteKey,
        pageAction: "soiduk_otsing",
        minScore: 0.9,
      },
    });
    expect(captchaCreateTaskBody("k", { ...task, minScore: 0.7 }, "2captcha").task).toMatchObject({ minScore: 0.7 });
    expect(captchaTaskTypeName(task, "2captcha")).toBe("RecaptchaV3TaskProxyless");
    expect(captchaTaskDisplayName(task, captchaProvider("anticaptcha", "anti-key"))).toBe(
      "Anti-Captcha RecaptchaV3TaskProxyless 0.9",
    );
    expect(captchaTaskDisplayName({ ...task, proxy: undefined, variant: "standard" })).toBe("ReCaptchaV3TaskProxyLess");
    expect(captchaTaskDisplayName(task, captchaProvider("capsolver", "cap-key"))).toBe("ReCaptchaV3M1Task");
  });

  it("M1 rezerve pēc noklusējuma ieslēgta, CAPSOLVER_MNT_V3_M1=0 izslēdz", () => {
    expect(isMntRecaptchaM1FallbackEnabled(undefined)).toBe(true);
    expect(isMntRecaptchaM1FallbackEnabled("")).toBe(true);
    expect(isMntRecaptchaM1FallbackEnabled("1")).toBe(true);
    expect(isMntRecaptchaM1FallbackEnabled("0")).toBe(false);
    expect(isMntRecaptchaM1FallbackEnabled("false")).toBe(false);
    expect(isMntRecaptchaM1FallbackEnabled(" off ")).toBe(false);
  });
});
