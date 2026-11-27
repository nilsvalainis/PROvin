/**
 * Traficom sesijas stāvoklis (Suomi.fi eIDAS -> VISS -> eParaksts Mobile), tikai nolasīšanai: `GET /traficom/session`.
 * Neko nepiesakās: stāvokli atjauno paši uzdevumi (progress / rezultāts / kļūda) un /logout.
 * Pēc releja restarta - `logged_out`, līdz nākamais uzdevums apstiprina sesiju.
 * Lietotāja numurs un sīkdatnes šeit nekad nenonāk.
 */

const LOGIN_LOST_CODES = new Set([
  "eparaksts_timeout",
  "eparaksts_refused",
  "not_configured",
  "captcha",
  "login_required",
  "browser_code_timeout",
  "browser_code_refused",
  "browser_code_required",
]);
const WAITING_STATES = new Set(["awaiting_eparaksts", "awaiting_browser_code"]);

/** Tikai ISO laiks (termiņš), cits nekas. */
const isoOrEmpty = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(v) && Number.isFinite(Date.parse(v)) ? v : "");

/**
 * @typedef {{ state: string; updatedAt: string; verificationCode?: string; activeSince?: string; lastOkAt?: string;
 *   lastLookupAt?: string; lastError?: string; codeExpiresAt?: string; codeExpired?: boolean; browserCodeAttempt?: number;
 *   browserCodeRejected?: boolean }} TraficomSessionView
 */

/** @param {{ ttlMs?: number; now?: () => number }} [opts] */
export function createTraficomSessionState({ ttlMs, now = () => Date.now() } = {}) {
  const ttl = Math.max(60_000, Number(ttlMs) || 20 * 60_000);
  /** @type {TraficomSessionView} */
  const s = { state: "logged_out", updatedAt: new Date(now()).toISOString() };
  const stamp = () => {
    s.updatedAt = new Date(now()).toISOString();
  };
  const clearBrowserCode = () => {
    delete s.codeExpiresAt;
    delete s.codeExpired;
    delete s.browserCodeAttempt;
    delete s.browserCodeRejected;
  };
  const markActive = () => {
    const iso = new Date(now()).toISOString();
    if (s.state !== "active" || !s.activeSince) s.activeSince = iso;
    s.state = "active";
    s.lastOkAt = iso;
    delete s.verificationCode;
    delete s.lastError;
    clearBrowserCode();
    stamp();
  };
  return {
    /** `awaiting_eparaksts` = sesijas nav (gaida apstiprinājumu telefonā), `searching` = pieteicies. */
    onProgress(state, extra = {}) {
      if (state === "awaiting_eparaksts") {
        s.state = "awaiting_eparaksts";
        delete s.activeSince;
        const code = typeof extra.verificationCode === "string" && /^[0-9A-Za-z]{2,8}$/.test(extra.verificationCode) ? extra.verificationCode : "";
        if (code) s.verificationCode = code;
        else delete s.verificationCode;
        clearBrowserCode();
        stamp();
      } else if (state === "awaiting_browser_code") {
        // Pārlūka kods (no eParaksts lietotnes) - kods pats šeit nekad nenonāk, tikai termiņš.
        s.state = "awaiting_browser_code";
        delete s.activeSince;
        delete s.verificationCode;
        if (extra.codeExpired === true) {
          s.codeExpired = true;
        } else {
          const exp = isoOrEmpty(extra.codeExpiresAt);
          if (exp) s.codeExpiresAt = exp;
          else delete s.codeExpiresAt;
          delete s.codeExpired;
          if (extra.browserCodeRejected === true) s.browserCodeRejected = true;
          else delete s.browserCodeRejected;
        }
        const n = Number(extra.browserCodeAttempt);
        if (Number.isInteger(n) && n > 0 && n < 10) s.browserCodeAttempt = n;
        stamp();
      } else if (state === "searching") {
        markActive();
      }
    },
    onSuccess() {
      markActive();
      s.lastLookupAt = s.lastOkAt;
    },
    onError(code) {
      s.lastLookupAt = new Date(now()).toISOString();
      if (LOGIN_LOST_CODES.has(code) || WAITING_STATES.has(s.state)) {
        s.state = "logged_out";
        delete s.activeSince;
        delete s.verificationCode;
        clearBrowserCode();
      }
      s.lastError = String(code || "error").slice(0, 60);
      stamp();
    },
    onLogout() {
      s.state = "logged_out";
      delete s.activeSince;
      delete s.verificationCode;
      clearBrowserCode();
      stamp();
    },
    /** Vai relejs tagad gaida pārlūka kodu. */
    awaitingBrowserCode() {
      return s.state === "awaiting_browser_code";
    },
    /** Vai pēdējais apstiprinājums jaunāks par TTL (tad sesija, visticamāk, vēl dzīva). */
    probablyAlive() {
      if (s.state !== "active") return false;
      const last = Date.parse(s.lastOkAt ?? "");
      return Number.isFinite(last) && now() - last <= ttl;
    },
    /** Publiskais skats: `active` tikai, ja pēdējais apstiprinājums jaunāks par TTL, citādi `expired`. */
    view() {
      const out = { ...s };
      if (s.state === "active") {
        const last = Date.parse(s.lastOkAt ?? "");
        if (!Number.isFinite(last) || now() - last > ttl) {
          out.state = "expired";
          delete out.activeSince;
        }
      }
      return out;
    },
  };
}
