/** localStorage: Stripe Checkout session ID, kas adminā jau atvērta (detaļlapā). */

export const ADMIN_OPENED_SESSION_IDS_KEY = "provin-admin-opened-session-ids-v1";
/** Vienreiz pēc pirmās sinhronizācijas — esošie apmaksātie tiek uzskatīti par jau apstrādātiem (tikai jauni rāda badge). */
export const ADMIN_OPENED_SESSIONS_SEEDED_KEY = "provin-admin-opened-sessions-seeded-v1";

const MAX_STORED_IDS = 500;

function isStorageQuotaError(e: unknown): boolean {
  if (!(e instanceof DOMException)) return false;
  return e.code === 22 || e.code === 1014 || e.name === "QuotaExceededError";
}

function safeStorageGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (e) {
    if (!isStorageQuotaError(e)) return false;
    console.warn(
      "LocalStorage quota exceeded. Clearing older session IDs to recover context safely.",
      { key },
    );
    try {
      window.localStorage.removeItem(key);
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }
}

function parseIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is string => typeof x === "string" && x.length > 0);
  } catch {
    return [];
  }
}

export function readOpenedSessionIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  return new Set(parseIds(safeStorageGet(ADMIN_OPENED_SESSION_IDS_KEY)));
}

function persistOpenedSessionIds(ids: string[]): boolean {
  if (typeof window === "undefined") return false;
  const uniq = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  let trimmed = uniq.length > MAX_STORED_IDS ? uniq.slice(-MAX_STORED_IDS) : uniq;

  while (trimmed.length > 0) {
    const payload = JSON.stringify(trimmed);
    if (safeStorageSet(ADMIN_OPENED_SESSION_IDS_KEY, payload)) return true;
    const nextLen = Math.max(1, Math.floor(trimmed.length / 2));
    if (nextLen >= trimmed.length) break;
    trimmed = trimmed.slice(-nextLen);
  }

  try {
    window.localStorage.removeItem(ADMIN_OPENED_SESSION_IDS_KEY);
  } catch {
    /* quota / private mode */
  }
  return false;
}

function dispatchOpenedSessionsChanged(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("provin-admin-opened-sessions-changed"));
  } catch {
    /* ignore */
  }
}

export function markSessionOpened(sessionId: string): void {
  if (typeof window === "undefined") return;
  const id = sessionId.trim();
  if (!id) return;
  const prev = readOpenedSessionIds();
  if (prev.has(id)) {
    dispatchOpenedSessionsChanged();
    return;
  }
  prev.add(id);
  persistOpenedSessionIds([...prev]);
  dispatchOpenedSessionsChanged();
}

/** Pirmā ielāde: visi pašreizējie apmaksātie ID tiek pievienoti „atvērto” kopai, lai rādītu tikai vēlākus jaunumus. */
export function seedOpenedSessionsIfFirstRun(allCurrentPaidSessionIds: string[]): void {
  if (typeof window === "undefined") return;
  if (safeStorageGet(ADMIN_OPENED_SESSIONS_SEEDED_KEY) === "1") return;

  const merged = readOpenedSessionIds();
  for (const id of allCurrentPaidSessionIds) {
    const t = id.trim();
    if (t) merged.add(t);
  }
  if (!persistOpenedSessionIds([...merged])) return;

  if (!safeStorageSet(ADMIN_OPENED_SESSIONS_SEEDED_KEY, "1")) return;
  dispatchOpenedSessionsChanged();
}
