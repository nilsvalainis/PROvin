/**
 * Admin pasūtījumu saraksts — 48 h termiņa manuāla „Izpildīts” atzīme.
 * Servera avots: `lib/admin-audit-complete-store.ts` (atsevišķs Blob indekss).
 * localStorage — tikai īslaicīgs UX kešs / migrācija no vecās versijas.
 */

export const ADMIN_AUDIT_COMPLETE_STORAGE_KEY = "provin-admin-audit-complete-v1";

export function parseAuditCompleteIds(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string" && x.length > 0));
  } catch {
    return new Set();
  }
}

export function serializeAuditCompleteIds(ids: Iterable<string>): string {
  return JSON.stringify([...ids]);
}

export function readAuditCompleteIdsFromStorage(
  getItem: (key: string) => string | null,
): Set<string> {
  return parseAuditCompleteIds(getItem(ADMIN_AUDIT_COMPLETE_STORAGE_KEY));
}

export function writeAuditCompleteIdsToStorage(
  setItem: (key: string, value: string) => void,
  ids: Set<string>,
): void {
  setItem(ADMIN_AUDIT_COMPLETE_STORAGE_KEY, serializeAuditCompleteIds(ids));
}

export function toggleAuditCompleteInSet(ids: Set<string>, sessionId: string): Set<string> {
  const next = new Set(ids);
  if (next.has(sessionId)) next.delete(sessionId);
  else next.add(sessionId);
  return next;
}

export function setAuditCompleteInLocalCache(
  sessionId: string,
  complete: boolean,
  getItem: (key: string) => string | null,
  setItem: (key: string, value: string) => void,
): void {
  const ids = readAuditCompleteIdsFromStorage(getItem);
  if (complete) ids.add(sessionId);
  else ids.delete(sessionId);
  writeAuditCompleteIdsToStorage(setItem, ids);
}

/** Neizpildītie (nav „Izpildīts”) vispirms; katrā grupā jaunākie augšā, kā līdz šim. */
export function sortAdminOrdersIncompleteFirst<T extends { created: number; auditComplete?: boolean }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const aDone = a.auditComplete ? 1 : 0;
    const bDone = b.auditComplete ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    return b.created - a.created;
  });
}
