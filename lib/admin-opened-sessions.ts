/** localStorage: Stripe Checkout session ID, kas adminā jau atvērta (detaļlapā). */

export const ADMIN_OPENED_SESSION_IDS_KEY = "provin-admin-opened-session-ids-v1";
/** Vienreiz pēc pirmās sinhronizācijas — esošie apmaksātie tiek uzskatīti par jau apstrādātiem (tikai jauni rāda badge). */
export const ADMIN_OPENED_SESSIONS_SEEDED_KEY = "provin-admin-opened-sessions-seeded-v1";

const MAX_STORED_IDS = 500;

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
  return new Set(parseIds(window.localStorage.getItem(ADMIN_OPENED_SESSION_IDS_KEY)));
}

function persistOpenedSessionIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  const uniq = [...new Set(ids)];
  const trimmed = uniq.length > MAX_STORED_IDS ? uniq.slice(-MAX_STORED_IDS) : uniq;
  window.localStorage.setItem(ADMIN_OPENED_SESSION_IDS_KEY, JSON.stringify(trimmed));
}

export function markSessionOpened(sessionId: string): void {
  if (typeof window === "undefined") return;
  const id = sessionId.trim();
  if (!id) return;
  const prev = readOpenedSessionIds();
  if (prev.has(id)) {
    window.dispatchEvent(new CustomEvent("provin-admin-opened-sessions-changed"));
    return;
  }
  prev.add(id);
  persistOpenedSessionIds([...prev]);
  window.dispatchEvent(new CustomEvent("provin-admin-opened-sessions-changed"));
}

/** Pirmā ielāde: visi pašreizējie apmaksātie ID tiek pievienoti „atvērto” kopai, lai rādītu tikai vēlākus jaunumus. */
export function seedOpenedSessionsIfFirstRun(allCurrentPaidSessionIds: string[]): void {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(ADMIN_OPENED_SESSIONS_SEEDED_KEY) === "1") return;
  window.localStorage.setItem(ADMIN_OPENED_SESSIONS_SEEDED_KEY, "1");
  const merged = readOpenedSessionIds();
  for (const id of allCurrentPaidSessionIds) {
    if (id.trim()) merged.add(id.trim());
  }
  persistOpenedSessionIds([...merged]);
  window.dispatchEvent(new CustomEvent("provin-admin-opened-sessions-changed"));
}
