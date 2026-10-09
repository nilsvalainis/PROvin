"use client";

import { useCallback, useState } from "react";
import { AdminVinHistoryList } from "@/components/admin/AdminVinHistoryList";
import type { QuickEvalBlockSummary, QuickEvalCandidateView } from "@/lib/quick-eval-service";
import type { QuickEvalExportRecord } from "@/lib/quick-eval-store";
import type { VinHistoryEntry } from "@/lib/vin-history";

type Data = {
  vin: string;
  seed: { at: string; parts: Record<string, string | undefined> } | null;
  blocks: QuickEvalBlockSummary[];
  exports: QuickEvalExportRecord[];
  candidates: QuickEvalCandidateView[];
  vinHistory: VinHistoryEntry[];
};

const PART_LABEL: Record<string, string> = {
  listing: "Sludinājums",
  csdd: "CSDD",
  tjekbil: "DK",
  mnt_ee: "MNT",
  lkf_ee: "LKF",
  carinfo: "SE",
};

function partTone(v: string | undefined): string {
  if (v === "filled" || v === "paste") return "bg-emerald-100 text-emerald-800";
  if (v === "not_found" || v === "no_adify_data") return "bg-slate-100 text-slate-600";
  if (v === "skip") return "bg-slate-50 text-slate-500";
  return "bg-rose-50 text-rose-700";
}

function fmt(iso: string): string {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleString("lv-LV", { dateStyle: "short", timeStyle: "short" }) : iso;
}

const MATCH_LABEL = { vin: "VIN", email: "e-pasts", phone: "tālrunis" } as const;

/**
 * Viegls ātrā vērtējuma dati panelis: ielādējas tikai atverot (lai lapa paliek ātra).
 * Bezmaksas avoti, „šis VIN jau pārbaudīts”, eksports uz apmaksātu pasūtījumu.
 */
export function AdminQuickEvalPanel({ peekId }: { peekId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/quick-evals?peekId=${encodeURIComponent(peekId)}`, { cache: "no-store" });
      if (res.ok) setData((await res.json()) as Data);
      else setMsg("Neizdevās ielādēt datus.");
    } finally {
      setLoading(false);
    }
  }, [peekId]);

  const post = useCallback(
    async (key: string, body: Record<string, unknown>, okText: (j: Record<string, unknown>) => string) => {
      setBusy(key);
      setMsg(null);
      try {
        const res = await fetch("/api/admin/quick-evals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ peekId, ...body }),
        });
        const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        setMsg(res.ok ? okText(j) : `Kļūda: ${String(j.error ?? res.status)}`);
        await load();
      } finally {
        setBusy(null);
      }
    },
    [load, peekId],
  );

  const copiedText = (j: Record<string, unknown>) => {
    const copied = Array.isArray(j.copied) ? j.copied.length : 0;
    const conflicts = Array.isArray(j.conflicts) ? (j.conflicts as string[]) : [];
    return `Pārnesti bloki: ${copied}.${conflicts.length ? ` Atšķiras (paliek esošais): ${conflicts.join(", ")}.` : ""}`;
  };

  return (
    <details
      className="mt-3 border-t border-slate-100 pt-3"
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open && !data && !loading) void load();
      }}
    >
      <summary className="cursor-pointer text-[12px] font-semibold text-[var(--color-provin-accent)]">
        Dati (bezmaksas avoti)
      </summary>
      <div className="mt-2 space-y-2">
        {loading && !data ? <p className="text-[12px] text-[var(--color-provin-muted)]">Ielādē…</p> : null}
        {data ? (
          <>
            {data.vinHistory.length > 0 ? (
              <AdminVinHistoryList
                entries={data.vinHistory}
                busyId={busy?.startsWith("reuse:") ? busy.slice(6) : busy ? "_" : null}
                onReuse={(fromId) => void post(`reuse:${fromId}`, { action: "reuse", fromId }, copiedText)}
              />
            ) : null}

            <div className="flex flex-wrap items-center gap-1.5">
              {data.vin ? <span className="font-mono text-[11px]">{data.vin}</span> : null}
              {data.seed
                ? Object.entries(data.seed.parts).map(([k, v]) => (
                    <span key={k} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${partTone(v)}`} title={v}>
                      {PART_LABEL[k] ?? k}
                    </span>
                  ))
                : (
                    <span className="text-[11px] text-[var(--color-provin-muted)]">Avoti vēl nav ielasīti</span>
                  )}
              {data.seed ? <span className="text-[10px] text-[var(--color-provin-muted)]">{fmt(data.seed.at)}</span> : null}
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void post("refresh", { action: "refresh" }, () => "Bezmaksas avoti ielasīti no jauna.")}
                className="rounded-lg border border-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-provin-muted)] hover:bg-slate-50 disabled:opacity-50"
              >
                {busy === "refresh" ? "Ielasa…" : "Atjaunot"}
              </button>
            </div>

            {data.blocks.length > 0 ? (
              <div className="space-y-1">
                {data.blocks.map((b) => (
                  <details key={b.key} className="rounded-lg border border-slate-100 bg-slate-50/60 px-2 py-1">
                    <summary className="cursor-pointer text-[11px] font-semibold text-[var(--color-apple-text)]">{b.label}</summary>
                    <pre className="mt-1 whitespace-pre-wrap text-[11px] leading-snug text-[var(--color-apple-text)]">{b.text}</pre>
                  </details>
                ))}
              </div>
            ) : null}

            <div className="rounded-lg border border-slate-100 px-2 py-1.5">
              <p className="text-[11px] font-semibold text-[var(--color-apple-text)]">Eksportēt uz pasūtījumu</p>
              {data.exports.length > 0 ? (
                <p className="text-[11px] text-emerald-700">
                  {data.exports
                    .map((e) => `${e.mode === "auto" ? "Automātiski" : "Manuāli"} → ${e.sessionId.slice(0, 14)}… (${fmt(e.at)})`)
                    .join("; ")}
                </p>
              ) : null}
              {data.candidates.length === 0 ? (
                <p className="text-[11px] text-[var(--color-provin-muted)]">Nav atbilstoša apmaksāta pasūtījuma.</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {data.candidates.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-2 text-[11px]">
                      <a href={`/admin/orders/${c.id}`} className="text-[var(--color-provin-accent)] hover:underline">
                        {fmt(new Date(c.createdMs).toISOString())}
                      </a>
                      <span>{c.name || c.email || "—"}</span>
                      {c.vin ? <span className="font-mono">{c.vin}</span> : null}
                      <span className="text-[var(--color-provin-muted)]">
                        sakrīt: {c.matchedBy.map((m) => MATCH_LABEL[m]).join(", ")}
                      </span>
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void post(`export:${c.id}`, { action: "export", sessionId: c.id }, copiedText)}
                        className="rounded-lg bg-[var(--color-provin-accent)] px-2 py-0.5 text-[11px] font-semibold text-white disabled:opacity-50"
                      >
                        {busy === `export:${c.id}` ? "Eksportē…" : "Eksportēt"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : null}
        {msg ? <p className="text-[11px] text-[var(--color-apple-text)]">{msg}</p> : null}
      </div>
    </details>
  );
}
