/**
 * Tampermonkey skripts uzliek `data-provin-userscript="<versija>"` uz `<html>`. React 19 noņem VISUS
 * `<html>` atribūtus, kad saknes singletonu iegūst no jauna, tāpēc atribūts var pazust, lai gan skripts
 * ir aktīvs. Aizsargs (`PROVIN_USERSCRIPT_GUARD_SNIPPET`) pirms hidratācijas atceras versiju
 * `window.__provinUserscriptVersion` un atjauno atribūtu; 1.24.1+ skripts arī atbild uz ping.
 *
 * Observeri un `watch` nedrīkst rakstīt atribūtu, ja vērtība jau sakrīt, un `onVersion` tikai tad, kad
 * versija tiešām mainās. Citādi React atkārtoti noņem atribūtu, aizsargs/skripts to atjauno, un
 * renderer paliek 100% CPU (write → observe → write).
 */

export const PROVIN_USERSCRIPT_ATTR = "data-provin-userscript";
export const PROVIN_USERSCRIPT_PING_EVENT = "provin-userscript-ping";
export const PROVIN_USERSCRIPT_PONG_EVENT = "provin-userscript-pong";
/** Cik ilgi gaidīt skriptu, pirms rādīt „nav aktīvs” (Tampermonkey `document-idle` var ienākt vēlu). */
export const PROVIN_USERSCRIPT_SETTLE_MS = 8000;
export const PROVIN_USERSCRIPT_PING_INTERVAL_MS = 1000;

type PresenceWindow = Window & { __provinUserscriptVersion?: string };

export const PROVIN_USERSCRIPT_GUARD_SNIPPET = `(function(){try{var A=${JSON.stringify(
  PROVIN_USERSCRIPT_ATTR,
)},d=document.documentElement,w=window;function k(){var v=d.getAttribute(A),m=w.__provinUserscriptVersion;if(v){if(m!==v)w.__provinUserscriptVersion=v;return;}if(m)d.setAttribute(A,m);}k();new MutationObserver(k).observe(d,{attributes:true,attributeFilter:[A]});}catch(e){}})();`;

export const PROVIN_USERSCRIPT_SS_KEY = "provin-userscript-version";

function cleanVersion(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().slice(0, 32) : "";
}

function persistVersion(version: string) {
  if (!version || typeof window === "undefined") return;
  const w = window as PresenceWindow;
  if (w.__provinUserscriptVersion !== version) w.__provinUserscriptVersion = version;
  try {
    if (window.sessionStorage?.getItem(PROVIN_USERSCRIPT_SS_KEY) !== version) {
      window.sessionStorage.setItem(PROVIN_USERSCRIPT_SS_KEY, version);
    }
  } catch {
    /* ignore */
  }
}

function peekProvinUserscriptVersion(): string {
  if (typeof document === "undefined") return "";
  const attr = cleanVersion(document.documentElement.getAttribute(PROVIN_USERSCRIPT_ATTR));
  if (attr) return attr;
  const mem = cleanVersion((window as PresenceWindow).__provinUserscriptVersion);
  if (mem) return mem;
  try {
    return cleanVersion(window.sessionStorage?.getItem(PROVIN_USERSCRIPT_SS_KEY));
  } catch {
    return "";
  }
}

export function rememberProvinUserscriptVersion(raw: unknown): string {
  const version = cleanVersion(raw);
  if (!version || typeof window === "undefined") return version;
  persistVersion(version);
  try {
    if (document.documentElement.getAttribute(PROVIN_USERSCRIPT_ATTR) !== version) {
      document.documentElement.setAttribute(PROVIN_USERSCRIPT_ATTR, version);
    }
  } catch {
    /* ignore */
  }
  return version;
}

/** Versija no `<html>` atribūta vai, ja React to noņēma, no šajā lapā jau redzētās vērtības. Neliek atribūtu. */
export function readProvinUserscriptVersion(): string {
  const version = peekProvinUserscriptVersion();
  if (version) persistVersion(version);
  return version;
}

export function isProvinUserscriptPresent(): boolean {
  return readProvinUserscriptVersion() !== "";
}

export function pingProvinUserscript(): void {
  if (typeof document === "undefined") return;
  try {
    document.dispatchEvent(new CustomEvent(PROVIN_USERSCRIPT_PING_EVENT));
  } catch {
    /* ignore */
  }
}

/**
 * Seko skripta versijai: atribūts, pong notikums un periodisks ping līdz `settleMs`.
 * `onSettled` izsauc vienreiz pēc gaidīšanas loga, lai „nav aktīvs” nerādītu pirms laika.
 * `onVersion` tikai tad, kad versija mainās, lai React setState nenoņemtu `<html>` atribūtus ciklā.
 */
export function watchProvinUserscript(
  onVersion: (version: string) => void,
  onSettled: () => void,
  settleMs = PROVIN_USERSCRIPT_SETTLE_MS,
): () => void {
  if (typeof document === "undefined") return () => {};
  let last: string | undefined;
  let ping = 0;
  const stopPing = () => {
    if (!ping) return;
    window.clearInterval(ping);
    ping = 0;
  };
  const emit = (version: string) => {
    if (version) stopPing();
    if (version === last) return;
    last = version;
    onVersion(version);
  };
  const sync = () => emit(readProvinUserscriptVersion());
  const onPong = (ev: Event) => {
    const detail = (ev as CustomEvent).detail as unknown;
    const raw =
      typeof detail === "string"
        ? detail
        : detail && typeof detail === "object"
          ? (detail as { version?: unknown }).version
          : "";
    if (cleanVersion(raw)) rememberProvinUserscriptVersion(raw);
    sync();
  };
  sync();
  const obs = new MutationObserver(sync);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: [PROVIN_USERSCRIPT_ATTR] });
  document.addEventListener(PROVIN_USERSCRIPT_PONG_EVENT, onPong);
  if (!last) pingProvinUserscript();
  if (!last) {
    ping = window.setInterval(() => {
      if (readProvinUserscriptVersion()) {
        stopPing();
        sync();
        return;
      }
      pingProvinUserscript();
    }, PROVIN_USERSCRIPT_PING_INTERVAL_MS);
  }
  const settle = window.setTimeout(() => {
    stopPing();
    sync();
    onSettled();
  }, settleMs);
  return () => {
    obs.disconnect();
    document.removeEventListener(PROVIN_USERSCRIPT_PONG_EVENT, onPong);
    stopPing();
    window.clearTimeout(settle);
  };
}
