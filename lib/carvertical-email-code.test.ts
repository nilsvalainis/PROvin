import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { carverticalEmailCodeFits, normalizeCarverticalLoginCode } from "@/lib/carvertical-auto-logic";
import { createRelayCore } from "@/relay/provin-carvertical/lib/relay-core.mjs";

vi.mock("@/lib/carvertical-auto-store", () => ({
  readCarverticalAutoStatus: async () => null,
  writeCarverticalAutoStatus: async () => ({ ok: true }),
  writeCarverticalPdf: async () => ({ ok: true }),
  readCarverticalPdf: async () => null,
  carverticalPdfBlobPath: (id: string) => `carvertical_auto/${id}.pdf`,
  readCarverticalBalance: async () => ({ credits: 7, checkedAt: new Date().toISOString() }),
  writeCarverticalBalance: async () => ({ ok: true }),
}));
vi.mock("@/lib/admin-push", () => ({ sendAdminPush: async () => ({ sent: 1, removed: 0 }) }));
vi.mock("@/lib/admin-order-draft-store", () => ({
  readOrderDraft: async () => null,
  isSafeOrderDraftSessionId: (id: string) => /^[a-zA-Z0-9_]+$/.test(id),
}));
vi.mock("@/lib/dropbox-client", () => ({ getDropboxClient: () => null }));

/** Apps Script fails bez Google API: tikai tīrās funkcijas (kods izpildās vm smilškastē). */
function loadAppsScript(): Record<string, (...a: string[]) => unknown> {
  const src = fs.readFileSync(path.join(process.cwd(), "docs/apps-script/csdd-pdf-inbox.gs"), "utf8");
  const ctx: Record<string, unknown> = {};
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx as Record<string, (...a: string[]) => unknown>;
}

describe("Apps Script: CarVertical koda izvilkšana", () => {
  const gs = loadAppsScript();

  it("kods atsevišķā rindā (LV vēstule)", () => {
    const body = "Sveiki!\n\nTavs pierakstīšanās kods ir:\n\nK7M2QP\n\nKods derīgs 15 minūtes.\ncarVertical komanda";
    expect(gs.extractCarverticalCode_("Tavs pierakstīšanās kods", body)).toBe("K7M2QP");
  });

  it("kods tematā / teikumā aiz vārda code", () => {
    expect(gs.extractCarverticalCode_("Your login code: 4B9X2Z", "Use this verification code to sign in.")).toBe("4B9X2Z");
    expect(gs.extractCarverticalCode_("carVertical", "Your verification code is 482913. It expires in 15 minutes.")).toBe("482913");
  });

  it("bez atslēgas vārda vai ar vairākiem kandidātiem - nekas (Nils ievada pats)", () => {
    expect(gs.extractCarverticalCode_("Jaunumi", "Atlaide AB12CD visām atskaitēm")).toBe("");
    expect(gs.extractCarverticalCode_("Kods", "Kods: AB12CD\nvai arī kods: ZX98YU")).toBe("");
    expect(gs.extractCarverticalCode_("Kods", "Kods nav vajadzīgs")).toBe("");
  });

  it("saites un parasti vārdi netiek uzskatīti par kodu", () => {
    const body = "Tavs kods:\nQ1W2E3\nAtver https://www.carvertical.com/lv/auth/code?t=ZZ99YY11 vai PROVIN";
    expect(gs.extractCarverticalCode_("Kods", body)).toBe("Q1W2E3");
  });

  it("sūtītājs tikai carvertical.com (arī apakšdomēns), ne līdzīgi domēni", () => {
    expect(gs.isCarverticalSender_('"carVertical" <no-reply@carvertical.com>')).toBe(true);
    expect(gs.isCarverticalSender_("info@mail.carvertical.com")).toBe(true);
    expect(gs.isCarverticalSender_("x@carvertical.com.evil.example")).toBe(false);
    expect(gs.isCarverticalSender_("x@notcarvertical.com")).toBe(false);
  });

  it("kods netiek logots", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "docs/apps-script/csdd-pdf-inbox.gs"), "utf8");
    const fn = src.slice(src.indexOf("function processCarverticalCodes"), src.indexOf("function isCarverticalSender_"));
    expect(fn.length).toBeGreaterThan(200);
    expect(fn).not.toMatch(/console\.\w+\([^)]*\bcode\b\s*[+,)]/);
  });
});

describe("PROVIN: e-pasta kods derīgs tikai gaidošai pieteikšanās", () => {
  it("normalizācija", () => {
    expect(normalizeCarverticalLoginCode(" k7m 2qp ")).toBe("K7M2QP");
    expect(normalizeCarverticalLoginCode("12345")).toBe("");
  });

  it("tikai awaiting_code un vēstule pēc pieteikšanās sākuma (1 min nobīde)", () => {
    const sess = { state: "awaiting_code", loginStartedAt: "2026-11-23T12:00:00Z", codeRequestedAt: "2026-11-23T12:00:20Z" };
    expect(carverticalEmailCodeFits(sess, Date.parse("2026-11-23T12:00:05Z"))).toBe(true);
    expect(carverticalEmailCodeFits(sess, Date.parse("2026-11-23T11:59:30Z"))).toBe(true);
    expect(carverticalEmailCodeFits(sess, Date.parse("2026-11-23T11:50:00Z"))).toBe(false);
    expect(carverticalEmailCodeFits({ ...sess, state: "active" }, Date.parse("2026-11-23T12:00:05Z"))).toBe(false);
    expect(carverticalEmailCodeFits(null, Date.now())).toBe(false);
  });
});

describe("PROVIN: /api/carvertical/login-code", () => {
  const TOKEN = "t".repeat(32);
  let calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  let relaySession: Record<string, unknown> = {};
  let codeReply: { status: number; body: Record<string, unknown> } = { status: 200, body: { ok: true } };

  beforeEach(() => {
    process.env.CSDD_PDF_INBOX_TOKEN = TOKEN;
    process.env.CARVERTICAL_RELAY_URL = "https://relay.example/carvertical";
    process.env.CARVERTICAL_RELAY_TOKEN = "x".repeat(32);
    calls = [];
    relaySession = { state: "awaiting_code", loginStartedAt: new Date(Date.now() - 60_000).toISOString() };
    codeReply = { status: 200, body: { ok: true, session: { state: "active" } } };
    vi.stubGlobal("fetch", async (url: string, init?: { body?: string }) => {
      calls.push({ url: String(url), body: init?.body ? (JSON.parse(init.body) as Record<string, unknown>) : {} });
      if (String(url).endsWith("/session")) return new Response(JSON.stringify({ session: relaySession }), { status: 200 });
      return new Response(JSON.stringify(codeReply.body), { status: codeReply.status });
    });
  });

  async function post(body: Record<string, unknown>, auth = `Bearer ${TOKEN}`) {
    const { POST } = await import("@/app/api/carvertical/login-code/route");
    return POST(new Request("https://www.provin.lv/api/carvertical/login-code", { method: "POST", headers: { authorization: auth }, body: JSON.stringify(body) }));
  }

  it("bez tokena -> 401, relejs netiek saukts", async () => {
    const res = await post({ code: "K7M2QP", receivedAt: new Date().toISOString() }, "Bearer nepareizs");
    expect(res.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it("relejs gaida kodu -> kods relejam ar source email -> accepted", async () => {
    const receivedAt = new Date().toISOString();
    const res = await post({ code: "k7m2qp", receivedAt });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "accepted" });
    const codeCall = calls.find((c) => c.url.endsWith("/login/code"));
    expect(codeCall?.body).toMatchObject({ code: "K7M2QP", source: "email" });
  });

  it("relejs negaida kodu -> 204, kods relejam netiek sūtīts", async () => {
    relaySession = { state: "active" };
    const res = await post({ code: "K7M2QP", receivedAt: new Date().toISOString() });
    expect(res.status).toBe(204);
    expect(calls.some((c) => c.url.endsWith("/login/code"))).toBe(false);
  });

  it("vēstule vecāka par pieteikšanās sākumu vai 15 min -> 204", async () => {
    let res = await post({ code: "K7M2QP", receivedAt: new Date(Date.now() - 5 * 60_000).toISOString() });
    expect(res.status).toBe(204);
    res = await post({ code: "K7M2QP", receivedAt: new Date(Date.now() - 20 * 60_000).toISOString() });
    expect(res.status).toBe(204);
    expect(calls.some((c) => c.url.endsWith("/login/code"))).toBe(false);
  });

  it("nederīgs kods -> 400; relejs aizņemts -> 503 (skripts mēģina vēlreiz)", async () => {
    expect((await post({ code: "12345", receivedAt: new Date().toISOString() })).status).toBe(400);
    codeReply = { status: 200, body: { ok: false, error: "busy" } };
    expect((await post({ code: "K7M2QP", receivedAt: new Date().toISOString() })).status).toBe(503);
  });

  it("CarVertical kodu neatzina -> rejected", async () => {
    codeReply = { status: 200, body: { ok: false, session: { state: "awaiting_code", code: "wrong_code" } } };
    const res = await post({ code: "K7M2QP", receivedAt: new Date().toISOString() });
    expect(await res.json()).toEqual({ status: "rejected" });
  });
});

describe("Relejs: automātiskais kods un push tikai pēc 10 min", () => {
  function setup() {
    let t = Date.parse("2026-11-23T12:00:00Z");
    const events: Record<string, unknown>[] = [];
    const submitted: string[] = [];
    const browser = {
      async peekSession() {
        return { state: "awaiting_code", codeRequestedAt: "2026-11-23T12:00:20.000Z", loginStartedAt: "2026-11-23T12:00:00.000Z" };
      },
      async ensureSession() {
        return { state: "awaiting_code", codeRequestedAt: "2026-11-23T12:00:20.000Z", loginStartedAt: "2026-11-23T12:00:00.000Z" };
      },
      async submitCode(code: string) {
        submitted.push(code);
        return { state: "active" };
      },
      async account() {
        return { credits: 5, reports: [], listRead: true };
      },
      async purchase() {
        return { ok: false, clicked: false };
      },
      async downloadPdf() {
        return { ok: false };
      },
    };
    const core = createRelayCore({
      browser,
      notify: async (b: Record<string, unknown>) => {
        events.push(b);
      },
      now: () => new Date(t),
      sleep: async () => undefined,
    });
    return { core, events, submitted, advance: (ms: number) => (t += ms) };
  }

  it("kods pieprasīts: push nav uzreiz; pēc 10 min viens push", async () => {
    const { core, events, advance } = setup();
    await core.login();
    expect(core.session()).toMatchObject({ state: "awaiting_code", autoCodeUntil: "2026-11-23T12:10:20.000Z" });
    expect(events.filter((e) => e.kind === "session")).toHaveLength(0);
    advance(9 * 60_000);
    expect(await core.checkCodeReminder()).toBe(false);
    advance(2 * 60_000);
    expect(await core.checkCodeReminder()).toBe(true);
    expect(await core.checkCodeReminder()).toBe(false);
    expect(events.filter((e) => e.kind === "session" && e.state === "awaiting_code")).toHaveLength(1);
  });

  it("e-pasta kods pēc pieteikšanās sākuma tiek ievadīts; push vairs nenāk", async () => {
    const { core, events, submitted, advance } = setup();
    await core.login();
    const out = await core.submitCode("k7m2qp", { source: "email", receivedAt: "2026-11-23T12:00:10Z" });
    expect(out.ok).toBe(true);
    expect(submitted).toEqual(["K7M2QP"]);
    advance(15 * 60_000);
    expect(await core.checkCodeReminder()).toBe(false);
    expect(events.filter((e) => e.kind === "session")).toHaveLength(0);
  });

  it("vecs e-pasta kods (pirms pieteikšanās) vai negaidīts kods netiek ievadīts", async () => {
    const { core, submitted } = setup();
    expect(await core.submitCode("K7M2QP", { source: "email", receivedAt: "2026-11-23T12:00:10Z" })).toMatchObject({ ok: false, error: "not_waiting" });
    await core.login();
    expect(await core.submitCode("K7M2QP", { source: "email", receivedAt: "2026-11-23T11:45:00Z" })).toMatchObject({ ok: false, error: "stale_code" });
    expect(submitted).toEqual([]);
  });
});
