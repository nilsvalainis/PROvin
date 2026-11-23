/**
 * Pārlūka (Tampermonkey) VIN SCAN avotu uzraudzība no faktiskās lietošanas (tīras funkcijas).
 * Cron tos nevar pārbaudīt (servera IP bloķēts), tāpēc skaita importus pa dienām:
 * ok = imports saglabāts, fail = noraidīts (page_not_ready, challenge u.c.).
 * Problēma = pēdējās 7 dienās bija izsaukumi, bet neviens neizdevās.
 */

export type VinScanBrowserUsageCounts = { ok: number; fail: number; challenge: number };

export type VinScanBrowserUsageDoc = {
  version: 1;
  /** `YYYY-MM-DD` (UTC) → avots → skaitītāji. */
  days: Record<string, Record<string, VinScanBrowserUsageCounts>>;
};

export const VIN_SCAN_BROWSER_USAGE_KEEP_DAYS = 10;
export const VIN_SCAN_BROWSER_USAGE_WINDOW_DAYS = 7;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[a-z0-9_]{1,40}$/;

export function emptyVinScanBrowserUsageDoc(): VinScanBrowserUsageDoc {
  return { version: 1, days: {} };
}

function count(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

export function parseVinScanBrowserUsageDoc(raw: unknown): VinScanBrowserUsageDoc {
  const out = emptyVinScanBrowserUsageDoc();
  const days = raw && typeof raw === "object" ? (raw as { days?: unknown }).days : null;
  if (!days || typeof days !== "object") return out;
  for (const [day, rows] of Object.entries(days as Record<string, unknown>)) {
    if (!DAY_RE.test(day) || !rows || typeof rows !== "object") continue;
    const next: Record<string, VinScanBrowserUsageCounts> = {};
    for (const [id, c] of Object.entries(rows as Record<string, unknown>)) {
      if (!ID_RE.test(id) || !c || typeof c !== "object") continue;
      const r = c as Record<string, unknown>;
      next[id] = { ok: count(r.ok), fail: count(r.fail), challenge: count(r.challenge) };
    }
    out.days[day] = next;
  }
  return out;
}

function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function applyVinScanBrowserUsage(
  doc: VinScanBrowserUsageDoc,
  event: { id: string; ok: boolean; challenge?: boolean },
  nowMs: number,
): VinScanBrowserUsageDoc {
  if (!ID_RE.test(event.id)) return doc;
  const day = utcDay(nowMs);
  const minDay = utcDay(nowMs - (VIN_SCAN_BROWSER_USAGE_KEEP_DAYS - 1) * 86_400_000);
  const days: VinScanBrowserUsageDoc["days"] = {};
  for (const [d, rows] of Object.entries(doc.days)) if (d >= minDay) days[d] = rows;
  const rows = { ...(days[day] ?? {}) };
  const cur = rows[event.id] ?? { ok: 0, fail: 0, challenge: 0 };
  rows[event.id] = {
    ok: cur.ok + (event.ok ? 1 : 0),
    fail: cur.fail + (event.ok ? 0 : 1),
    challenge: cur.challenge + (!event.ok && event.challenge ? 1 : 0),
  };
  days[day] = rows;
  return { version: 1, days };
}

export type VinScanBrowserProblem = { id: string; fail: number; challenge: number };

/** Avoti, kam pēdējās N dienās katrs izsaukums bija kļūda vai challenge. */
export function vinScanBrowserProblems(
  doc: VinScanBrowserUsageDoc,
  nowMs: number,
  windowDays = VIN_SCAN_BROWSER_USAGE_WINDOW_DAYS,
): VinScanBrowserProblem[] {
  const minDay = utcDay(nowMs - (windowDays - 1) * 86_400_000);
  const totals = new Map<string, VinScanBrowserUsageCounts>();
  for (const [day, rows] of Object.entries(doc.days)) {
    if (day < minDay) continue;
    for (const [id, c] of Object.entries(rows)) {
      const t = totals.get(id) ?? { ok: 0, fail: 0, challenge: 0 };
      totals.set(id, { ok: t.ok + c.ok, fail: t.fail + c.fail, challenge: t.challenge + c.challenge });
    }
  }
  return [...totals.entries()]
    .filter(([, t]) => t.ok === 0 && t.fail > 0)
    .map(([id, t]) => ({ id, fail: t.fail, challenge: t.challenge }))
    .sort((a, b) => b.fail - a.fail || a.id.localeCompare(b.id));
}

export function vinScanBrowserProblemsLine(
  problems: readonly VinScanBrowserProblem[],
  label: (id: string) => string,
): string | null {
  if (problems.length === 0) return null;
  const rows = problems.map((p) => {
    const ch = p.challenge > 0 ? `, ${p.challenge} challenge` : "";
    return `${label(p.id)} (${p.fail} kļūdas${ch})`;
  });
  return `VIN SCAN pārlūka avoti ar problēmām (7 d, neviens izsaukums neizdevās): ${rows.join(", ")}`;
}
