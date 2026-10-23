import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  classifySnapshot,
  extractTadatiText,
  extractVerificationCode,
  isAllowedHost,
  isWorkHoursRiga,
  queryKind,
  redact,
} from "@/relay/provin-ecsdd/lib/ecsdd-page.mjs";
import { createJobQueue } from "@/relay/provin-ecsdd/lib/jobs.mjs";
import { createRelayCore } from "@/relay/provin-ecsdd/lib/relay-core.mjs";
import { defaultSessionConfig, keepAliveDue, onLoggedOutDetected, onLoginOk, parseSession } from "@/relay/provin-ecsdd/lib/session.mjs";

const FAKE_CODE = "010101-12345";

describe("e.csdd relejs: lapu atpazīšana", () => {
  it("allows navigation only to e.csdd and the national login (vpm.viss.gov.lv, latvija.lv)", () => {
    expect(isAllowedHost("e.csdd.lv")).toBe(true);
    expect(isAllowedHost("vpm.viss.gov.lv")).toBe(true);
    expect(isAllowedHost("www.latvija.lv")).toBe(true);
    expect(isAllowedHost("csdd.lv")).toBe(false);
    expect(isAllowedHost("evil-e.csdd.lv.example.com")).toBe(false);
    expect(isAllowedHost("google.com")).toBe(false);
  });

  it("e.csdd home without a logout control is logged out, with one it is logged in", () => {
    const out = { host: "e.csdd.lv", text: "Lieto CSDD pakalpojumus tiešsaistē Autorizēties visām darbībām Autorizēties uzziņai", buttons: [], links: [] };
    expect(classifySnapshot(out)).toBe("ecsdd_logged_out");
    const inn = { host: "e.csdd.lv", text: "Labdien! Mani transportlīdzekļi", buttons: [{ text: "Iziet", visible: true }], links: [] };
    expect(classifySnapshot(inn)).toBe("ecsdd_logged_in");
    expect(classifySnapshot({ host: "e.csdd.lv", text: "Sākums", links: [{ text: "", href: "/?action=logout" }] })).toBe("ecsdd_logged_in");
  });

  it("national login: consent + method choice, personal code form, waiting with a control code, refusal", () => {
    expect(classifySnapshot({ host: "vpm.viss.gov.lv", text: "Piekrītu identifikācijas veikšanas noteikumiem Smart-ID Swedbank", hasAgree: true })).toBe("sso_choose");
    expect(
      classifySnapshot({
        host: "vpm.viss.gov.lv",
        text: "Smart-ID autentifikācijas adapteris Saņemt paziņojumu Smart-ID lietotnē Personas kods",
        inputs: [{ id: "identity-number", label: "Personas kods xxxxxx-xxxxx", type: "text", visible: true }],
      }),
    ).toBe("sso_code_input");
    expect(classifySnapshot({ host: "vpm.viss.gov.lv", text: "Smart-ID. Kontrolkods: 4821. Pārbaudiet telefonā" })).toBe("sso_wait");
    expect(classifySnapshot({ host: "vpm.viss.gov.lv", text: "Pārbaudiet kodu telefonā", codeCandidates: ["4821"] })).toBe("sso_wait");
    expect(classifySnapshot({ host: "vpm.viss.gov.lv", text: "Autentifikācija atcelta lietotājs atteica" })).toBe("sso_failed");
  });

  it("reads the 4 digit control code, not the personal code or a year", () => {
    expect(extractVerificationCode("Kontroles kods: 4821")).toBe("4821");
    expect(extractVerificationCode("Verification code 0912 shown")).toBe("0912");
    expect(extractVerificationCode("Personas kods 010101-12345, 2026. gads")).toBeNull();
  });

  it("tadati: result vs not found only after the search was submitted", () => {
    const result = { host: "e.csdd.lv", text: "Reģistrācijas numurs AB1234 Marka BMW VIN WBALW3C59CC891863 Pēdējā tehniskā apskate 02.10.2026", buttons: [{ text: "Iziet" }] };
    expect(classifySnapshot(result, { submitted: true })).toBe("tadati_result");
    expect(classifySnapshot(result)).toBe("ecsdd_logged_in");
    expect(classifySnapshot({ host: "e.csdd.lv", text: "Transportlīdzeklis nav atrasts", buttons: [{ text: "Iziet" }] }, { submitted: true })).toBe(
      "tadati_not_found",
    );
    expect(classifySnapshot({ host: "e.csdd.lv", text: "Autorizēties visām darbībām" }, { submitted: true })).toBe("ecsdd_logged_out");
  });

  it("stops on captcha on any host", () => {
    expect(classifySnapshot({ host: "e.csdd.lv", text: "Lūdzu apstipriniet, ka neesmu robots" })).toBe("captcha");
    expect(classifySnapshot({ host: "vpm.viss.gov.lv", text: "ok", hasCaptchaFrame: true })).toBe("captcha");
  });

  it("query kind: VIN (17, no I/O/Q) or LV plate", () => {
    expect(queryKind("wbalw3c59cc891863")).toBe("vin");
    expect(queryKind("AB-1234")).toBe("plate");
    expect(queryKind("WBALW3C59CC89186I")).toBeNull();
    expect(queryKind("1234")).toBeNull();
    expect(queryKind("")).toBeNull();
  });

  it("work hours in Riga (08-20 by default)", () => {
    expect(isWorkHoursRiga(new Date("2026-10-23T07:30:00Z"))).toBe(true); // 10:30 Rīgā
    expect(isWorkHoursRiga(new Date("2026-10-23T19:30:00Z"))).toBe(false); // 22:30 Rīgā
  });
});

describe("e.csdd relejs: tadati teksts CSDD blokam", () => {
  const page = [
    "e-CSDD",
    "Reģistrācijas vai VIN numurs:",
    "Sākums",
    "Reģistrācijas numurs AB1234",
    "Statuss Uzskaitē",
    "Marka Modelis BMW 640I",
    "VIN WBALW3C59CC891863",
    "Īpašnieks JĀNIS BĒRZIŅŠ",
    "Personas kods 010101-12345",
    "Adrese Rīga, Brīvības iela 1",
    "Īpašnieku skaits 3",
    "Transportlīdzekļa reģistrācija",
    "02.10.2026 - Pirmā reģistrācija Latvijā",
    "",
    "",
    "Tehniskā apskate",
    "Maksājumi",
    "Tehniskais atbalsts",
    "Darbadienās",
  ].join("\n");

  it("keeps vehicle data, drops header/footer/menu, never returns names, addresses or personal codes", () => {
    const raw = extractTadatiText(page, [FAKE_CODE]);
    expect(raw.startsWith("Reģistrācijas numurs AB1234")).toBe(true);
    expect(raw).toContain("VIN WBALW3C59CC891863");
    expect(raw).toContain("02.10.2026 - Pirmā reģistrācija Latvijā");
    expect(raw).toContain("Īpašnieku skaits 3");
    expect(raw).not.toContain("BĒRZIŅŠ");
    expect(raw).not.toContain("Brīvības");
    expect(raw).not.toContain("12345");
    expect(raw).not.toContain("Tehniskais atbalsts");
    expect(raw).not.toMatch(/Maksājumi\s*$/);
  });

  it("redact hides personal codes with and without dash", () => {
    expect(redact(`kods ${FAKE_CODE} un 01010112345`, [FAKE_CODE])).toBe("kods *** un ***");
  });
});

describe("e.csdd relejs: sesijas politika", () => {
  const cfg = defaultSessionConfig({});
  const day = () => true;

  it("keep-alive every 4 min while recently used, never at night, stops after the idle limit", () => {
    const t0 = new Date("2026-10-23T08:00:00Z");
    const s = onLoginOk({ state: "logged_out", updatedAt: t0.toISOString() }, t0);
    expect(keepAliveDue(s, new Date(t0.getTime() + 3 * 60_000), cfg, day)).toBe(false);
    expect(keepAliveDue(s, new Date(t0.getTime() + 5 * 60_000), cfg, day)).toBe(true);
    expect(keepAliveDue(s, new Date(t0.getTime() + 5 * 60_000), cfg, () => false)).toBe(false);
    expect(keepAliveDue(s, new Date(t0.getTime() + 241 * 60_000), cfg, day)).toBe(false);
  });

  it("losing a session we kept alive means someone else logged in: kicked + yield; an old one just expired", () => {
    const t0 = new Date("2026-10-23T08:00:00Z");
    const s = onLoginOk({ state: "logged_out", updatedAt: t0.toISOString() }, t0);
    const kicked = onLoggedOutDetected(s, new Date(t0.getTime() + 4 * 60_000), cfg);
    expect(kicked.state).toBe("kicked");
    expect(Date.parse(kicked.yieldUntil)).toBe(t0.getTime() + 64 * 60_000);
    expect(onLoggedOutDetected(s, new Date(t0.getTime() + 60 * 60_000), cfg).state).toBe("expired");
  });

  it("after a restart an unfinished login is not resumed", () => {
    expect(parseSession({ state: "awaiting_smartid", verificationCode: "1234", updatedAt: "x" }).state).toBe("logged_out");
    expect(parseSession({ state: "nonsense" }).state).toBe("logged_out");
  });
});

type FakeLookup = { status: "found"; rawText: string } | { status: "not_found" } | { status: "logged_out" };

function fakeRelay(
  opts: { login?: () => Promise<void>; lookups?: FakeLookup[]; work?: boolean; ping?: () => "ok" | "logged_out" } = {},
) {
  const events: Array<Record<string, unknown>> = [];
  const calls = { login: 0, lookup: 0, logout: 0, ping: 0 };
  let t = Date.parse("2026-10-23T08:00:00Z");
  const now = () => new Date(t);
  const lookups = [...(opts.lookups ?? [])];
  const browser = {
    login: async ({ onCode }: { onCode: (c: string) => Promise<void> }) => {
      calls.login++;
      await onCode("4821");
      if (opts.login) await opts.login();
    },
    ping: async () => {
      calls.ping++;
      return opts.ping ? opts.ping() : "ok";
    },
    lookup: async () => {
      calls.lookup++;
      return lookups.shift() ?? { status: "not_found" };
    },
    logout: async () => {
      calls.logout++;
    },
  };
  const core = createRelayCore({
    queue: createJobQueue({ now }),
    browser,
    notify: async (b: Record<string, unknown>) => {
      events.push(b);
    },
    cfg: defaultSessionConfig({}),
    now,
    isWorkHours: () => opts.work ?? true,
  });
  const advance = (min: number) => {
    t += min * 60_000;
  };
  return { core, events, calls, advance };
}

const err = (code: string) => Object.assign(new Error(code), { code });

describe("e.csdd relejs: rinda un sesija (viltots pārlūks)", () => {
  it("one Smart-ID login serves all queued lookups; the code goes to PROVIN; result text is sent back", async () => {
    const { core, events, calls } = fakeRelay({ lookups: [{ status: "found", rawText: "Reģistrācijas numurs AB1234" }, { status: "not_found" }] });
    core.enqueue({ ref: "order_aaaaaa", query: "AB1234", kind: "plate", trigger: "auto" });
    core.enqueue({ ref: "order_bbbbbb", query: "WBALW3C59CC891863", kind: "vin", trigger: "auto" });
    while (await core.tick()) {
      /* līdz rinda tukša */
    }
    expect(calls.login).toBe(1);
    expect(calls.lookup).toBe(2);
    expect(events.some((e) => e.kind === "session" && (e.session as { verificationCode?: string }).verificationCode === "4821")).toBe(true);
    const results = events.filter((e) => e.kind === "job" && e.state === "result");
    expect(results).toEqual([
      expect.objectContaining({ ref: "order_aaaaaa", found: true, rawText: "Reģistrācijas numurs AB1234" }),
      expect.objectContaining({ ref: "order_bbbbbb", found: false }),
    ]);
    expect(core.session().state).toBe("active");
  });

  it("a refused or timed out Smart-ID fails the waiting jobs and is not retried automatically", async () => {
    const { core, events, calls } = fakeRelay({ login: async () => Promise.reject(err("smartid_timeout")) });
    core.enqueue({ ref: "order_aaaaaa", query: "AB1234", kind: "plate", trigger: "auto" });
    await core.tick();
    expect(events.filter((e) => e.state === "error").map((e) => e.code)).toEqual(["smartid_timeout"]);
    core.enqueue({ ref: "order_bbbbbb", query: "AB1235", kind: "plate", trigger: "auto" });
    expect(await core.tick()).toBe(false);
    expect(calls.login).toBe(1);
    expect(events.at(-1)).toEqual(expect.objectContaining({ state: "awaiting_login", reason: "blocked" }));
  });

  it("when Nils logs in himself (server session kicked), automation yields and does not take the session back", async () => {
    const { core, events, calls, advance } = fakeRelay({ lookups: [{ status: "found", rawText: "x 01.01.2020" }, { status: "logged_out" }] });
    core.enqueue({ ref: "order_aaaaaa", query: "AB1234", kind: "plate", trigger: "auto" });
    while (await core.tick()) {
      /* */
    }
    advance(2);
    core.enqueue({ ref: "order_bbbbbb", query: "AB1235", kind: "plate", trigger: "auto" });
    await core.tick(); // lookup -> logged_out
    expect(core.session().state).toBe("kicked");
    expect(await core.tick()).toBe(false);
    expect(calls.login).toBe(1);
    expect(events.at(-1)).toEqual(expect.objectContaining({ ref: "order_bbbbbb", state: "awaiting_login", reason: "yield" }));
    // Pēc yield loga automātika drīkst atkal pieteikties.
    advance(61);
    expect(await core.tick()).toBe(true);
    expect(calls.login).toBe(2);
  });

  it("Nils's own button logs in even during yield or at night", async () => {
    const { core, calls } = fakeRelay({ work: false });
    core.enqueue({ ref: "order_aaaaaa", query: "AB1234", kind: "plate", trigger: "auto" });
    expect(await core.tick()).toBe(false);
    core.enqueue({ ref: "order_aaaaaa", query: "AB1234", kind: "plate", trigger: "manual" });
    expect(await core.tick()).toBe(true);
    expect(calls.login).toBe(1);
  });

  it("night: automatic lookups wait for the morning without Smart-ID", async () => {
    const { core, events, calls } = fakeRelay({ work: false });
    core.enqueue({ ref: "order_aaaaaa", query: "AB1234", kind: "plate", trigger: "auto" });
    expect(await core.tick()).toBe(false);
    expect(calls.login).toBe(0);
    expect(events.at(-1)).toEqual(expect.objectContaining({ state: "awaiting_login", reason: "night" }));
  });

  it("release logs out and keeps automation away for the given minutes", async () => {
    const { core, calls } = fakeRelay({ lookups: [{ status: "found", rawText: "x" }] });
    core.requestLogin();
    await core.tick();
    expect(core.session().state).toBe("active");
    const s = await core.release(90);
    expect(calls.logout).toBe(1);
    expect(s.state).toBe("logged_out");
    expect(s.autoLoginBlockedReason).toBe("yield");
    core.enqueue({ ref: "order_aaaaaa", query: "AB1234", kind: "plate", trigger: "auto" });
    expect(await core.tick()).toBe(false);
    expect(calls.login).toBe(1);
  });

  it("keep-alive ping keeps the session; a ping that finds it logged out marks it kicked", async () => {
    const pings: Array<"ok" | "logged_out"> = ["ok", "logged_out"];
    const { core, calls, advance } = fakeRelay({ ping: () => pings.shift() ?? "ok" });
    core.requestLogin();
    await core.tick();
    advance(5);
    expect(await core.keepAliveTick()).toBe(true);
    expect(core.session().state).toBe("active");
    expect(await core.keepAliveTick()).toBe(false); // vēl nav laiks
    advance(5);
    expect(await core.keepAliveTick()).toBe(true);
    expect(calls.ping).toBe(2);
    expect(core.session().state).toBe("kicked");
  });

  it("job queue survives a restart (state file) without result text", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ecsdd-q-"));
    const stateFile = path.join(dir, "jobs.json");
    const q1 = createJobQueue({ stateFile });
    q1.enqueue({ ref: "order_aaaaaa", query: "AB1234", kind: "plate", trigger: "manual" });
    await new Promise((r) => setTimeout(r, 30));
    const q2 = createJobQueue({ stateFile });
    await q2.load();
    expect(q2.queued().map((j: { query: string; trigger: string }) => [j.query, j.trigger])).toEqual([["AB1234", "manual"]]);
    expect(fs.statSync(stateFile).mode & 0o777).toBe(0o600);
  });
});
