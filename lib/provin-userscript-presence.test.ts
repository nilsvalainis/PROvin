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

type Listener = (ev: Event) => void;

/** Minimāls `<html>` + MutationObserver, lai node vidē atdarinātu React 19 atribūtu noņemšanu. */
function installFakeDom() {
  const attrs = new Map<string, string>();
  const observers = new Set<() => void>();
  const listeners = new Map<string, Set<Listener>>();
  const notify = () => queueMicrotask(() => observers.forEach((cb) => cb()));
  const documentElement = {
    getAttribute: (name: string) => (attrs.has(name) ? attrs.get(name)! : null),
    setAttribute: (name: string, value: string) => {
      attrs.set(name, String(value));
      notify();
    },
    removeAttribute: (name: string) => {
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
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    setInterval: (fn: () => void, ms: number) => setInterval(fn, ms),
    clearInterval: (id: ReturnType<typeof setInterval>) => clearInterval(id),
    sessionStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => {
        store.set(k, String(v));
      },
    },
  } as Record<string, unknown>;
  vi.stubGlobal("document", document);
  vi.stubGlobal("window", win);
  vi.stubGlobal("MutationObserver", FakeMutationObserver);
  return { attrs, document, win };
}

/** Kā React 19 `releaseSingletonInstance`: noņem visus `<html>` atribūtus. */
function reactWipesHtml(dom: ReturnType<typeof installFakeDom>) {
  for (const key of [...dom.attrs.keys()]) dom.document.documentElement.removeAttribute(key);
}

const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));

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
    dom.document.documentElement.setAttribute(PROVIN_USERSCRIPT_ATTR, "1.24.0");
    await flush();
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
    stop();
  });

  it("atjauno versiju no sessionStorage, ja React noņem html atribūtu", () => {
    const dom = installFakeDom();
    rememberProvinUserscriptVersion("1.24.1");
    expect(dom.win.sessionStorage.getItem("provin-userscript-version")).toBe("1.24.1");
    reactWipesHtml(dom);
    (dom.win as { __provinUserscriptVersion?: string }).__provinUserscriptVersion = undefined;
    expect(readProvinUserscriptVersion()).toBe("1.24.1");
    expect(isProvinUserscriptPresent()).toBe(true);
  });

  it("bez skripta pēc loga versija paliek tukša", () => {
    installFakeDom();
    const versions: string[] = [];
    let settled = false;
    const stop = watchProvinUserscript((v) => versions.push(v), () => (settled = true));
    vi.advanceTimersByTime(PROVIN_USERSCRIPT_SETTLE_MS + 10);
    expect(settled).toBe(true);
    expect(versions.every((v) => v === "")).toBe(true);
    stop();
  });
});
