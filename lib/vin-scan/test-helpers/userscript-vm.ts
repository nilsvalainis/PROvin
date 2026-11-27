/**
 * Testu palīgs: palaiž īsto PROVIN userscript Node `vm` vidē ar minimālu pārlūka imitāciju
 * (window, document, GM_*), lai testi pārbaudītu, ko skripts DARA dotajā lapā, nevis tā avota tekstu.
 * Tīkla nav: GM_xmlhttpRequest zvani tikai tiek pierakstīti, atbildi dod tests pats (onload).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

export const USERSCRIPT_PUBLIC_PATH = path.join(process.cwd(), "public/userscripts/provin-vin-autofill.user.js");
export const USERSCRIPT_ROOT_PATH = path.join(process.cwd(), "provin-vin-autofill.user.js");

export function readUserscriptSource(file = USERSCRIPT_PUBLIC_PATH): string {
  return readFileSync(file, "utf8");
}

/* ---------- Metadatu galvene (līgums ar Tampermonkey) ---------- */

export type UserscriptMeta = {
  /** Visas vērtības pēc atslēgas, piem. meta.all.match, meta.all.connect. */
  all: Record<string, string[]>;
  version: string;
  match: string[];
  connect: string[];
  grant: string[];
  updateURL: string;
  downloadURL: string;
  sandbox: string;
  runAt: string;
};

/** Nolasa `// ==UserScript==` bloku struktūrā. */
export function parseUserscriptMeta(src: string): UserscriptMeta {
  const block = /\/\/ ==UserScript==\n([\s\S]*?)\/\/ ==\/UserScript==/.exec(src);
  if (!block) throw new Error("userscript: nav metadatu bloka");
  const all: Record<string, string[]> = {};
  for (const line of block[1]!.split("\n")) {
    const m = /^\/\/\s+@([\w-]+)\s+(.*\S)\s*$/.exec(line);
    if (!m) continue;
    (all[m[1]!] ??= []).push(m[2]!);
  }
  const one = (key: string) => all[key]?.[0] ?? "";
  return {
    all,
    version: one("version"),
    match: all.match ?? [],
    connect: all.connect ?? [],
    grant: all.grant ?? [],
    updateURL: one("updateURL"),
    downloadURL: one("downloadURL"),
    sandbox: one("sandbox"),
    runAt: one("run-at"),
  };
}

/** Vai Tampermonkey `@match` paraugs sedz doto URL (shēma, hosts ar `*.`, ceļa `*`). */
export function userscriptMatchCovers(pattern: string, href: string): boolean {
  const m = /^(\*|https?):\/\/([^/]+)(\/.*)$/.exec(pattern);
  if (!m) return false;
  const url = new URL(href);
  const scheme = url.protocol.replace(":", "");
  if (m[1] !== "*" && m[1] !== scheme) return false;
  const esc = (s: string) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  const hostPattern = m[2]!;
  const hostOk = hostPattern.startsWith("*.")
    ? url.hostname === hostPattern.slice(2) || url.hostname.endsWith(hostPattern.slice(1))
    : new RegExp(`^${esc(hostPattern)}$`).test(url.host) || new RegExp(`^${esc(hostPattern)}$`).test(url.hostname);
  if (!hostOk) return false;
  return new RegExp(`^${esc(m[3]!)}$`).test(url.pathname + url.search);
}

export function userscriptMatchesUrl(meta: UserscriptMeta, href: string): boolean {
  return meta.match.some((pattern) => userscriptMatchCovers(pattern, href));
}

/** Vai `@connect` atļauj GM_xmlhttpRequest uz šo hostu (domēns sedz arī apakšdomēnus). */
export function userscriptConnectAllows(meta: UserscriptMeta, hostname: string): boolean {
  const h = hostname.toLowerCase();
  return meta.connect.some((c) => c === "*" || h === c || h.endsWith(`.${c}`));
}

/* ---------- Pārlūka imitācija ---------- */

type Listener = (ev: unknown) => void;

class FakeEvent {
  constructor(
    public type: string,
    public init?: { detail?: unknown; bubbles?: boolean },
  ) {}
  get detail(): unknown {
    return this.init?.detail;
  }
}

export class FakeElement {
  tagName: string;
  attrs = new Map<string, string>();
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  children: FakeElement[] = [];
  textContent = "";
  innerText = "";
  value = "";
  type = "";
  name = "";
  id = "";
  href = "";
  disabled = false;
  checked = false;
  hidden = false;
  clicks = 0;
  events: string[] = [];
  classList = { add() {}, remove() {}, contains: () => false };
  offsetParent: unknown = {};
  labels: FakeElement[] = [];
  /** Ja iestatīts, to atgriež outerHTML (lapas HTML importam). */
  html: string | null = null;

  constructor(tag: string, props: { text?: string; attrs?: Record<string, string>; hidden?: boolean } = {}) {
    this.tagName = tag.toUpperCase();
    this.textContent = props.text ?? "";
    this.innerText = props.text ?? "";
    this.hidden = props.hidden ?? false;
    for (const [k, v] of Object.entries(props.attrs ?? {})) this.setAttribute(k, v);
  }
  setAttribute(k: string, v: string) {
    this.attrs.set(k, String(v));
    if (k === "type") this.type = String(v);
    if (k === "name") this.name = String(v);
    if (k === "id") this.id = String(v);
    if (k === "href") this.href = String(v);
    if (k === "value") this.value = String(v);
  }
  getAttribute(k: string) {
    return this.attrs.has(k) ? this.attrs.get(k)! : null;
  }
  removeAttribute(k: string) {
    this.attrs.delete(k);
  }
  /** Skripta piesaistītie klausītāji (tests tos izsauc ar `emit`; `click()` tos neizsauc). */
  handlers = new Map<string, ((ev: unknown) => unknown)[]>();
  appendChild(child: FakeElement) {
    this.children.push(child);
    return child;
  }
  remove() {}
  addEventListener(type: string, fn: (ev: unknown) => unknown) {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), fn]);
  }
  emit(type: string, ev: Record<string, unknown> = {}) {
    for (const fn of this.handlers.get(type) ?? []) fn({ type, isTrusted: true, ...ev });
  }
  removeEventListener() {}
  dispatchEvent(ev: { type?: string }) {
    this.events.push(String(ev?.type ?? ""));
    return true;
  }
  click() {
    this.clicks += 1;
  }
  focus() {}
  blur() {}
  select() {}
  closest() {
    return null;
  }
  querySelector() {
    return null;
  }
  querySelectorAll() {
    return [];
  }
  getBoundingClientRect() {
    return this.hidden ? { width: 0, height: 0 } : { width: 120, height: 32 };
  }
  get outerHTML() {
    if (this.html !== null) return this.html;
    return `<${this.tagName.toLowerCase()}>${this.textContent}</${this.tagName.toLowerCase()}>`;
  }
}

/** Ļoti vienkāršs CSS selektoru salīdzinātājs: `tag`, `#id`, `[attr]`, `[attr=x]`, `[attr*=x]`, saraksts ar komatiem. */
function matchesSelector(el: FakeElement, selector: string): boolean {
  return selector.split(",").some((raw) => {
    const part = raw.trim();
    if (!part || /[\s>+~]/.test(part.replace(/\[[^\]]*\]/g, ""))) return false;
    const head = /^([a-zA-Z0-9]*)(#[\w-]+)?/.exec(part)!;
    if (head[1] && head[1].toUpperCase() !== el.tagName) return false;
    if (head[2] && el.getAttribute("id") !== head[2].slice(1)) return false;
    const attrRe = /\[([\w-]+)(?:([*^$]?=)["']?([^"'\]]*)["']?(?:\s+i)?)?\]/g;
    let m: RegExpExecArray | null;
    while ((m = attrRe.exec(part))) {
      const have = el.getAttribute(m[1]!);
      if (have === null) return false;
      if (!m[2]) continue;
      const want = m[3]!.toLowerCase();
      const got = have.toLowerCase();
      if (m[2] === "=" && got !== want) return false;
      if (m[2] === "*=" && !got.includes(want)) return false;
      if (m[2] === "^=" && !got.startsWith(want)) return false;
      if (m[2] === "$=" && !got.endsWith(want)) return false;
    }
    return true;
  });
}

export type GmXhrRequest = {
  method?: string;
  url: string;
  anonymous?: boolean;
  timeout?: number;
  headers?: Record<string, string>;
  onload?: (res: { status: number; responseText?: string; finalUrl?: string }) => void;
  onerror?: () => void;
  ontimeout?: () => void;
};

export type UserscriptRunOptions = {
  /** GM krātuves sākuma stāvoklis (kopīgs visām cilnēm īstajā Tampermonkey). */
  gm?: Record<string, unknown>;
  /** Lapas elementi, ko atrod document.querySelector(All). */
  elements?: FakeElement[];
  /** document.body.innerText. */
  bodyText?: string;
  /** document.documentElement.outerHTML (lapas HTML, ko skripts sūta adminam). */
  pageHtml?: string;
  /** Cits skripta avots (mutāciju pārbaudēm). */
  src?: string;
  /** Ja false, <html> setAttribute netiek saglabāts (TM sandbox imitācija). */
  htmlAttributesPersist?: boolean;
  /** Papildu globālie (piem. fetch, FormData), ja tests tos imitē. */
  globals?: Record<string, unknown>;
};

export type UserscriptRun = ReturnType<typeof runUserscriptAt>;

/** Palaiž userscript dotajā lapā un atgriež visu, ko tas izdarīja vai reģistrēja. */
export function runUserscriptAt(href: string, opts: UserscriptRunOptions = {}) {
  const url = new URL(href);
  const listeners = new Map<string, Listener[]>();
  const gm = { xhr: [] as GmXhrRequest[], set: new Map<string, unknown>(Object.entries(opts.gm ?? {})) };
  const dispatched: { type: string; detail: unknown }[] = [];
  const opened: { url: string; target: string }[] = [];
  const assigned: string[] = [];
  const observers: { target: unknown; options: Record<string, unknown> }[] = [];
  const clock = { now: Date.parse("2026-11-17T10:00:00.000Z") };
  const timers: { id: number; fn: () => void; ms: number; repeat: boolean; active: boolean }[] = [];
  const elements = opts.elements ?? [];
  const errors: unknown[] = [];

  class HTMLElementBase extends FakeElement {}
  /* instanceof pārbaudes skriptā: testa elementi ir FakeElement, tāpēc klases salīdzina pēc tagName. */
  const tagClass = (tags: string[] | null) =>
    class {
      static [Symbol.hasInstance](v: unknown) {
        return v instanceof FakeElement && (tags === null || tags.includes(v.tagName));
      }
    };

  const html = new HTMLElementBase("html");
  if (opts.pageHtml !== undefined) html.html = opts.pageHtml;
  if (opts.htmlAttributesPersist === false) html.setAttribute = () => {};
  const body = new HTMLElementBase("body", { text: opts.bodyText ?? "" });
  const head = new HTMLElementBase("head");
  const created: FakeElement[] = [];

  const addTimer = (fn: () => void, ms: number | undefined, repeat: boolean) => {
    const id = timers.length + 1;
    timers.push({ id, fn, ms: Number(ms ?? 0), repeat, active: true });
    return id;
  };
  const clearTimer = (id: number) => {
    const t = timers.find((x) => x.id === id);
    if (t) t.active = false;
  };
  const timerApi = {
    setTimeout: (fn: () => void, ms?: number) => addTimer(fn, ms, false),
    setInterval: (fn: () => void, ms?: number) => addTimer(fn, ms, true),
    clearTimeout: clearTimer,
    clearInterval: clearTimer,
  };

  const document = {
    documentElement: html,
    body,
    head,
    readyState: "complete",
    title: "",
    addEventListener(type: string, fn: Listener) {
      listeners.set(type, [...(listeners.get(type) ?? []), fn]);
    },
    removeEventListener() {},
    dispatchEvent(ev: FakeEvent) {
      dispatched.push({ type: ev.type, detail: ev.detail });
      for (const fn of listeners.get(ev.type) ?? []) fn(ev);
      return true;
    },
    createElement(tag: string) {
      const el = new HTMLElementBase(tag);
      created.push(el);
      return el;
    },
    querySelector: (sel: string) => elements.find((el) => matchesSelector(el, sel)) ?? null,
    querySelectorAll: (sel: string) => elements.filter((el) => matchesSelector(el, sel)),
    getElementById: (id: string) => [...elements, ...created].find((el) => el.id === id) ?? null,
  };

  const storage = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => (storage.has(k) ? storage.get(k)! : null),
    setItem: (k: string, v: string) => void storage.set(k, String(v)),
    removeItem: (k: string) => void storage.delete(k),
  };
  const location = {
    href,
    host: url.host,
    hostname: url.hostname,
    pathname: url.pathname,
    search: url.search,
    origin: url.origin,
    assign: (to: string) => void assigned.push(String(to)),
  };
  const window: Record<string, unknown> = {
    location,
    document,
    localStorage,
    addEventListener() {},
    getComputedStyle: (el: FakeElement) => ({ display: "block", visibility: "visible", opacity: "1", ...el.style }),
    open: (to: string, target?: string) => void opened.push({ url: String(to), target: String(target ?? "") }),
    confirm: () => false,
    ...timerApi,
  };
  class FakeDate extends Date {
    static now() {
      return clock.now;
    }
  }
  const ctx = {
    window,
    document,
    location,
    localStorage,
    console: { log() {}, warn() {}, info() {}, error() {} },
    URL,
    URLSearchParams,
    JSON,
    Date: FakeDate,
    Math,
    ...timerApi,
    Event: FakeEvent,
    InputEvent: FakeEvent,
    KeyboardEvent: FakeEvent,
    CustomEvent: FakeEvent,
    MutationObserver: class {
      observe(target: unknown, options: Record<string, unknown>) {
        observers.push({ target, options });
      }
      disconnect() {}
    },
    HTMLElement: tagClass(null),
    HTMLAnchorElement: tagClass(["A"]),
    HTMLInputElement: tagClass(["INPUT"]),
    HTMLTextAreaElement: tagClass(["TEXTAREA"]),
    navigator: { userAgent: "test", clipboard: { writeText: async () => undefined } },
    GM_getValue: (k: string, d: unknown) => (gm.set.has(k) ? gm.set.get(k) : d),
    GM_setValue: (k: string, v: unknown) => void gm.set.set(k, v),
    GM_deleteValue: (k: string) => void gm.set.delete(k),
    GM_setClipboard() {},
    GM_xmlhttpRequest: (req: GmXhrRequest) => void gm.xhr.push(req),
    ...(opts.globals ?? {}),
  };
  try {
    vm.runInNewContext(opts.src ?? readUserscriptSource(), ctx, { timeout: 2000 });
  } catch (e) {
    errors.push(e);
  }

  /** Nosūta notikumu uz document (kā to dara admin lapa). */
  const fire = (type: string, detail?: unknown, extra: Record<string, unknown> = {}) => {
    for (const fn of listeners.get(type) ?? []) fn({ type, detail, ...extra });
  };
  /** Vienu reizi izpilda visus aktīvos intervālus (pēc izvēles tikai ar doto periodu). */
  const tickIntervals = (ms?: number) => {
    for (const t of [...timers]) {
      if (t.active && t.repeat && (ms === undefined || t.ms === ms)) t.fn();
    }
  };
  /** Izpilda gaidošos setTimeout (katru vienu reizi). */
  const flushTimeouts = () => {
    for (const t of [...timers]) {
      if (t.active && !t.repeat) {
        t.active = false;
        t.fn();
      }
    }
  };
  const advance = (ms: number) => {
    clock.now += ms;
  };

  return {
    listeners,
    gm,
    dispatched,
    opened,
    assigned,
    observers,
    timers,
    html,
    body,
    created,
    window,
    errors,
    fire,
    tickIntervals,
    flushTimeouts,
    advance,
  };
}
