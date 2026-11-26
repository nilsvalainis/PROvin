/**
 * Traficom sesijas stāvoklis (Suomi.fi eIDAS -> VISS -> eParaksts Mobile), tikai nolasīšanai: `GET /traficom/session`.
 * Neko nepiesakās: stāvokli atjauno paši uzdevumi (progress / rezultāts / kļūda) un /logout.
 * Pēc releja restarta - `logged_out`, līdz nākamais uzdevums apstiprina sesiju.
 * Lietotāja numurs un sīkdatnes šeit nekad nenonāk.
 */

const LOGIN_LOST_CODES = new Set(["eparaksts_timeout", "eparaksts_refused", "not_configured", "captcha", "login_required"]);

/**
 * @typedef {{ state: string; updatedAt: string; verificationCode?: string; activeSince?: string; lastOkAt?: string;
 *   lastLookupAt?: string; lastError?: string }} TraficomSessionView
 */

/** @param {{ ttlMs?: number; now?: () => number }} [opts] */
export function createTraficomSessionState({ ttlMs, now = () => Date.now() } = {}) {
  const ttl = Math.max(60_000, Number(ttlMs) || 20 * 60_000);
  /** @type {TraficomSessionView} */
  const s = { state: "logged_out", updatedAt: new Date(now()).toISOString() };
  const stamp = () => {
    s.updatedAt = new Date(now()).toISOString();
  };
  const markActive = () => {
    const iso = new Date(now()).toISOString();
    if (s.state !== "active" || !s.activeSince) s.activeSince = iso;
    s.state = "active";
    s.lastOkAt = iso;
    delete s.verificationCode;
    delete s.lastError;
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
      if (LOGIN_LOST_CODES.has(code) || s.state === "awaiting_eparaksts") {
        s.state = "logged_out";
        delete s.activeSince;
        delete s.verificationCode;
      }
      s.lastError = String(code || "error").slice(0, 60);
      stamp();
    },
    onLogout() {
      s.state = "logged_out";
      delete s.activeSince;
      delete s.verificationCode;
      stamp();
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
