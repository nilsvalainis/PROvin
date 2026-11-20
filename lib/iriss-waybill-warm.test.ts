import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWarmBrowserPool } from "@/scripts/iriss-ttr/waybill-driver.mjs";
import { formatTimings, scriptInput } from "@/scripts/iriss-ttr/waybill-worker-core.mjs";
import { runCli } from "@/scripts/iriss-ttr/waybill-scripts-core.mjs";
import { platesForCtx } from "@/scripts/iriss-ttr/csdd-waybills-core.mjs";
import {
  ctxNumber,
  nextPollMs,
  POLL_FAST_MS,
  POLL_SLOW_MS,
  runStepInProcess,
  warmBrowserEnabled,
  warmIdleMs,
} from "@/scripts/iriss-ttr/waybill-warm-core.mjs";
import {
  WAYBILL_WORKER_POLL_FAST_MS,
  WAYBILL_WORKER_POLL_SLOW_MS,
  waybillWorkerPollMs,
} from "@/lib/iriss-waybill-worker-poll";
import { applyWaybillPageSeen, emptyTtrControlDoc, parseTtrControlDoc, waybillPageSeenNeedsWrite } from "@/lib/iriss-ttr-control";

/* eslint-disable @typescript-eslint/no-explicit-any -- Playwright imitācija testos */

type Rec = { calls: string[]; form: Record<string, string> | null; helpers: any; onSave?: () => void; onStop?: () => void; adapters: number };
declare global {
  var __wt: Rec;
}

/** Adaptera imitācija (tas pats līgums, ko waybill-adapter.cjs): katram solim createAdapter() ar savu stāvokli. */
const STUB_ADAPTER = `
function createAdapter() {
  globalThis.__wt.adapters += 1;
  const w = () => globalThis.__wt;
  return {
    async open(page, input, h) { w().helpers = h; w().calls.push("open:" + input.jobId); },
    async findActiveWaybill() { return null; },
    async openFromTradeAct() { return false; },
    async openNewWaybill() { w().calls.push("new"); },
    async fillForm(page, values) { w().form = { ...values }; },
    async readForm() { return { ...(w().form || {}) }; },
    async formMode() { return w().form ? "open" : ""; },
    async clickSave() { w().calls.push("save"); if (w().onSave) w().onSave(); },
    async readWaybillNo() { return "P01234"; },
    async downloadPdf() { return ""; },
    async readActiveWaybills(page, q) { w().calls.push("sync"); return { ok: true, plates: {}, checked: 0, maxNumber: "" }; },
    async stopWaybill(page, q, h) {
      await h.setPhase("annul");
      w().calls.push("stop:" + q.waybillNo);
      if (w().onStop) w().onStop();
      await h.setPhase("fill");
      return { ok: true, statusAfter: "Pārtraukta" };
    },
    async annulWaybill() { throw new Error("annul nekad"); },
  };
}
module.exports = createAdapter;
module.exports.createAdapter = createAdapter;
`;

function fakePlaywright() {
  const rec = { launches: 0, contexts: [] as any[], browserClosed: 0 };
  const mkPage = () => {
    const p: any = {
      dialogHandlers: [] as any[],
      closed: false,
      evaluate: vi.fn(async () => ""),
      on(ev: string, h: any) {
        if (ev === "dialog") p.dialogHandlers.push(h);
      },
      setDefaultTimeout() {},
      isClosed: () => p.closed,
      waitForLoadState: async () => {},
      close: async () => {
        p.closed = true;
      },
    };
    return p;
  };
  const mkContext = () => {
    const c: any = {
      routes: [] as any[],
      initScripts: 0,
      pages: [] as any[],
      closed: false,
      route: async (_p: string, h: any) => void c.routes.push(h),
      addInitScript: async () => void (c.initScripts += 1),
      newPage: async () => {
        const p = mkPage();
        c.pages.push(p);
        return p;
      },
      close: async () => {
        c.closed = true;
      },
    };
    rec.contexts.push(c);
    return c;
  };
  const browser: any = {
    closed: false,
    newContext: async () => mkContext(),
    close: async () => {
      browser.closed = true;
      rec.browserClosed += 1;
    },
    isConnected: () => !browser.closed,
    on() {},
  };
  const chromium = {
    launch: vi.fn(async () => {
      rec.launches += 1;
      browser.closed = false;
      return browser;
    }),
  };
  return { rec, load: async () => ({ chromium }) };
}

/** Tīkla sargs: "abort" vai "pass". */
async function probeRoute(ctx: any, url: string, postData = "") {
  let r = "";
  await ctx.routes[0]({
    request: () => ({ url: () => url, postData: () => postData, method: () => "POST" }),
    abort: async () => {
      r = "abort";
    },
    fallback: async () => {
      r = "pass";
    },
  });
  return r;
}

/** Dialogu sargs: "accept" vai "dismiss". */
function probeDialog(page: any, message: string) {
  let r = "";
  page.dialogHandlers[0]({
    message: () => message,
    accept: async () => {
      r = "accept";
    },
    dismiss: async () => {
      r = "dismiss";
    },
  });
  return r;
}

/** Elements klikšķim (safeClick pārbauda nozīmi pirms klikšķa). */
function fakeButton(text: string) {
  return {
    waitFor: async () => {},
    evaluate: async () => ({ text, value: "", id: "", name: "", title: "", ariaLabel: "", onclick: "", href: "" }),
    click: vi.fn(async () => {}),
  };
}

const CSDD = "https://ows.csdd.gov.lv:7775";
let dir: string;
let ttrDir: string;
let pw: ReturnType<typeof fakePlaywright>;
let now = 1_800_000_000_000;

function makePool(idleMs = 10 * 60_000) {
  return createWarmBrowserPool({ ttrDir, env: {}, log: () => {}, idleMs, now: () => now, loadPw: pw.load });
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "wb-warm-"));
  ttrDir = path.join(dir, "ttr");
  fs.mkdirSync(ttrDir);
  fs.writeFileSync(path.join(ttrDir, "waybill-ui.json"), JSON.stringify({ startUrl: `${CSDD}/`, browserUrl: "", ignoreTls: true, timeoutMs: 1000 }));
  fs.writeFileSync(path.join(ttrDir, "waybill-adapter.cjs"), STUB_ADAPTER);
  globalThis.__wt = { calls: [], form: null, helpers: null, adapters: 0 };
  pw = fakePlaywright();
  now = 1_800_000_000_000;
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const job = {
  id: "wbr_warm01",
  vehicle: { plate: "B193-7", brandModel: "BMW 330", vin: "" },
  auto: { company: "iriss", ctx: "ctx1" },
  routeFrom: "Tukums, Rīgas iela",
  routeTo: "Tukuma CSDD",
  validFrom: "2026-11-20T10:00:00.000Z",
  validUntil: "2026-11-20T16:00:00.000Z",
  validHours: 6,
  tradeAct: false,
  representative: "",
};

function deps(pool: ReturnType<typeof makePool>, over: Record<string, unknown> = {}) {
  return {
    pool,
    runCli,
    env: {},
    ledgerDir: path.join(dir, "ledger"),
    dateFormat: "dd.MM.yyyy HH:mm",
    platesForCtx,
    timeoutMs: 5_000,
    log: () => {},
    replaceStopEnabled: true,
    ...over,
  };
}

describe("silts pārlūks: sesija", () => {
  it("viena pārlūka palaišana un viena pieslēgšanās sesija vairākiem soļiem un darbiem; ctx2 - savs konteksts", async () => {
    const pool = makePool();
    for (const step of ["sync", "fill", "save", "sync"]) {
      const d = await pool.driverFor(1, step);
      await d.open({ jobId: "j1", ctx: 1 });
      await d.close({ keepPage: true });
    }
    expect(pw.rec.launches).toBe(1);
    expect(pw.rec.contexts).toHaveLength(1);
    const ctx = pw.rec.contexts[0];
    // Sargi uzstādīti vienreiz (nevis sakrājas ar katru soli).
    expect(ctx.routes).toHaveLength(1);
    expect(ctx.initScripts).toBe(1);
    expect(ctx.pages[0].dialogHandlers).toHaveLength(1);
    // Katram solim svaigs adaptera stāvoklis (kā atsevišķā procesā).
    expect(globalThis.__wt.adapters).toBe(4);
    const d2 = await pool.driverFor("ctx2", "sync");
    await d2.open({ jobId: "j2", ctx: 2 });
    await d2.close({ keepPage: true });
    expect(pw.rec.launches).toBe(1);
    expect(pw.rec.contexts).toHaveLength(2);
  });

  it("vienlaikus tikai viens solis uz sesiju; release atbrīvo, ja solis draiveri neaizvēra", async () => {
    const pool = makePool();
    await pool.driverFor(1, "fill");
    await expect(pool.driverFor(1, "save")).rejects.toThrow(/aizņemta/);
    pool.release(1);
    await expect(pool.driverFor(1, "save")).resolves.toBeTruthy();
  });

  it("nezināms solis vai ctx - kļūda", async () => {
    const pool = makePool();
    await expect(pool.driverFor(1, "x")).rejects.toThrow(/nezināms solis/);
    await expect(pool.driverFor(3, "fill")).rejects.toThrow(/ctx/);
  });

  it("dīkstāvē aizver kontekstu un pārlūku; nākamais solis palaiž no jauna", async () => {
    const pool = makePool(60_000);
    const d = await pool.driverFor(1, "sync");
    await d.open({ jobId: "j1", ctx: 1 });
    await d.close({ keepPage: true });
    now += 30_000;
    await pool.closeIdle();
    expect(pool.stats().sessions).toEqual([1]);
    now += 31_000;
    await pool.closeIdle();
    expect(pool.stats()).toMatchObject({ sessions: [], browser: false });
    expect(pw.rec.contexts[0].closed).toBe(true);
    expect(pw.rec.browserClosed).toBe(1);
    const d2 = await pool.driverFor(1, "sync");
    await d2.open({ jobId: "j1", ctx: 1 });
    expect(pw.rec.launches).toBe(2);
  });

  it("aktīvu soli dīkstāves tīrīšana neaiztiek", async () => {
    const pool = makePool(1_000);
    const d = await pool.driverFor(1, "fill");
    await d.open({ jobId: "j1", ctx: 1 });
    now += 60_000;
    await pool.closeIdle();
    expect(pool.stats().sessions).toEqual([1]);
  });

  it("CDP režīmā (browserUrl) siltais pārlūks netiek lietots", async () => {
    fs.writeFileSync(path.join(ttrDir, "waybill-ui.json"), JSON.stringify({ startUrl: `${CSDD}/`, browserUrl: "http://127.0.0.1:9333" }));
    const pool = makePool();
    expect(pool.supported()).toBe(false);
    await expect(pool.driverFor(1, "fill")).rejects.toThrow(/CDP/);
  });
});

describe("silts pārlūks: drošības sargi paliek tādi paši", () => {
  it("Saglabāt tikai save solim; «Pārtraukt» un anulēšana nav pieejama fill/save/sync", async () => {
    const pool = makePool();
    for (const step of ["fill", "sync"]) {
      const d: any = await pool.driverFor(1, step);
      await d.open({ jobId: "j1", ctx: 1 });
      await expect(d.clickSave()).rejects.toThrow(/tikai save/);
      expect(d.stopWaybill).toBeUndefined();
      expect(d.annulWaybill).toBeUndefined();
      await expect(globalThis.__wt.helpers.setPhase("annul")).rejects.toThrow(/pārtraukšana drīkst tikai/);
      await d.close({ keepPage: true });
    }
    const save: any = await pool.driverFor(1, "save");
    expect(save.stopWaybill).toBeUndefined();
    expect(save.annulWaybill).toBeUndefined();
    await save.close({ keepPage: true });
    const stop: any = await pool.driverFor(1, "stop");
    expect(typeof stop.stopWaybill).toBe("function");
    expect(stop.annulWaybill).toBeUndefined();
    await expect(stop.clickSave()).rejects.toThrow(/tikai save/);
  });

  it("tīkla sargs: pārtraukšana/anulēšana bloķēta visos soļos, «Pārtraukt» uz CSDD tikai stop soļa annul fāzē", async () => {
    const pool = makePool();
    const fill: any = await pool.driverFor(1, "fill");
    await fill.open({ jobId: "j1", ctx: 1 });
    const ctx = pw.rec.contexts[0];
    expect(await probeRoute(ctx, `${CSDD}/?ex=lapv_par`, "a=partraukt")).toBe("abort");
    expect(await probeRoute(ctx, `${CSDD}/?ex=lapv&a=3`)).toBe("pass");
    await fill.close({ keepPage: true });

    const stop: any = await pool.driverFor(1, "stop");
    await stop.open({ jobId: "j1", ctx: 1 });
    const seen: string[] = [];
    globalThis.__wt.onStop = () => {
      void probeRoute(ctx, `${CSDD}/?ex=lapv_par`, "a=partraukt").then((r) => seen.push(`csdd:${r}`));
      void probeRoute(ctx, "https://example.com/?partraukt=1").then((r) => seen.push(`cits:${r}`));
      void probeRoute(ctx, `${CSDD}/?ex=lapv_dzest`, "partraukt dzēst").then((r) => seen.push(`dzest:${r}`));
    };
    await stop.stopWaybill({ waybillNo: "P01111", plate: "B193-7" });
    await new Promise((r) => setTimeout(r, 0));
    expect(seen.sort()).toEqual(["cits:abort", "csdd:pass", "dzest:abort"]);
    await stop.close({ keepPage: true });
    // Pēc stop soļa tā pati sesija vairs neko nepārtrauc (fāze un adrese atiestatītas).
    expect(await probeRoute(ctx, `${CSDD}/?ex=lapv_par`, "a=partraukt")).toBe("abort");
    const save: any = await pool.driverFor(1, "save");
    await save.open({ jobId: "j1", ctx: 1 });
    expect(await probeRoute(ctx, `${CSDD}/?ex=lapv_par`, "a=partraukt")).toBe("abort");
    expect(await probeRoute(ctx, `${CSDD}/?ex=anul`)).toBe("abort");
  });

  it("dialogu sargs: ārpus save noraida; save fāzē apstiprina, bet pārtraukšanas/anulēšanas/paziņošanas tekstu noraida", async () => {
    const pool = makePool();
    const fill: any = await pool.driverFor(1, "fill");
    await fill.open({ jobId: "j1", ctx: 1 });
    const page = pw.rec.contexts[0].pages[0];
    expect(probeDialog(page, "Vai saglabāt?")).toBe("dismiss");
    await fill.close({ keepPage: true });
    const save: any = await pool.driverFor(1, "save");
    await save.open({ jobId: "j1", ctx: 1 });
    const seen: string[] = [];
    globalThis.__wt.onSave = () => {
      seen.push(probeDialog(page, "Vai saglabāt pavadzīmi?"));
      seen.push(probeDialog(page, "Vai anulēt pavadzīmi?"));
      seen.push(probeDialog(page, "Paziņot klientam?"));
    };
    await save.clickSave();
    expect(seen).toEqual(["accept", "dismiss", "dismiss"]);
    // Pēc Saglabāt fāze pdf: dialogi atkal noraidīti.
    expect(probeDialog(page, "Vai saglabāt?")).toBe("dismiss");
    await save.close({ keepPage: true });
    expect(probeDialog(page, "Vai saglabāt?")).toBe("dismiss");
  });

  it("klikšķu sargs: Anulēt/Pārtraukt/Paziņot nekad ārpus annul; annul fāzē tikai «Pārtraukt!», nekad Anulēt vai Paziņot", async () => {
    const pool = makePool();
    const fill: any = await pool.driverFor(1, "fill");
    await fill.open({ jobId: "j1", ctx: 1 });
    const h = globalThis.__wt.helpers;
    for (const t of ["Anulēt", "Pārtraukt!", "Paziņot klientam", "Saglabāt"]) {
      const b = fakeButton(t);
      await expect(h.safeClick(b, "t")).rejects.toThrow(/klikšķis aizliegts/);
      expect(b.click).not.toHaveBeenCalled();
    }
    await fill.close({ keepPage: true });
    // Vecā soļa palīgi pēc close vairs nedarbojas (sesija pieder nākamajam solim).
    const stop: any = await pool.driverFor(1, "stop");
    await expect(h.safeClick(fakeButton("Jauna pavadzīme"), "t")).rejects.toThrow();
    await stop.open({ jobId: "j1", ctx: 1 });
    const hs = globalThis.__wt.helpers;
    await hs.setPhase("annul");
    const ok = fakeButton("Pārtraukt!");
    await hs.safeClick(ok, "annul");
    expect(ok.click).toHaveBeenCalledTimes(1);
    for (const t of ["Anulēt", "Paziņot klientam", "Saglabāt", "Dzēst"]) {
      const b = fakeButton(t);
      await expect(hs.safeClick(b, "t")).rejects.toThrow(/klikšķis aizliegts/);
      expect(b.click).not.toHaveBeenCalled();
    }
  });
});

describe("runStepInProcess", () => {
  it("annul worker nepalaiž nekad; stop tikai ar aizstāšanu", async () => {
    const pool = makePool();
    const spy = vi.spyOn(pool, "driverFor");
    await expect(runStepInProcess("annul", scriptInput(job), deps(pool))).rejects.toThrow(/script_not_allowed:annul/);
    await expect(runStepInProcess("stop", scriptInput(job), deps(pool, { replaceStopEnabled: false }))).rejects.toThrow(/script_not_allowed:stop/);
    await expect(runStepInProcess("rm", scriptInput(job), deps(pool))).rejects.toThrow(/script_not_allowed/);
    expect(spy).not.toHaveBeenCalled();
    expect(pw.rec.launches).toBe(0);
  });

  it("fill -> save vienā siltā sesijā ar īsto runCli un ledger: viens pārlūks, viens Saglabāt", async () => {
    const pool = makePool();
    const input = scriptInput(job);
    const filled = await runStepInProcess("fill", input, deps(pool));
    expect(filled).toMatchObject({ ok: true });
    const saved = await runStepInProcess("save", input, deps(pool));
    expect(saved).toMatchObject({ ok: true, waybillNo: "P01234" });
    expect(globalThis.__wt.calls.filter((c) => c === "save")).toHaveLength(1);
    expect(pw.rec.launches).toBe(1);
    expect(pool.stats().sessions).toEqual([1]);
    // Atkārtots save neklikšķina vēlreiz (ledger idempotence).
    const again = await runStepInProcess("save", input, deps(pool));
    expect(again).toMatchObject({ ok: true, repeated: true });
    expect(globalThis.__wt.calls.filter((c) => c === "save")).toHaveLength(1);
    const ledger = JSON.parse(fs.readFileSync(path.join(dir, "ledger", `${job.id}.json`), "utf8"));
    expect(ledger.state).toBe("saved");
  });

  it("agrs return pirms open (ledger) neatstāj sesiju aizņemtu", async () => {
    const pool = makePool();
    const input = scriptInput(job);
    await runStepInProcess("fill", input, deps(pool));
    await runStepInProcess("save", input, deps(pool));
    // refill pēc saglabāšanas atsakās pirms open - sesijai jābūt brīvai nākamajam solim.
    const res = await runStepInProcess("fill", input, deps(pool));
    expect(res.ok).toBe(false);
    await expect(runStepInProcess("sync", { jobId: "sync-ctx1", ctx: 1, plates: platesForCtx(1), known: [] }, deps(pool))).resolves.toMatchObject({
      ok: true,
    });
  });

  it("ok:false -> sesija aizvērta (nākamais solis sāk tīri)", async () => {
    const pool = makePool();
    globalThis.__wt.form = null;
    const bad = { ...scriptInput(job), validHours: 999 };
    const res = await runStepInProcess("fill", bad, deps(pool));
    expect(res.ok).toBe(false);
    expect(pool.stats().sessions).toEqual([]);
  });

  it("timeout -> sesija aizvērta un kļūda (kā execFile timeout)", async () => {
    const pool = makePool();
    const hang = vi.fn(() => new Promise(() => {}));
    const d = await pool.driverFor(1, "sync");
    await d.open({ jobId: "x", ctx: 1 });
    await d.close({ keepPage: true });
    await expect(runStepInProcess("sync", { ctx: 1 }, deps(pool, { runCli: hang, timeoutMs: 20 }))).rejects.toThrow(/step_timeout:sync/);
    expect(pool.stats().sessions).toEqual([]);
  });
});

describe("slēdži un poll", () => {
  it("IRISS_WAYBILL_WARM_BROWSER noklusējumā ieslēgts, 0 - vecā uzvedība", () => {
    expect(warmBrowserEnabled(undefined)).toBe(true);
    expect(warmBrowserEnabled("1")).toBe(true);
    expect(warmBrowserEnabled("0")).toBe(false);
    expect(warmBrowserEnabled("false")).toBe(false);
    expect(warmIdleMs(undefined)).toBe(600_000);
    expect(warmIdleMs("3")).toBe(180_000);
    expect(warmIdleMs("999")).toBe(600_000);
    expect(ctxNumber("ctx2")).toBe(2);
    expect(ctxNumber(5)).toBe(0);
  });

  it("worker poll: servera pollMs robežās 2..10 s; 15 min pēc sava darba - 2 s", () => {
    const n = 1_800_000_000_000;
    expect(nextPollMs({ serverPollMs: 2000, nowMs: n })).toBe(POLL_FAST_MS);
    expect(nextPollMs({ serverPollMs: 0, nowMs: n })).toBe(POLL_SLOW_MS);
    expect(nextPollMs({ serverPollMs: 100, nowMs: n })).toBe(POLL_FAST_MS);
    expect(nextPollMs({ serverPollMs: 60_000, nowMs: n })).toBe(POLL_SLOW_MS);
    expect(nextPollMs({ serverPollMs: 10_000, lastJobAtMs: n - 60_000, nowMs: n })).toBe(POLL_FAST_MS);
    expect(nextPollMs({ serverPollMs: 10_000, lastJobAtMs: n - 16 * 60_000, nowMs: n })).toBe(POLL_SLOW_MS);
  });

  it("serveris: 2 s, ja pieprasījums pēdējās 15 min vai lapa atvērta pēdējās 6 min; citādi 10 s", () => {
    const n = Date.parse("2026-11-20T12:00:00.000Z");
    const ago = (min: number) => new Date(n - min * 60_000).toISOString();
    expect(waybillWorkerPollMs({ requests: [], nowMs: n })).toBe(WAYBILL_WORKER_POLL_SLOW_MS);
    expect(waybillWorkerPollMs({ requests: [{ createdAt: ago(14) }], nowMs: n })).toBe(WAYBILL_WORKER_POLL_FAST_MS);
    expect(waybillWorkerPollMs({ requests: [{ createdAt: ago(16) }], nowMs: n })).toBe(WAYBILL_WORKER_POLL_SLOW_MS);
    expect(waybillWorkerPollMs({ requests: [], pageSeenAt: ago(5), nowMs: n })).toBe(WAYBILL_WORKER_POLL_FAST_MS);
    expect(waybillWorkerPollMs({ requests: [], pageSeenAt: ago(7), nowMs: n })).toBe(WAYBILL_WORKER_POLL_SLOW_MS);
    expect(waybillWorkerPollMs({ requests: [{ createdAt: "nav" }], pageSeenAt: "", nowMs: n })).toBe(WAYBILL_WORKER_POLL_SLOW_MS);
  });

  it("lapas atzīme: raksta ne biežāk kā reizi 3 min; vecs dokuments bez ui - tukšs", () => {
    const n = Date.parse("2026-11-20T12:00:00.000Z");
    const doc = emptyTtrControlDoc();
    expect(waybillPageSeenNeedsWrite(doc, n)).toBe(true);
    const seen = applyWaybillPageSeen(doc, new Date(n));
    expect(waybillPageSeenNeedsWrite(seen, n + 60_000)).toBe(false);
    expect(waybillPageSeenNeedsWrite(seen, n + 3 * 60_000)).toBe(true);
    expect(parseTtrControlDoc({ version: 1 }).ui.pageSeenAt).toBe("");
    expect(parseTtrControlDoc(JSON.parse(JSON.stringify(seen))).ui.pageSeenAt).toBe(new Date(n).toISOString());
  });

  it("formatTimings: queuedSec = izveide -> claim", () => {
    const t0 = Date.parse("2026-11-20T12:00:00.000Z");
    expect(formatTimings({ created: t0, claim: t0 + 2_400, vpnUp: t0 + 3_000, result: t0 + 20_000 })).toMatchObject({
      queuedSec: 2,
      totalSec: 20,
      stepsSec: { created: 0, claim: 2, vpnUp: 1 },
    });
    expect(formatTimings({ created: t0 }).queuedSec).toBeNull();
  });
});
