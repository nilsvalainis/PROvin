/**
 * Tampermonkey skripta klātbūtne admin lapā.
 *
 * Skripts uzliek `data-provin-userscript="<versija>"` uz `<html>`. React 19 noņem VISUS `<html>` atribūtus,
 * kad saknes singletonu iegūst no jauna (piem. hidratācijas neatbilstība, saknes klienta renderēšana), tāpēc
 * atribūts var pazust, lai gan skripts ir aktīvs. Aizsargs (`PROVIN_USERSCRIPT_GUARD_SNIPPET`) pirms hidratācijas
 * atceras versiju `window.__provinUserscriptVersion` un atjauno atribūtu; 1.24.1+ skripts arī atbild uz ping.
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
)},d=document.documentElement,w=window;function k(){var v=d.getAttribute(A);if(v){w.__provinUserscriptVersion=v;}else if(w.__provinUserscriptVersion){d.setAttribute(A,w.__provinUserscriptVersion);}}k();new MutationObserver(k).observe(d,{attributes:true,attributeFilter:[A]});}catch(e){}})();`;

export const PROVIN_USERSCRIPT_SS_KEY = "provin-userscript-version";

function cleanVersion(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().slice(0, 32) : "";
}

function persistVersion(version: string) {
  if (!version || typeof window === "undefined") return;
  (window as PresenceWindow).__provinUserscriptVersion = version;
  try {
    window.sessionStorage?.setItem(PROVIN_USERSCRIPT_SS_KEY, version);
  } catch {
    /* ignore */
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

/** Versija no `<html>` atribūta vai, ja React to noņēma, no šajā lapā jau redzētās vērtības. */
export function readProvinUserscriptVersion(): string {
  if (typeof document === "undefined") return "";
  const attr = cleanVersion(document.documentElement.getAttribute(PROVIN_USERSCRIPT_ATTR));
  if (attr) return rememberProvinUserscriptVersion(attr);
  const mem = cleanVersion((window as PresenceWindow).__provinUserscriptVersion);
  if (mem) return rememberProvinUserscriptVersion(mem);
  try {
    const ss = cleanVersion(window.sessionStorage?.getItem(PROVIN_USERSCRIPT_SS_KEY));
    if (ss) return rememberProvinUserscriptVersion(ss);
  } catch {
    /* ignore */
  }
  return "";
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
 */
export function watchProvinUserscript(
  onVersion: (version: string) => void,
  onSettled: () => void,
  settleMs = PROVIN_USERSCRIPT_SETTLE_MS,
): () => void {
  if (typeof document === "undefined") return () => {};
  const sync = () => onVersion(readProvinUserscriptVersion());
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
  pingProvinUserscript();
  const ping = window.setInterval(() => {
    if (readProvinUserscriptVersion()) {
      window.clearInterval(ping);
      return;
    }
    pingProvinUserscript();
  }, PROVIN_USERSCRIPT_PING_INTERVAL_MS);
  const settle = window.setTimeout(() => {
    window.clearInterval(ping);
    sync();
    onSettled();
  }, settleMs);
  return () => {
    obs.disconnect();
    document.removeEventListener(PROVIN_USERSCRIPT_PONG_EVENT, onPong);
    window.clearInterval(ping);
    window.clearTimeout(settle);
  };
}
