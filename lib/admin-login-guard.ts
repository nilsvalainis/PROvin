/**
 * Admin login aizsargs, kas strādā visās Vercel instancēs bez ārēja servisa: neveiksmju skaits uz kontu
 * glabājas Blob (CAS). Progresīva aizture pēc 3. neveiksmes un bloķēšana uz 15 min pēc 10 neveiksmēm.
 * Tīras funkcijas (bez server-only) - testējamas.
 */

export const ADMIN_LOGIN_GUARD_DELAY_AFTER = 3;
export const ADMIN_LOGIN_GUARD_LOCK_AFTER = 10;
export const ADMIN_LOGIN_GUARD_LOCK_MS = 15 * 60 * 1000;
/** Neveiksmes vecākas par šo tiek aizmirstas (skaitītājs sākas no jauna). */
export const ADMIN_LOGIN_GUARD_WINDOW_MS = 60 * 60 * 1000;
export const ADMIN_LOGIN_GUARD_MAX_DELAY_MS = 8000;

export type AdminLoginGuardDoc = {
  failures: number;
  firstFailureAt: string | null;
  lockedUntil: string | null;
};

export function emptyAdminLoginGuardDoc(): AdminLoginGuardDoc {
  return { failures: 0, firstFailureAt: null, lockedUntil: null };
}

export function parseAdminLoginGuardDoc(raw: unknown): AdminLoginGuardDoc {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const failures = typeof o.failures === "number" && Number.isFinite(o.failures) && o.failures > 0 ? Math.floor(o.failures) : 0;
  return {
    failures,
    firstFailureAt: typeof o.firstFailureAt === "string" ? o.firstFailureAt : null,
    lockedUntil: typeof o.lockedUntil === "string" ? o.lockedUntil : null,
  };
}

/** Aktīvs dokuments: vecas neveiksmes (ārpus loga, bez aktīva bloka) tiek aizmirstas. */
function effective(doc: AdminLoginGuardDoc, nowMs: number): AdminLoginGuardDoc {
  const lockMs = doc.lockedUntil ? Date.parse(doc.lockedUntil) : NaN;
  if (Number.isFinite(lockMs) && lockMs > nowMs) return doc;
  const first = doc.firstFailureAt ? Date.parse(doc.firstFailureAt) : NaN;
  if (!Number.isFinite(first) || nowMs - first > ADMIN_LOGIN_GUARD_WINDOW_MS) return emptyAdminLoginGuardDoc();
  return { ...doc, lockedUntil: null };
}

export type AdminLoginGuardCheck = { allowed: true; delayMs: number } | { allowed: false; retryAfterSec: number };

/** Pirms paroles pārbaudes: vai drīkst mēģināt un cik ilgi aizturēt atbildi. */
export function checkAdminLoginGuard(doc: AdminLoginGuardDoc, nowMs: number): AdminLoginGuardCheck {
  const cur = effective(doc, nowMs);
  const lockMs = cur.lockedUntil ? Date.parse(cur.lockedUntil) : NaN;
  if (Number.isFinite(lockMs) && lockMs > nowMs) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((lockMs - nowMs) / 1000)) };
  }
  return { allowed: true, delayMs: adminLoginGuardDelayMs(cur.failures) };
}

export function adminLoginGuardDelayMs(failures: number): number {
  if (failures < ADMIN_LOGIN_GUARD_DELAY_AFTER) return 0;
  return Math.min(ADMIN_LOGIN_GUARD_MAX_DELAY_MS, 500 * 2 ** (failures - ADMIN_LOGIN_GUARD_DELAY_AFTER));
}

/** Pēc neveiksmīga mēģinājuma. */
export function recordAdminLoginFailure(doc: AdminLoginGuardDoc, nowMs: number): AdminLoginGuardDoc {
  const cur = effective(doc, nowMs);
  const failures = cur.failures + 1;
  return {
    failures,
    firstFailureAt: cur.firstFailureAt ?? new Date(nowMs).toISOString(),
    lockedUntil:
      failures >= ADMIN_LOGIN_GUARD_LOCK_AFTER ? new Date(nowMs + ADMIN_LOGIN_GUARD_LOCK_MS).toISOString() : null,
  };
}
