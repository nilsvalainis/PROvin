/**
 * Avotu veselība (VIN pārbaudes josla): tīra loģika bez I/O.
 * Ieraksti nāk no `recordSourceOutcomes` (lib/source-health-store.ts).
 */

export type SourceHealthEntry = {
  lastOkAt: string | null;
  lastErrAt: string | null;
  okCount: number;
  errCount: number;
  /** Secīgas kļūdas. Veiksmīgs zvans nullē. */
  failStreak?: number;
  /** Jaunākās kļūdas augšā (maks. 8). */
  errors: { at: string; msg: string }[];
};

export type FailingSourceStreak = { id: string; streak: number; msg: string };

export type SourceHealthDoc = { sources: Record<string, SourceHealthEntry> };

export type SourceOutcome = { id: string; ok: boolean; msg?: string; at?: string };

export type SourceHealthColor = "green" | "orange" | "red" | "gray";

const MAX_ERRORS = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

export function emptySourceHealthDoc(): SourceHealthDoc {
  return { sources: {} };
}

export function applySourceOutcomes(doc: SourceHealthDoc, outcomes: SourceOutcome[], nowIso = new Date().toISOString()): SourceHealthDoc {
  const sources = { ...doc.sources };
  for (const o of outcomes) {
    const at = o.at ?? nowIso;
    const prev: SourceHealthEntry = sources[o.id] ?? { lastOkAt: null, lastErrAt: null, okCount: 0, errCount: 0, errors: [] };
    const streak = o.ok ? 0 : (prev.failStreak ?? 0) + 1;
    sources[o.id] = o.ok
      ? { ...prev, lastOkAt: at, okCount: prev.okCount + 1, failStreak: streak }
      : {
          ...prev,
          lastErrAt: at,
          errCount: prev.errCount + 1,
          failStreak: streak,
          errors: [{ at, msg: (o.msg ?? "Kļūda").slice(0, 300) }, ...prev.errors].slice(0, MAX_ERRORS),
        };
  }
  return { sources };
}

/**
 * Zaļš — pēdējais rezultāts veiksmīgs un 24 h nav kļūdu; oranžs — pēdējais veiksmīgs, bet 24 h bijusi kļūda;
 * sarkans — pēdējais rezultāts kļūda; pelēks — datu nav.
 */
/** Avoti, kam pēdējie N iznākumi ir kļūdas (noklusējums 3). */
export function sourcesFailingInARow(doc: SourceHealthDoc, min = 3): FailingSourceStreak[] {
  const out: FailingSourceStreak[] = [];
  for (const [id, entry] of Object.entries(doc.sources)) {
    const streak = entry.failStreak ?? 0;
    if (streak < min) continue;
    out.push({ id, streak, msg: entry.errors[0]?.msg ?? "" });
  }
  out.sort((a, b) => b.streak - a.streak || a.id.localeCompare(b.id));
  return out;
}

export function sourceHealthColor(e: SourceHealthEntry | undefined, nowMs = Date.now()): SourceHealthColor {
  if (!e || (!e.lastOkAt && !e.lastErrAt)) return "gray";
  const ok = e.lastOkAt ? Date.parse(e.lastOkAt) : -Infinity;
  const err = e.lastErrAt ? Date.parse(e.lastErrAt) : -Infinity;
  if (err > ok) return "red";
  if (nowMs - err < DAY_MS) return "orange";
  return "green";
}
