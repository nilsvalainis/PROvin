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

/** Neizpildītie (nav „Izpildīts”) vispirms; katrā grupā jaunākie augšā. Piepirkums lieto activityUnix. */
export function sortAdminOrdersIncompleteFirst<
  T extends { created: number; activityUnix?: number; auditComplete?: boolean; isB2bPack?: boolean },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aDone = a.auditComplete || a.isB2bPack ? 1 : 0;
    const bDone = b.auditComplete || b.isB2bPack ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    const aAt = a.activityUnix ?? a.created;
    const bAt = b.activityUnix ?? b.created;
    return bAt - aAt;
  });
}

/**
 * NOTEIKUMS (Nils, 2026-10-12): atverot PRO pasūtījumu sarakstu, VISI aktīvie (neizpildītie)
 * pasūtījumi VIENMĒR ir augšā — grupā „Aktīvie” pāri visām dienām. Kārtība: kavētie pirmie,
 * tad pēc mazākā atlikušā laika (t.i. agrākais 48 h termiņš augšā). Izpildītie (un B2B pakas)
 * seko zemāk, grupēti pa dienām. Filtri (>10 €, rezultāta čipi) tiek piemēroti pirms šī.
 */
export function partitionAdminOrdersActiveFirst<
  T extends {
    created: number;
    deadlineFromUnix?: number | null;
    auditComplete?: boolean;
    isB2bPack?: boolean;
  },
>(rows: T[]): { active: T[]; done: T[] } {
  const active: T[] = [];
  const done: T[] = [];
  for (const r of rows) (r.auditComplete || r.isB2bPack ? done : active).push(r);
  const deadlineStart = (r: T) => r.deadlineFromUnix ?? r.created;
  active.sort((a, b) => deadlineStart(a) - deadlineStart(b));
  return { active, done };
}
