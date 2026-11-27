import { describe, expect, it } from "vitest";

import { createBrowserCodeBroker } from "@/relay/provin-traficom/lib/browser-code.mjs";
import { createTraficomSessionState } from "@/relay/provin-traficom/lib/session-state.mjs";
import { awaitBrowserCode, BROWSER_CODE_GRACE_MS } from "@/relay/provin-traficom/lib/traficom-flow.mjs";
import {
  classifySnapshot,
  extractCodeValidSeconds,
  isBrowserCodeSnapshot,
  isValidBrowserCode,
  normalizeBrowserCode,
  redact,
} from "@/relay/provin-traficom/lib/traficom-page.mjs";
import {
  normalizeTraficomBrowserCode,
  reduceTraficomFiProgress,
  reduceTraficomFiResult,
  traficomBrowserCodeSecondsLeft,
  traficomFiScanRowView,
} from "@/lib/traficom-fi-auto-logic";
import { parseTraficomFiAutoStatus } from "@/lib/traficom-fi-auto-store";
import { isTraficomFiAutoActive } from "@/lib/traficom-fi-auto-types";

/** Nils 27.11 ekrānuzņēmums (teksts no eParaksts lapas). */
const EN_TEXT =
  "Enter the code you see in the eParaksts mobile app. To keep your e-Identity safe, confirm this browser with the code from the app. CODE: Code valid for: 00:43 Send code via SMS Cancel Confirm";
const LV_TEXT = "Ievadiet kodu, ko redzat eParaksts mobile lietotnē. Lai aizsargātu jūsu e-identitāti, apstipriniet šo pārlūku. KODS: Kods derīgs: 01:05 Sūtīt kodu ar SMS Atcelt Apstiprināt";

const btn = (text: string, id = "") => ({ id, text, visible: true });
const codePage = (text = EN_TEXT, inputs = [{ id: "codeForm-code", name: "code", type: "text", label: "CODE", visible: true }]) => ({
  host: "eidas.eparaksts.lv",
  path: "/trustedx-authserver/lvrtc-eipsign-idp/browserConfirmation.xhtml",
  text,
  inputs,
  buttons: [btn("Send code via SMS"), btn("Cancel"), btn("Confirm")],
});

describe("Traficom relejs: eParaksts pārlūka kods - lapas atpazīšana", () => {
  it("EN un LV lapa -> ep_browser_code", () => {
    expect(classifySnapshot(codePage())).toBe("ep_browser_code");
    expect(classifySnapshot(codePage(LV_TEXT))).toBe("ep_browser_code");
    expect(isBrowserCodeSnapshot(codePage())).toBe(true);
  });

  it("bez koda lauka vai citā hostā - nav pārlūka koda lapa", () => {
    expect(classifySnapshot(codePage(EN_TEXT, []))).not.toBe("ep_browser_code");
    expect(classifySnapshot({ ...codePage(), host: "vpm.viss.gov.lv" })).not.toBe("ep_browser_code");
    // Lietotāja numura forma paliek ep_user_number.
    expect(
      classifySnapshot({
        host: "eidas.eparaksts.lv",
        path: "/trustedx-authserver/lvrtc-eipsign-idp/mobileIdIdentification.xhtml",
        text: "eParaksts mobile USER NUMBER Cancel Confirm",
        inputs: [{ id: "identifierForm-identifier", name: "x", type: "text", label: "USER NUMBER", visible: true }],
        buttons: [btn("Cancel"), btn("Confirm", "identifierForm-submitButton")],
      }),
    ).toBe("ep_user_number");
  });

  it("termiņš beidzies (lapā 'expired') - joprojām pārlūka koda lapa, nevis ep_failed", () => {
    expect(classifySnapshot(codePage(`${EN_TEXT} The code has expired`))).toBe("ep_browser_code");
  });

  it("taimeris 'Code valid for' -> sekundes", () => {
    expect(extractCodeValidSeconds(EN_TEXT)).toBe(43);
    expect(extractCodeValidSeconds(LV_TEXT)).toBe(65);
    expect(extractCodeValidSeconds("Code valid for 30 seconds")).toBe(30);
    expect(extractCodeValidSeconds("Code valid for: 00:00")).toBe(0);
    expect(extractCodeValidSeconds("bez taimera")).toBeNull();
  });
});

describe("Traficom: pārlūka koda validācija", () => {
  it("tikai burti/cipari, 4-8 zīmes; atstarpes un defises noņem", () => {
    for (const fn of [normalizeBrowserCode, normalizeTraficomBrowserCode]) {
      expect(fn("1234")).toBe("1234");
      expect(fn(" 12 34 ")).toBe("1234");
      expect(fn("ab-12")).toBe("AB12");
      expect(fn("12345678")).toBe("12345678");
      expect(fn("123")).toBe("");
      expect(fn("123456789")).toBe("");
      expect(fn("12;4")).toBe("");
      expect(fn("<b>12</b>")).toBe("");
      expect(fn(undefined)).toBe("");
    }
    expect(isValidBrowserCode("4821")).toBe(true);
    expect(isValidBrowserCode("48")).toBe(false);
  });

  it("redact: ievadītais kods žurnālā kļūst par ***", () => {
    expect(redact("ievadīts 4821 laukā", ["4821"])).toBe("ievadīts *** laukā");
    expect(redact("kods AB12CD", ["AB12CD"])).toBe("kods ***");
  });
});

describe("Traficom relejs: koda pastkastīte un sesija", () => {
  it("kods tiek pieņemts tikai, kamēr plūsma gaida; paņem vienreiz", () => {
    const b = createBrowserCodeBroker();
    expect(b.submit("4821")).toEqual({ ok: false, error: "not_waiting" });
    b.open();
    expect(b.submit("12")).toEqual({ ok: false, error: "invalid_code" });
    expect(b.submit("48 21")).toEqual({ ok: true });
    expect(b.take()).toEqual({ type: "code", code: "4821" });
    expect(b.take()).toBeNull();
    expect(b.renew()).toEqual({ ok: true });
    expect(b.take()).toEqual({ type: "renew" });
    b.close();
    expect(b.isWaiting()).toBe(false);
    expect(b.renew()).toEqual({ ok: false, error: "not_waiting" });
  });

  it("sesija: awaiting_browser_code ar termiņu (bez koda) -> aktīva / kļūda", () => {
    const t = Date.parse("2026-11-27T18:00:00Z");
    const s = createTraficomSessionState({ now: () => t });
    s.onProgress("awaiting_browser_code", { codeExpiresAt: "2026-11-27T18:00:43.000Z", browserCodeAttempt: 1, code: "4821" });
    const v = s.view();
    expect(v).toMatchObject({ state: "awaiting_browser_code", codeExpiresAt: "2026-11-27T18:00:43.000Z", browserCodeAttempt: 1 });
    expect(JSON.stringify(v)).not.toContain("4821");
    expect(s.awaitingBrowserCode()).toBe(true);
    s.onProgress("awaiting_browser_code", { codeExpired: true, browserCodeAttempt: 1 });
    expect(s.view()).toMatchObject({ codeExpired: true, codeExpiresAt: "2026-11-27T18:00:43.000Z" });
    s.onProgress("searching");
    expect(s.view().state).toBe("active");
    expect(s.view().codeExpiresAt).toBeUndefined();
    s.onProgress("awaiting_browser_code", { codeExpiresAt: "nav-datums" });
    expect(s.view().codeExpiresAt).toBeUndefined();
    s.onError("browser_code_timeout");
    expect(s.view().state).toBe("logged_out");
  });
});

/** Viltota Playwright lapa: `snapshot()` lasa page.url() un page.evaluate(). */
function fakePage(getText: () => string, host = "eidas.eparaksts.lv") {
  return {
    url: () => `https://${host}/trustedx-authserver/lvrtc-eipsign-idp/browserConfirmation.xhtml`,
    evaluate: async () => ({
      text: getText(),
      inputs: [{ id: "codeForm-code", name: "code", type: "text", label: "CODE", visible: true }],
      buttons: [btn("Send code via SMS"), btn("Cancel"), btn("Confirm")],
      stepText: "",
      headings: "",
      hasAgree: false,
      mobileChoice: false,
      hasCaptchaFrame: false,
      codeCandidates: [],
    }),
  };
}

describe("Traficom relejs: koda gaidīšana plūsmā", () => {
  it("paziņo termiņu, saņem kodu no admina", async () => {
    const broker = createBrowserCodeBroker();
    const events: Array<[string, Record<string, unknown>]> = [];
    const page = fakePage(() => EN_TEXT);
    const t = Date.parse("2026-11-27T18:00:00Z");
    const p = awaitBrowserCode(page, {
      broker,
      attempt: 1,
      rejected: false,
      now: () => t,
      pollMs: 5,
      onProgress: async (state: string, extra: Record<string, unknown>) => {
        events.push([state, extra]);
        broker.submit("4821");
      },
    });
    await expect(p).resolves.toEqual({ status: "code", code: "4821" });
    expect(events[0]).toEqual(["awaiting_browser_code", { codeExpiresAt: "2026-11-27T18:00:43.000Z", browserCodeAttempt: 1 }]);
    expect(JSON.stringify(events)).not.toContain("4821");
    expect(broker.isWaiting()).toBe(false);
  });

  it("termiņš beidzas -> codeExpired; bez darbības pēc 3 min -> timeout", async () => {
    const broker = createBrowserCodeBroker();
    const events: Array<Record<string, unknown>> = [];
    let t = Date.parse("2026-11-27T18:00:00Z");
    let text = EN_TEXT;
    const page = fakePage(() => text);
    const res = await awaitBrowserCode(page, {
      broker,
      attempt: 2,
      rejected: true,
      now: () => t,
      pollMs: 1,
      onProgress: async (_s: string, extra: Record<string, unknown>) => {
        events.push(extra);
        text = EN_TEXT.replace("00:43", "00:00");
        t += 60_000;
        if (extra.codeExpired) t += BROWSER_CODE_GRACE_MS + 1000;
      },
    });
    expect(res).toEqual({ status: "timeout" });
    expect(events[0]).toMatchObject({ browserCodeAttempt: 2, browserCodeRejected: true });
    expect(events.some((e) => e.codeExpired === true)).toBe(true);
  });

  it("lapa pazūd (eParaksts pieņēma) -> left; admins lūdz jaunu -> renew", async () => {
    const broker = createBrowserCodeBroker();
    let host = "eidas.eparaksts.lv";
    const page = { ...fakePage(() => EN_TEXT), url: () => `https://${host}/x` };
    const left = await awaitBrowserCode(page, {
      broker,
      attempt: 1,
      rejected: false,
      pollMs: 1,
      onProgress: async () => {
        host = "tunnistautuminen.suomi.fi";
      },
    });
    expect(left).toEqual({ status: "left" });
    const renew = await awaitBrowserCode(fakePage(() => EN_TEXT), {
      broker,
      attempt: 1,
      rejected: false,
      pollMs: 1,
      onProgress: async () => {
        broker.renew();
      },
    });
    expect(renew).toEqual({ status: "renew" });
  });
});

describe("PROVIN: awaiting_browser_code stāvoklis", () => {
  const NOW = "2026-11-27T18:00:00.000Z";
  const ev = { jobId: "j1", ref: "order_abc123", vin: "WVGZZZE2ZXX000001" };

  it("progress -> awaiting_browser_code ar termiņu; termiņš beidzas -> karogs, termiņš paliek", () => {
    const a = reduceTraficomFiProgress(null, { ...ev, state: "awaiting_browser_code", codeExpiresAt: "2026-11-27T18:00:43.000Z", browserCodeAttempt: 1 }, NOW);
    expect(a).toMatchObject({ state: "awaiting_browser_code", codeExpiresAt: "2026-11-27T18:00:43.000Z", browserCodeAttempt: 1 });
    expect(a.message).toContain("eParaksts lietotnes");
    expect(isTraficomFiAutoActive(a)).toBe(true);
    const b = reduceTraficomFiProgress(a, { ...ev, state: "awaiting_browser_code", codeExpired: true }, NOW);
    expect(b).toMatchObject({ codeExpired: true, codeExpiresAt: "2026-11-27T18:00:43.000Z", browserCodeAttempt: 1 });
    expect(b.message).toContain("Pieprasīt jaunu kodu");
    const c = reduceTraficomFiProgress(b, { ...ev, state: "awaiting_browser_code", codeExpiresAt: "2026-11-27T18:02:00.000Z", browserCodeAttempt: 2, browserCodeRejected: true }, NOW);
    expect(c.codeExpired).toBeUndefined();
    expect(c.message).toContain("nepieņēma");
    const d = reduceTraficomFiProgress(c, { ...ev, state: "searching" }, NOW);
    expect(d.codeExpiresAt).toBeUndefined();
    expect(d.browserCodeAttempt).toBeUndefined();
    const e = reduceTraficomFiProgress(d, { ...ev, state: "error", code: "browser_code_timeout" }, NOW);
    expect(e.message).toContain("pārlūka kods");
    const r = reduceTraficomFiResult(a, { ...ev, state: "result", found: false }, NOW);
    expect(r.codeExpiresAt).toBeUndefined();
  });

  it("atlikušās sekundes", () => {
    const now = Date.parse(NOW);
    expect(traficomBrowserCodeSecondsLeft({ codeExpiresAt: "2026-11-27T18:00:43.000Z" }, now)).toBe(43);
    expect(traficomBrowserCodeSecondsLeft({ codeExpiresAt: "2026-11-27T17:59:00.000Z" }, now)).toBe(0);
    expect(traficomBrowserCodeSecondsLeft({ codeExpired: true, codeExpiresAt: "2026-11-27T18:00:43.000Z" }, now)).toBe(0);
    expect(traficomBrowserCodeSecondsLeft({}, now)).toBeNull();
  });

  it("krātuve un VIN SCAN rinda", () => {
    const parsed = parseTraficomFiAutoStatus({ state: "awaiting_browser_code", updatedAt: NOW, codeExpiresAt: "2026-11-27T18:00:43.000Z", browserCodeAttempt: 2, codeExpired: true });
    expect(parsed).toMatchObject({ state: "awaiting_browser_code", codeExpiresAt: "2026-11-27T18:00:43.000Z", browserCodeAttempt: 2, codeExpired: true });
    expect(parseTraficomFiAutoStatus({ state: "awaiting_browser_code", updatedAt: NOW, codeExpiresAt: "xx", browserCodeAttempt: 99 })?.codeExpiresAt).toBeUndefined();
    expect(traficomFiScanRowView({ state: "awaiting_browser_code", updatedAt: NOW })).toMatchObject({ status: "checking", summary: "Traficom (FI): gaida kodu no eParaksts lietotnes" });
  });
});
