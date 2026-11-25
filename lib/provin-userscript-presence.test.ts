import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PROVIN_USERSCRIPT_ATTR,
  PROVIN_USERSCRIPT_GUARD_SNIPPET,
  PROVIN_USERSCRIPT_PING_EVENT,
  PROVIN_USERSCRIPT_PONG_EVENT,
  PROVIN_USERSCRIPT_SETTLE_MS,
  isProvinUserscriptPresent,
  readProvinUserscriptVersion,
  rememberProvinUserscriptVersion,
  watchProvinUserscript,
} from "@/lib/provin-userscript-presence";
import { vinScanUserscriptUpdateNeeded } from "@/lib/vin-scan/catalog";

type Listener = (ev: Event) => void;

/** Minimāls `<html>` + MutationObserver (kā jsdom/Chrome): setAttribute ziņo arī, ja vērtība nemainās. */
function installFakeDom(opts?: {
  maxAttrMutations?: number;
  /** TM 5.5 USER_SCRIPT / sandbox: getAttribute neredz setAttribute. */
  blindUserscriptAttr?: boolean;
  /** TM sandbox prototips: getAttribute atgriež String objektu, ne primitīvu. */
  boxedUserscriptAttr?: boolean;
}) {
  const attrs = new Map<string, string>();
  const observers = new Set<() => void>();
  const listeners = new Map<string, Set<Listener>>();
  const liveIntervals = new Set<ReturnType<typeof setInterval>>();
  let attrMutations = 0;
  let observerFires = 0;
  const bump = () => {
    attrMutations += 1;
    if (opts?.maxAttrMutations && attrMutations > opts.maxAttrMutations) {
      throw new Error(`html atribūtu mutāciju cilpa (${attrMutations})`);
    }
  };
  const notify = () =>
    queueMicrotask(() => {
      for (const cb of [...observers]) {
        observerFires += 1;
        if (opts?.maxAttrMutations && observerFires > opts.maxAttrMutations * 3) {
          throw new Error(`MutationObserver cilpa (${observerFires} izsaukumi)`);
        }
        cb();
      }
    });
  const documentElement = {
    getAttribute: (name: string) => {
      if (opts?.blindUserscriptAttr && name === PROVIN_USERSCRIPT_ATTR) return null;
      if (!attrs.has(name)) return null;
      const value = attrs.get(name)!;
      if (opts?.boxedUserscriptAttr && name === PROVIN_USERSCRIPT_ATTR) return Object(value);
      return value;
    },
    setAttribute: (name: string, value: string) => {
      bump();
      attrs.set(name, String(value));
      notify();
    },
    removeAttribute: (name: string) => {
      bump();
      attrs.delete(name);
      notify();
    },
  };
  const document = {
    documentElement,
    addEventListener: (type: string, cb: Listener) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(cb);
    },
    removeEventListener: (type: string, cb: Listener) => listeners.get(type)?.delete(cb),
    dispatchEvent: (ev: Event) => {
      listeners.get(ev.type)?.forEach((cb) => cb(ev));
      return true;
    },
  };
  class FakeMutationObserver {
    private cb: () => void;
    constructor(cb: () => void) {
      this.cb = () => cb();
    }
    observe() {
      observers.add(this.cb);
    }
    disconnect() {
      observers.delete(this.cb);
    }
  }
  const store = new Map<string, string>();
  const win = {
    location: { hostname: "www.provin.lv", pathname: "/admin", search: "" },
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    setInterval: (fn: () => void, ms: number) => {
      const id = setInterval(fn, ms);
      liveIntervals.add(id);
      return id;
    },
    clearInterval: (id: ReturnType<typeof setInterval>) => {
      liveIntervals.delete(id);
      clearInterval(id);
    },
    sessionStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => {
        store.set(k, String(v));
      },
    },
  } as Record<string, unknown>;
  win.document = document;
  vi.stubGlobal("document", document);
  vi.stubGlobal("window", win);
  vi.stubGlobal("MutationObserver", FakeMutationObserver);
  return {
    attrs,
    document,
    win,
    liveIntervals,
    get attrMutations() {
      return attrMutations;
    },
    get observerFires() {
      return observerFires;
    },
  };
}

/** Kā React 19 `releaseSingletonInstance`: noņem visus `<html>` atribūtus. */
function reactWipesHtml(dom: ReturnType<typeof installFakeDom>) {
  for (const key of [...dom.attrs.keys()]) dom.document.documentElement.removeAttribute(key);
}

/** 1.26.0 Tampermonkey galvene (stamp + observer + ping/pong), ko operatori jau ir uzlikuši. */
function installUserscript126Header(version = "1.26.0") {
  function stampUserscriptVersion() {
    try {
      if (document.documentElement.getAttribute("data-provin-userscript") !== version) {
        document.documentElement.setAttribute("data-provin-userscript", version);
      }
    } catch {
      /* ignore */
    }
  }
  stampUserscriptVersion();
  new MutationObserver(stampUserscriptVersion).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-provin-userscript"],
  });
  document.addEventListener("provin-userscript-ping", function () {
    stampUserscriptVersion();
    try {
      document.dispatchEvent(new CustomEvent("provin-userscript-pong", { detail: version }));
    } catch {
      /* ignore */
    }
  });
  try {
    document.dispatchEvent(new CustomEvent("provin-userscript-pong", { detail: version }));
  } catch {
    /* ignore */
  }
}

/** Pašreizējā skripta admin galvene (stamp + observer + ping/pong) no public kopijas. */
function installCurrentUserscriptAdminHeader() {
  const src = readFileSync(path.join(process.cwd(), "public/userscripts/provin-vin-autofill.user.js"), "utf8");
  const start = src.indexOf("  const SCRIPT_VERSION");
  const end = src.indexOf("  const GM_PENDING_VIN");
  if (start < 0 || end <= start) throw new Error("nav userscript admin galvenes");
  new Function(`"use strict";\n${src.slice(start, end)}`)();
}

const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));

async function flushMany(times = 20) {
  for (let i = 0; i < times; i += 1) await flush();
}

describe("PROVIN skripta klātbūtne admin lapā", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("aizsargs atjauno atribūtu pēc React noņemšanas (arī 1.24.0 skriptam bez ping)", async () => {
    const dom = installFakeDom();
    new Function(PROVIN_USERSCRIPT_GUARD_SNIPPET)();
    dom.document.documentElement.setAttribute(PROVIN_USERSCRIPT_ATTR, "1.24.0");
    await flush();
    reactWipesHtml(dom);
    await flush();
    expect(dom.attrs.get(PROVIN_USERSCRIPT_ATTR)).toBe("1.24.0");
    expect(readProvinUserscriptVersion()).toBe("1.24.0");
  });

  it("atceras redzēto versiju, ja atribūts pazūd", async () => {
    const dom = installFakeDom();
    dom.document.documentElement.setAttribute(PROVIN_USERSCRIPT_ATTR, "1.24.1");
    expect(readProvinUserscriptVersion()).toBe("1.24.1");
    dom.attrs.clear();
    expect(isProvinUserscriptPresent()).toBe(true);
    expect(readProvinUserscriptVersion()).toBe("1.24.1");
  });

  it("nerāda „nav aktīvs” pirms gaidīšanas loga; vēls skripts tiek pamanīts", async () => {
    const dom = installFakeDom();
    const versions: string[] = [];
    let settled = false;
    const stop = watchProvinUserscript((v) => versions.push(v), () => (settled = true));
    vi.advanceTimersByTime(1500);
    expect(settled).toBe(false);
    expect(dom.liveIntervals.size).toBe(1);
    dom.document.documentElement.setAttribute(PROVIN_USERSCRIPT_ATTR, "1.24.0");
    await flush();
    expect(dom.liveIntervals.size).toBe(0);
    vi.advanceTimersByTime(PROVIN_USERSCRIPT_SETTLE_MS);
    expect(settled).toBe(true);
    expect(versions.at(-1)).toBe("1.24.0");
    stop();
  });

  it("ping/pong: 1.24.1 skripts atbild arī tad, ja atribūts noņemts", async () => {
    const dom = installFakeDom();
    dom.document.addEventListener(PROVIN_USERSCRIPT_PING_EVENT, () => {
      dom.document.dispatchEvent(Object.assign(new Event(PROVIN_USERSCRIPT_PONG_EVENT), { detail: "1.24.1" }));
    });
    const versions: string[] = [];
    const stop = watchProvinUserscript((v) => versions.push(v), () => {});
    expect(versions.at(-1)).toBe("1.24.1");
    expect(dom.attrs.get(PROVIN_USERSCRIPT_ATTR)).toBe("1.24.1");
    expect(dom.liveIntervals.size).toBe(0);
    stop();
  });

  it("atjauno versiju no sessionStorage, ja React noņem html atribūtu", () => {
    const dom = installFakeDom();
    rememberProvinUserscriptVersion("1.24.1");
    const ss = dom.win.sessionStorage as { getItem: (k: string) => string | null };
    expect(ss.getItem("provin-userscript-version")).toBe("1.24.1");
    reactWipesHtml(dom);
    (dom.win as { __provinUserscriptVersion?: string }).__provinUserscriptVersion = undefined;
    expect(readProvinUserscriptVersion()).toBe("1.24.1");
    expect(isProvinUserscriptPresent()).toBe(true);
  });

  it("bez skripta pēc loga versija paliek tukša", () => {
    const dom = installFakeDom();
    const versions: string[] = [];
    let settled = false;
    const stop = watchProvinUserscript((v) => versions.push(v), () => (settled = true));
    expect(dom.liveIntervals.size).toBe(1);
    vi.advanceTimersByTime(PROVIN_USERSCRIPT_SETTLE_MS + 10);
    expect(settled).toBe(true);
    expect(versions.every((v) => v === "")).toBe(true);
    expect(dom.liveIntervals.size).toBe(0);
    stop();
  });

  it("aizsargs + 1.26.0 skripts + watch nostājas, arī ja onVersion noņem html atribūtus", async () => {
    const dom = installFakeDom({ maxAttrMutations: 40 });
    new Function(PROVIN_USERSCRIPT_GUARD_SNIPPET)();
    installUserscript126Header("1.26.0");
    const versions: string[] = [];
    const stop = watchProvinUserscript((v) => {
      versions.push(v);
      reactWipesHtml(dom);
    }, () => {});
    await flushMany(25);
    expect(versions.filter(Boolean)).toEqual(["1.26.0"]);
    expect(readProvinUserscriptVersion()).toBe("1.26.0");
    expect(dom.attrs.get(PROVIN_USERSCRIPT_ATTR)).toBe("1.26.0");
    // 1.27 pievieno kfzgutachten.at tiltu - 1.26.0 tagad prasa atjauninājumu.
    expect(vinScanUserscriptUpdateNeeded("1.26.0")).toBe(true);
    expect(dom.liveIntervals.size).toBe(0);
    expect(dom.attrMutations).toBeLessThan(20);
    expect(dom.observerFires).toBeLessThan(30);
    const mutationsAfter = dom.attrMutations;
    const firesAfter = dom.observerFires;
    await flushMany(10);
    expect(dom.attrMutations).toBe(mutationsAfter);
    expect(dom.observerFires).toBe(firesAfter);
    stop();
  });

  it("1.26.0 stamp + TM 5.5 akls getAttribute pēc React noņemšanas ieciklējas", async () => {
    const dom = installFakeDom({ maxAttrMutations: 200, blindUserscriptAttr: true });
    installUserscript126Header("1.26.0");
    reactWipesHtml(dom);
    await flushMany(25);
    expect(dom.attrMutations).toBeGreaterThan(20);
    expect(dom.observerFires).toBeGreaterThan(20);
  });

  it("1.26.0 stamp + TM sandbox boxed getAttribute ieciklējas", async () => {
    const dom = installFakeDom({ maxAttrMutations: 200, boxedUserscriptAttr: true });
    installUserscript126Header("1.26.0");
    reactWipesHtml(dom);
    await flushMany(25);
    expect(dom.attrMutations).toBeGreaterThan(20);
    expect(dom.observerFires).toBeGreaterThan(20);
  });

  it("1.26.1 stamp TM 5.5 aklā getAttribute gadījumā atvieno observeri un nestormo", async () => {
    const dom = installFakeDom({ maxAttrMutations: 40, blindUserscriptAttr: true });
    installCurrentUserscriptAdminHeader();
    reactWipesHtml(dom);
    await flushMany(10);
    vi.advanceTimersByTime(200);
    await flushMany(10);
    expect(dom.attrMutations).toBeLessThan(8);
    expect(dom.observerFires).toBeLessThan(12);
    expect(vinScanUserscriptUpdateNeeded("1.27.0")).toBe(false);
  });

  it("1.26.1 + aizsargs + watch atjauno atribūtu pēc React noņemšanas un nestormo", async () => {
    const dom = installFakeDom({ maxAttrMutations: 40 });
    new Function(PROVIN_USERSCRIPT_GUARD_SNIPPET)();
    installCurrentUserscriptAdminHeader();
    const versions: string[] = [];
    const stop = watchProvinUserscript((v) => versions.push(v), () => {});
    reactWipesHtml(dom);
    await flushMany(10);
    vi.advanceTimersByTime(50);
    await flushMany(10);
    expect(versions.filter(Boolean).at(-1)).toBe("1.27.0");
    expect(dom.attrs.get(PROVIN_USERSCRIPT_ATTR)).toBe("1.27.0");
    expect(vinScanUserscriptUpdateNeeded("1.27.0")).toBe(false);
    expect(dom.attrMutations).toBeLessThan(20);
    stop();
  });

  it("1.26.1 stamp ar boxed getAttribute nostājas pēc React noņemšanas", async () => {
    const dom = installFakeDom({ maxAttrMutations: 40, boxedUserscriptAttr: true });
    installCurrentUserscriptAdminHeader();
    reactWipesHtml(dom);
    await flushMany(10);
    vi.advanceTimersByTime(200);
    await flushMany(10);
    expect(dom.attrs.get(PROVIN_USERSCRIPT_ATTR)).toBe("1.27.0");
    expect(dom.attrMutations).toBeLessThan(8);
    expect(vinScanUserscriptUpdateNeeded("1.27.0")).toBe(false);
  });
});
