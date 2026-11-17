import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(path.join(process.cwd(), "public/userscripts/provin-vin-autofill.user.js"), "utf8");

type Listener = (ev: unknown) => void;

/** Palaiž userscript minimālā pārlūka imitācijā un atgriež reģistrētos document klausītājus un GM zvanus. */
function runAt(href: string) {
  const url = new URL(href);
  const listeners = new Map<string, Listener[]>();
  const gm = { xhr: [] as unknown[], set: new Map<string, unknown>() };
  const el = () => ({
    setAttribute() {},
    getAttribute: () => null,
    appendChild() {},
    remove() {},
    style: {},
    dataset: {},
    classList: { add() {}, remove() {} },
    addEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
  });
  const document = {
    documentElement: el(),
    body: el(),
    head: el(),
    readyState: "complete",
    title: "",
    addEventListener(type: string, fn: Listener) {
      listeners.set(type, [...(listeners.get(type) ?? []), fn]);
    },
    removeEventListener() {},
    dispatchEvent() {
      return true;
    },
    createElement: el,
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
  };
  const window: Record<string, unknown> = {
    location: { href, hostname: url.hostname, pathname: url.pathname, search: url.search, origin: url.origin },
    addEventListener() {},
    setTimeout: () => 0,
    setInterval: () => 0,
    clearTimeout() {},
    clearInterval() {},
  };
  const ctx = {
    window,
    document,
    location: window.location,
    console: { log() {}, warn() {}, info() {}, error() {} },
    URL,
    URLSearchParams,
    JSON,
    Date,
    Math,
    setTimeout: () => 0,
    setInterval: () => 0,
    clearTimeout() {},
    clearInterval() {},
    CustomEvent: class {
      constructor(
        public type: string,
        public init?: { detail?: unknown },
      ) {}
    },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    HTMLAnchorElement: class {},
    navigator: { userAgent: "test", clipboard: { writeText: async () => undefined } },
    GM_getValue: (k: string, d: unknown) => (gm.set.has(k) ? gm.set.get(k) : d),
    GM_setValue: (k: string, v: unknown) => void gm.set.set(k, v),
    GM_deleteValue: (k: string) => void gm.set.delete(k),
    GM_setClipboard() {},
    GM_xmlhttpRequest: (req: unknown) => void gm.xhr.push(req),
  };
  window.document = document;
  try {
    vm.runInNewContext(SRC, ctx, { timeout: 2000 });
  } catch {
    /* lapas specifiskās daļas imitācijā var krist; admin tilts tiek reģistrēts skripta sākumā */
  }
  return { listeners, gm };
}

const BRIDGE_EVENTS = [
  "provin-listing-history-request",
  "provin-browser-fetch",
  "provin-stat-vin-fetch",
  "provin-vin-scan-browser",
  "provin-userscript-ping",
];

describe("userscript admin tilts tikai PROVIN hostos", () => {
  it.each(["https://www.provin.lv/admin/vin-scan", "https://provin.lv/admin", "http://localhost:3000/admin/orders/x"])(
    "PROVIN admin (%s) reģistrē tiltu",
    (href) => {
      const { listeners } = runAt(href);
      expect(listeners.has("provin-listing-history-request")).toBe(true);
      expect(listeners.has("provin-vin-scan-browser")).toBe(true);
    },
  );

  it.each([
    "https://evil.vercel.app/admin",
    "https://provin-preview.vercel.app/admin/orders/x",
    "https://www.carvertical.com/admin/x",
    "https://provin.lv.evil.com/admin",
    "https://www.provin.lv/administrator-not-admin",
  ])("svešā lapā (%s) tilta klausītāju nav", (href) => {
    const { listeners } = runAt(href);
    for (const type of BRIDGE_EVENTS) expect(listeners.has(type), type).toBe(false);
  });

  it("listing history: http un svešs hosts netiek lasīts ar sīkdatnēm", () => {
    const { listeners, gm } = runAt("https://www.provin.lv/admin/orders/x");
    const fire = (fetchUrl: string) =>
      listeners.get("provin-listing-history-request")!.forEach((fn) => fn({ detail: { requestId: "r1", fetchUrl } }));
    fire("http://tirgusdati.lv/x");
    fire("https://evil.com/x");
    expect(gm.xhr).toHaveLength(0);
    fire("https://tirgusdati.lv/vesture?x=1");
    expect(gm.xhr).toHaveLength(1);
  });

  it("sintētisks klikšķis neieslēdz CarVertical pirkumu", () => {
    const { listeners, gm } = runAt("https://www.provin.lv/admin/orders/x");
    const anchor = Object.assign(Object.create(null), {
      dataset: { provinCarverticalPurchase: "1", provinHandoffVin: "WBA5R1C0XLFH42873" },
      href: "https://www.carvertical.com/",
    });
    const target = { closest: (sel: string) => (sel.startsWith("a") ? anchor : null) };
    const clicks = listeners.get("click") ?? [];
    expect(clicks.length).toBeGreaterThan(0);
    for (const fn of clicks) {
      try {
        fn({ target, isTrusted: false, preventDefault() {} });
      } catch {
        /* imitācijā nav HTMLAnchorElement prototipa */
      }
    }
    expect(gm.set.get("provin_cv_purchase")).toBeUndefined();
  });
});
