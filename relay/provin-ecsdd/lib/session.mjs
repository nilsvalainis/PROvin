/**
 * e.csdd sesijas politika (tīras funkcijas, bez pārlūka). Testi: lib/ecsdd-relay.test.ts.
 *
 * Svarīgi: e.csdd "Autorizēties visām darbībām" pārtrauc VISAS citas Vienotās pieteikšanās sesijas (Nila pārlūks,
 * telefons). Tāpēc:
 *  - serveris sesiju izveido tikai, kad Nils telefonā apstiprina Smart-ID (bez PIN1 Nila sesija netiek aiztikta);
 *  - ja servera sesija pazūd, kamēr to uzturējām (= kāds cits, visticamāk Nils, ielogojās), stāvoklis `kicked`
 *    un automātika ECSDD_YIELD_MIN minūtes pati Smart-ID neprasa (Nila sesiju neatņemam atpakaļ);
 *  - pēc neveiksmīga / atteikta Smart-ID automātika vairs pati neprasa, līdz Nils nospiež pogu (nav Smart-ID noguruma);
 *  - keep-alive tikai darba laikā un tikai, ja nesen bija uzziņa; citādi sesija nomirst pati.
 */

export const SESSION_STATES = ["logged_out", "logging_in", "awaiting_smartid", "active", "kicked", "expired"];

export function defaultSessionConfig(env = {}) {
  const num = (v, d, min) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= min ? n : d;
  };
  return {
    workFrom: num(env.ECSDD_WORK_FROM, 8, 0),
    workTo: num(env.ECSDD_WORK_TO, 20, 1),
    keepAliveMin: num(env.ECSDD_KEEPALIVE_MIN, 4, 1),
    keepAliveIdleMin: num(env.ECSDD_KEEPALIVE_IDLE_MIN, 240, 5),
    yieldMin: num(env.ECSDD_YIELD_MIN, 60, 1),
    autoLogin: !/^(0|false|no)$/i.test(String(env.ECSDD_AUTO_LOGIN ?? "1").trim()),
  };
}

export function initialSession(now = new Date()) {
  return { state: "logged_out", updatedAt: now.toISOString() };
}

const ms = (iso) => {
  const t = Date.parse(String(iso ?? ""));
  return Number.isFinite(t) ? t : 0;
};

export function parseSession(raw, now = new Date()) {
  if (!raw || typeof raw !== "object" || !SESSION_STATES.includes(raw.state)) return initialSession(now);
  const s = { ...raw };
  // Pēc restarta pārlūka pieteikšanās process ir zudis.
  if (s.state === "logging_in" || s.state === "awaiting_smartid") {
    s.state = "logged_out";
    delete s.verificationCode;
  }
  return s;
}

/** Vai yield logs (pēc izmešanas vai "Atbrīvot") vēl ir spēkā. */
export function isYielding(s, now = new Date()) {
  return ms(s?.yieldUntil) > now.getTime();
}

/**
 * Vai automātika (bez Nila pogas) drīkst sākt Smart-ID pieteikšanos.
 * Atgriež `null` (drīkst) vai iemeslu: off | night | yield | blocked | busy.
 */
export function autoLoginBlockReason(s, now, cfg, isWorkHours) {
  if (!cfg.autoLogin) return "off";
  if (s.state === "logging_in" || s.state === "awaiting_smartid") return "busy";
  if (!isWorkHours(now)) return "night";
  if (isYielding(s, now)) return "yield";
  if (s.autoLoginBlocked) return "blocked";
  return null;
}

/** Vai tagad jāsūta keep-alive pieprasījums. */
export function keepAliveDue(s, now, cfg, isWorkHours) {
  if (s.state !== "active") return false;
  if (!isWorkHours(now)) return false;
  const t = now.getTime();
  const lastUse = Math.max(ms(s.lastLookupAt), ms(s.activeSince));
  if (t - lastUse > cfg.keepAliveIdleMin * 60_000) return false;
  const lastTouch = Math.max(ms(s.lastOkAt), ms(s.lastPingAt));
  return t - lastTouch >= cfg.keepAliveMin * 60_000;
}

export function onLoginStarted(s, now, trigger) {
  const next = { ...s, state: "logging_in", loginTrigger: trigger, updatedAt: now.toISOString() };
  delete next.verificationCode;
  if (trigger === "manual") {
    // Nils pats nospieda: atceļ yield un bloķi.
    delete next.yieldUntil;
    delete next.autoLoginBlocked;
  }
  return next;
}

export function onAwaitingSmartId(s, now, code) {
  return { ...s, state: "awaiting_smartid", verificationCode: code, codeAt: now.toISOString(), updatedAt: now.toISOString() };
}

export function onLoginOk(s, now) {
  const iso = now.toISOString();
  const next = { ...s, state: "active", activeSince: iso, lastOkAt: iso, updatedAt: iso };
  delete next.verificationCode;
  delete next.codeAt;
  delete next.autoLoginBlocked;
  delete next.yieldUntil;
  delete next.lastError;
  return next;
}

/** Smart-ID nav apstiprināts / atteikts / lapa mainījusies: automātika vairs pati neprasa. */
export function onLoginFailed(s, now, code) {
  const next = { ...s, state: "logged_out", autoLoginBlocked: code || "error", lastError: code || "error", updatedAt: now.toISOString() };
  delete next.verificationCode;
  delete next.codeAt;
  return next;
}

/** Veiksmīga darbība ielogotā sesijā (ping vai uzziņa). */
export function onSessionOk(s, now, { lookup = false } = {}) {
  const iso = now.toISOString();
  return { ...s, state: "active", lastOkAt: iso, ...(lookup ? { lastLookupAt: iso } : { lastPingAt: iso }), updatedAt: iso };
}

/**
 * Sesija vairs nav ielogota. Ja pēdējā veiksmīgā pārbaude bija nesen (mēs to uzturējām), to izmeta cita
 * pieteikšanās (Nils) -> `kicked` + yield. Citādi tā vienkārši beidzās -> `expired`.
 */
export function onLoggedOutDetected(s, now, cfg) {
  const iso = now.toISOString();
  const wasActive = s.state === "active";
  const recent = now.getTime() - ms(s.lastOkAt) <= (cfg.keepAliveMin * 2 + 1) * 60_000;
  const next = { ...s, updatedAt: iso };
  delete next.verificationCode;
  if (wasActive && recent) {
    next.state = "kicked";
    next.kickedAt = iso;
    next.yieldUntil = new Date(now.getTime() + cfg.yieldMin * 60_000).toISOString();
  } else {
    next.state = "expired";
  }
  return next;
}

/** "Atbrīvot e.csdd": serveris iziet un `minutes` laikā pats nepiesakās (Nils strādā savā pārlūkā). */
export function onReleased(s, now, minutes) {
  const iso = now.toISOString();
  const next = { ...s, state: "logged_out", updatedAt: iso, yieldUntil: new Date(now.getTime() + minutes * 60_000).toISOString() };
  delete next.verificationCode;
  delete next.codeAt;
  return next;
}

/** Ko rāda PROVIN admin (bez personas datiem). */
export function publicSession(s, now, cfg, isWorkHours) {
  return {
    state: s.state,
    ...(s.state === "awaiting_smartid" && s.verificationCode ? { verificationCode: s.verificationCode } : {}),
    ...(s.activeSince ? { activeSince: s.activeSince } : {}),
    ...(s.lastOkAt ? { lastOkAt: s.lastOkAt } : {}),
    ...(s.lastLookupAt ? { lastLookupAt: s.lastLookupAt } : {}),
    ...(isYielding(s, now) ? { yieldUntil: s.yieldUntil } : {}),
    ...(s.kickedAt ? { kickedAt: s.kickedAt } : {}),
    ...(s.lastError ? { lastError: s.lastError } : {}),
    autoLoginBlockedReason: autoLoginBlockReason(s, now, cfg, isWorkHours),
    keepAlive: s.state === "active" && isWorkHours(now),
    updatedAt: s.updatedAt,
  };
}
