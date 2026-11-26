/**
 * LTAB Smart-ID sesijas stāvoklis (tikai nolasīšanai PROVIN pusē: `GET /ltab/session`).
 * Neko nepiesakās: stāvokli atjauno paši uzdevumi (progress / rezultāts / kļūda) un /logout.
 * Pēc releja restarta - `logged_out`, līdz nākamais uzdevums apstiprina sesiju (konservatīvi: automātika gaida).
 * Forma kā e.csdd relejam (`relay/provin-ecsdd/lib/session.mjs` publicSession): state, verificationCode, activeSince,
 * lastOkAt, lastLookupAt, lastError, updatedAt. Personas kods un sīkdatnes šeit nekad nenonāk.
 */

const SMARTID_LOST_CODES = new Set(["smartid_timeout", "smartid_refused", "not_configured", "captcha"]);

export function createLtabSessionState({ ttlMs, now = () => Date.now() } = {}) {
  const ttl = Math.max(60_000, Number(ttlMs) || 20 * 60_000);
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
    /** Uzdevuma progress: `awaiting_smartid` = sesijas nav (gaida apstiprinājumu), `searching` = pieteicies. */
    onProgress(state, extra = {}) {
      if (state === "awaiting_smartid") {
        s.state = "awaiting_smartid";
        delete s.activeSince;
        const code = typeof extra.verificationCode === "string" && /^\d{4}$/.test(extra.verificationCode) ? extra.verificationCode : "";
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
      if (SMARTID_LOST_CODES.has(code) || s.state === "awaiting_smartid") {
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
