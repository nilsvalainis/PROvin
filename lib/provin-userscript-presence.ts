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
)},d=document.documentElement,w=window;function k(){var v=d.getAttribute(A),m=w.__provinUserscriptVersion;if(v){if(!m)w.__provinUserscriptVersion=v;return;}if(m)d.setAttribute(A,m);}k();new MutationObserver(k).observe(d,{attributes:true,attributeFilter:[A]});}catch(e){}})();`;

export const PROVIN_USERSCRIPT_SS_KEY = "provin-userscript-version";

function cleanVersion(raw: unknown): string {
  // TM sandbox var atdot String objektu - pārvēršam primitīvā.
  if (raw instanceof String) raw = raw.valueOf();
  return typeof raw === "string" ? raw.trim().slice(0, 32) : "";
}

/** Skripta versiju salīdzinājums pa skaitļiem («1.27.0» > «1.26.3»); tukša virkne ir zemākā. */
export function compareProvinUserscriptVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  if (!a && b) return -1;
  if (a && !b) return 1;
  return 0;
}

function higherVersion(a: string, b: string): string {
  return compareProvinUserscriptVersions(a, b) >= 0 ? a : b;
}

function readStoredVersion(): string {
  try {
    return cleanVersion(window.sessionStorage?.getItem(PROVIN_USERSCRIPT_SS_KEY));
  } catch {
    return "";
  }
}

/** Atmiņā tikai augstākā redzētā versija: divas skripta kopijas (piem. 1.26.3 + 1.27.0) to vairs nešūpo. */
function persistVersion(version: string) {
  if (!version || typeof window === "undefined") return;
  const w = window as PresenceWindow;
  const mem = cleanVersion(w.__provinUserscriptVersion);
  if (compareProvinUserscriptVersions(version, mem) > 0) w.__provinUserscriptVersion = version;
  try {
    if (compareProvinUserscriptVersions(version, readStoredVersion()) > 0) {
      window.sessionStorage.setItem(PROVIN_USERSCRIPT_SS_KEY, version);
    }
  } catch {
    /* ignore */
  }
}

function readAttrVersion(): string {
  if (typeof document === "undefined") return "";
  try {
    return cleanVersion(document.documentElement.getAttribute(PROVIN_USERSCRIPT_ATTR));
  } catch {
    return "";
  }
}

function peekProvinUserscriptVersion(): string {
  if (typeof document === "undefined") return "";
  const attr = readAttrVersion();
  const mem = cleanVersion((window as PresenceWindow).__provinUserscriptVersion);
  return higherVersion(higherVersion(attr, mem), readStoredVersion());
}

export function rememberProvinUserscriptVersion(raw: unknown): string {
  const version = cleanVersion(raw);
  if (!version || typeof window === "undefined") return version;
  persistVersion(version);
  try {
    // Atribūtu liekam tikai tukšam: ja cita skripta kopija jau atzīmēja savu versiju, pārrakstīšana sāktu
    // cīņu (write -> observe -> write), un VIN SCAN kartītes brīdinājums mirgotu (25.11).
    if (!readAttrVersion()) document.documentElement.setAttribute(PROVIN_USERSCRIPT_ATTR, version);
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
 * `onVersion` tikai tad, kad augstākā redzētā versija pieaug, lai React setState nenoņemtu `<html>` atribūtus ciklā
 * un divas skripta kopijas nešūpotu stāvokli.
 */
export function watchProvinUserscript(
  onVersion: (version: string) => void,
  onSettled: () => void,
  settleMs = PROVIN_USERSCRIPT_SETTLE_MS,
  /** Vairākas dažādas versijas vienā lapā - Tampermonkey ir divas PROVIN skripta kopijas. Tikai, kad saraksts aug. */
  onMultiple?: (versions: string[]) => void,
): () => void {
  if (typeof document === "undefined") return () => {};
  let last: string | undefined;
  let ping = 0;
  const seen = new Set<string>();
  const stopPing = () => {
    if (!ping) return;
    window.clearInterval(ping);
    ping = 0;
  };
  const note = (raw: string) => {
    const v = cleanVersion(raw);
    if (!v || seen.has(v)) return;
    seen.add(v);
    if (seen.size > 1) onMultiple?.([...seen].sort(compareProvinUserscriptVersions));
  };
  /**
   * Tikai augšup: ja atribūtu raksta divas skripta kopijas ar dažādām versijām, tas mainās ik ~32 ms.
   * Agrāk katra maiņa bija React setState - brīdinājums VIN SCAN kartītē parādījās/pazuda (raustījās, 25.11).
   */
  const emit = (version: string) => {
    if (version) stopPing();
    if (last !== undefined && compareProvinUserscriptVersions(version, last) <= 0) return;
    last = version;
    onVersion(version);
  };
  const sync = () => {
    note(readAttrVersion());
    emit(readProvinUserscriptVersion());
  };
  const onPong = (ev: Event) => {
    const detail = (ev as CustomEvent).detail as unknown;
    const raw =
      typeof detail === "string"
        ? detail
        : detail && typeof detail === "object"
          ? (detail as { version?: unknown }).version
          : "";
    if (cleanVersion(raw)) {
      note(cleanVersion(raw));
      rememberProvinUserscriptVersion(raw);
    }
    sync();
  };
  sync();
  const obs = new MutationObserver(sync);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: [PROVIN_USERSCRIPT_ATTR] });
  document.addEventListener(PROVIN_USERSCRIPT_PONG_EVENT, onPong);
  // Vienmēr viens ping: atbild katra skripta kopija (pong), tā redzam arī dublikātus.
  pingProvinUserscript();
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

export type UserscriptBrowserInfo = {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
};

/**
 * iOS/iPadOS (arī iPad ar «desktop» UA - Macintosh + skārienekrāns) un Safari bez Chrome:
 * Tampermonkey skripts tur nestrādā, tāpēc banneri «nav aktīvs» / «atjauniniet» nerāda.
 */
export function isUserscriptUnsupportedBrowser(info?: UserscriptBrowserInfo): boolean {
  let ua = info?.userAgent;
  let platform = info?.platform;
  let touch = info?.maxTouchPoints;
  if (!info) {
    if (typeof navigator === "undefined") return false;
    ua = navigator.userAgent;
    platform = navigator.platform;
    touch = navigator.maxTouchPoints;
  }
  const u = String(ua ?? "");
  const p = String(platform ?? "");
  const t = typeof touch === "number" ? touch : 0;
  if (/iPhone|iPad|iPod/i.test(u) || /iPhone|iPad|iPod/i.test(p)) return true;
  if (/Macintosh/i.test(u) && t > 1) return true;
  const isSafari = /Safari\//.test(u) && !/(Chrome|Chromium|CriOS|Edg|EdgiOS|FxiOS|Firefox|OPR|Opera)\//i.test(u);
  return isSafari;
}
