import { describe, expect, it } from "vitest";

import {
  captchaCreateTaskBody,
  capsolverProxyFromUrl,
  httpProxyUrlFromCapsolver,
  parseCaptchaCreateTask,
  parseCaptchaTaskResult,
  vinStickyHttpProxyUrl,
} from "@/lib/captcha-solver";

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

  it("reCAPTCHA v3 ar Fixie proxy lieto ReCaptchaV3Task", () => {
    const body = captchaCreateTaskBody("key-1", {
      kind: "recaptcha_v3",
      websiteURL: "https://eteenindus.mnt.ee/public/soidukTaustakontroll.jsf",
      websiteKey: "6LfM2VUpAAAAAIxz2LW7-pZy2tcQpV1lA-B1kHCa",
      pageAction: "soiduk_otsing",
      proxy: "group.usefixie.com:80:fixie:secret",
    });
    expect(body.task).toMatchObject({
      type: "ReCaptchaV3Task",
      proxy: "group.usefixie.com:80:fixie:secret",
      pageAction: "soiduk_otsing",
    });
  });

  it("reCAPTCHA v2 ar proxy lieto ReCaptchaV2Task", () => {
    const body = captchaCreateTaskBody("key-1", {
      kind: "recaptcha_v2",
      websiteURL: "https://lkf.ee/et/kahjukontroll",
      websiteKey: "6LdtedISAAAAABWNkw4vodbhMcB1SZ-ykU6A04fL",
      proxy: "group.usefixie.com:80:fixie:secret",
    });
    expect(body.task).toMatchObject({
      type: "ReCaptchaV2Task",
      proxy: "group.usefixie.com:80:fixie:secret",
    });
  });

  it("veido Cloudflare Challenge uzdevumu ar proxy", () => {
    const body = captchaCreateTaskBody("key-1", {
      kind: "cloudflare_challenge",
      websiteURL: "https://www.car.info/en-se/",
      proxy: "host.example:80:user:pass",
    });
    expect(body.task).toMatchObject({
      type: "AntiCloudflareTask",
      proxy: "host.example:80:user:pass",
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
  it("pārveido Fixie HTTP URL CapSolver formātā", () => {
    expect(capsolverProxyFromUrl("http://fixie:secret@group.usefixie.com:80")).toBe(
      "group.usefixie.com:80:fixie:secret",
    );
    expect(capsolverProxyFromUrl("http://fixie:secret@group.usefixie.com")).toBe(
      "group.usefixie.com:80:fixie:secret",
    );
  });

  it("atgriež HTTP URL undici ProxyAgent", () => {
    expect(httpProxyUrlFromCapsolver("group.usefixie.com:80:fixie:secret")).toBe(
      "http://fixie:secret@group.usefixie.com:80",
    );
  });

  it("FIXIE_URL bez CAPSOLVER_PROXY dod sticky HTTP proxy", () => {
    const prevFixie = process.env.FIXIE_URL;
    const prevCap = process.env.CAPSOLVER_PROXY;
    process.env.FIXIE_URL = "http://fixie:secret@group.usefixie.com:80";
    delete process.env.CAPSOLVER_PROXY;
    try {
      expect(vinStickyHttpProxyUrl()).toBe("http://fixie:secret@group.usefixie.com:80");
    } finally {
      if (prevFixie === undefined) delete process.env.FIXIE_URL;
      else process.env.FIXIE_URL = prevFixie;
      if (prevCap === undefined) delete process.env.CAPSOLVER_PROXY;
      else process.env.CAPSOLVER_PROXY = prevCap;
    }
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
