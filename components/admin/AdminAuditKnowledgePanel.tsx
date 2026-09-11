"use client";

import { useCallback, useEffect, useState } from "react";

type LearningsSummary = {
  keyCount: number;
  snippetTotal: number;
  updatedAt: string;
  engineKeys: Array<{ key: string; label: string; snippets: number }>;
  topKeys: Array<{ key: string; label: string; snippets: number }>;
};

type BackfillResult = {
  scanned?: number;
  recorded?: number;
  skipped?: number;
  errors?: number;
  summary?: LearningsSummary;
};

type PromoteResult = {
  candidateCount?: number;
  markdownChars?: number;
};

const btnClass =
  "inline-flex min-h-[40px] items-center justify-center rounded-xl border border-slate-200/90 bg-white px-4 py-2 text-[13px] font-semibold text-[var(--color-apple-text)] shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

async function postAction(action: "status" | "backfill" | "promote", extra?: Record<string, unknown>) {
  const res = await fetch("/api/admin/audit-knowledge", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...extra }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : `HTTP ${res.status}`,
    );
  }
  return data;
}

function formatWhen(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t) || t <= 0) return "nav";
  try {
    return new Date(t).toLocaleString("lv-LV");
  } catch {
    return iso;
  }
}

/** Operatora panelis: agregātu atmiņas statuss + backfill / promote ar vienu klikšķi. */
export function AdminAuditKnowledgePanel() {
  const [summary, setSummary] = useState<LearningsSummary | null>(null);
  const [busy, setBusy] = useState<"status" | "backfill" | "promote" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lastBackfill, setLastBackfill] = useState<BackfillResult | null>(null);
  const [lastPromote, setLastPromote] = useState<PromoteResult | null>(null);

  const loadStatus = useCallback(async () => {
    setBusy("status");
    setErr(null);
    try {
      const data = (await postAction("status")) as LearningsSummary & { ok?: boolean };
      setSummary({
        keyCount: data.keyCount ?? 0,
        snippetTotal: data.snippetTotal ?? 0,
        updatedAt: data.updatedAt ?? "",
        engineKeys: data.engineKeys ?? [],
        topKeys: data.topKeys ?? [],
      });
      setNotice("Statuss atjaunināts.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Neizdevās ielādēt statusu");
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const runBackfill = async () => {
    setBusy("backfill");
    setErr(null);
    setNotice(null);
    try {
      const data = (await postAction("backfill", { limit: 120 })) as BackfillResult & {
        ok?: boolean;
      };
      setLastBackfill(data);
      if (data.summary) setSummary(data.summary);
      else await loadStatus();
      setNotice(
        `Backfill gatavs: apskatīti ${data.scanned ?? "?"}, ierakstīti ${data.recorded ?? "?"}, izlaisti ${data.skipped ?? "?"}${
          data.errors ? `, kļūdas ${data.errors}` : ""
        }.`,
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Backfill neizdevās");
    } finally {
      setBusy(null);
    }
  };

  const runPromote = async () => {
    setBusy("promote");
    setErr(null);
    setNotice(null);
    try {
      const data = (await postAction("promote")) as PromoteResult & { ok?: boolean };
      setLastPromote(data);
      setNotice(
        `Promote gatavs: ${data.candidateCount ?? 0} kandidāti (${data.markdownChars ?? 0} rakstzīmes).`,
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Promote neizdevās");
    } finally {
      setBusy(null);
    }
  };

  const engineOm654 = summary?.engineKeys.find((k) => /OM654/i.test(k.key) || /OM654/i.test(k.label));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnClass} disabled={busy !== null} onClick={() => void loadStatus()}>
          {busy === "status" ? "Ielādē…" : "Atsvaidzināt statusu"}
        </button>
        <button type="button" className={btnClass} disabled={busy !== null} onClick={() => void runBackfill()}>
          {busy === "backfill" ? "Skenē auditus…" : "1. Iemācīties no vēstures (backfill)"}
        </button>
        <button type="button" className={btnClass} disabled={busy !== null} onClick={() => void runPromote()}>
          {busy === "promote" ? "Veido sarakstu…" : "2. Sagatavot kandidātus (promote)"}
        </button>
      </div>

      {notice ? (
        <p className="rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-[13px] text-emerald-950">
          {notice}
        </p>
      ) : null}
      {err ? (
        <p className="rounded-xl border border-red-200/80 bg-red-50/80 px-4 py-3 text-[13px] text-red-900">
          {err}
        </p>
      ) : null}

      <div className="rounded-2xl border border-slate-200/90 bg-white px-4 py-4 shadow-sm">
        <h2 className="text-[14px] font-semibold text-[var(--color-apple-text)]">Atmiņas stāvoklis</h2>
        {summary ? (
          <dl className="mt-3 grid gap-2 text-[13px] sm:grid-cols-2">
            <div>
              <dt className="text-[var(--color-provin-muted)]">Atslēgas</dt>
              <dd className="font-semibold tabular-nums">{summary.keyCount}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-provin-muted)]">Fragmenti kopā</dt>
              <dd className="font-semibold tabular-nums">{summary.snippetTotal}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-provin-muted)]">ENGINE|… kodi</dt>
              <dd className="font-semibold tabular-nums">{summary.engineKeys.length}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-provin-muted)]">Pēdējā atjaunināšana</dt>
              <dd className="font-medium">{formatWhen(summary.updatedAt)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[var(--color-provin-muted)]">OM654</dt>
              <dd className="font-medium">
                {engineOm654
                  ? `${engineOm654.key}: ${engineOm654.snippets} fragmenti`
                  : "vēl nav ENGINE|OM654 ieraksta (pēc backfill / nākamajiem OM654 auditiem)"}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-[13px] text-[var(--color-provin-muted)]">Ielādē…</p>
        )}
      </div>

      {summary && summary.topKeys.length > 0 ? (
        <div className="rounded-2xl border border-slate-200/90 bg-white px-4 py-4 shadow-sm">
          <h2 className="text-[14px] font-semibold text-[var(--color-apple-text)]">Top atslēgas</h2>
          <ul className="mt-3 space-y-1.5 text-[12px]">
            {summary.topKeys.map((k) => (
              <li key={k.key} className="flex justify-between gap-3 border-b border-slate-100 py-1.5 last:border-0">
                <span className="min-w-0 truncate font-mono text-[11px]" title={k.key}>
                  {k.label || k.key}
                </span>
                <span className="shrink-0 tabular-nums text-[var(--color-provin-muted)]">{k.snippets}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {lastBackfill || lastPromote ? (
        <p className="text-[11px] text-[var(--color-provin-muted)]">
          {lastBackfill
            ? `Pēdējais backfill: scanned=${lastBackfill.scanned ?? "?"} recorded=${lastBackfill.recorded ?? "?"}. `
            : null}
          {lastPromote ? `Pēdējais promote: ${lastPromote.candidateCount ?? 0} kandidāti.` : null}
        </p>
      ) : null}
    </div>
  );
}
