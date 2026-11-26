"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { QuickEvalAutoStatus, QuickEvalAutoStepId, QuickEvalAutoView } from "@/lib/quick-eval-auto-core";

/**
 * Ātrā vērtējuma automātikas statuss (minimāli, esošajā admin stilā): Apstrādā… / Gatavs / Kļūda + Atkārtot,
 * sarkanie karogi un «Ieteicams piedāvāt» (datu tipi bez avotu nosaukumiem). Pilnais dizains - pēc v4 maketa.
 */

const STEP_LABEL: Record<QuickEvalAutoStepId, string> = {
  plate_vin: "Numurs -> VIN",
  free_sources: "Bezmaksas avoti",
  vin_scan: "VIN SCAN",
  auctions: "Izsoles",
  previews: "Priekšskati",
  ecsdd: "e.csdd",
  ltab: "LTAB",
  analysis: "Analīze",
};

const STEP_ORDER = Object.keys(STEP_LABEL) as QuickEvalAutoStepId[];

const STEP_TONE: Record<string, string> = {
  ok: "text-emerald-700",
  none: "text-[var(--color-provin-muted)]",
  skipped: "text-[var(--color-provin-muted)]",
  error: "text-rose-700",
  smartid_wait: "text-amber-700",
  running: "text-sky-700",
};

const FLAG_TONE = {
  red: "border-rose-200 bg-rose-50 text-rose-800",
  yellow: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-slate-200 bg-slate-50 text-slate-700",
} as const;

const btn =
  "inline-flex items-center justify-center rounded-[9px] border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-[var(--color-apple-text)] hover:bg-slate-50 disabled:opacity-50";

export function AdminQuickEvalAutoPanel({
  peekId,
  view,
  status,
  productLabels,
}: {
  peekId: string;
  view: QuickEvalAutoView;
  status: QuickEvalAutoStatus | null;
  /** Mūsu produktu nosaukums + cena (serverī no `order-upsell`), piem. «PROVIN AUDITS 99,99 €». */
  productLabels: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (view !== "running") return;
    const t = window.setInterval(() => router.refresh(), 8_000);
    return () => window.clearInterval(t);
  }, [view, router]);

  const retry = async () => {
    setBusy(true);
    await fetch("/api/admin/quick-evals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ peekId, action: "auto_retry" }),
    }).catch(() => null);
    setBusy(false);
    router.refresh();
  };

  const head =
    view === "running" ? (
      <span className="text-sky-700">Apstrādā…</span>
    ) : view === "ready" ? (
      <span className="text-emerald-700">Gatavs</span>
    ) : view === "error" ? (
      <span className="text-rose-700">Kļūda{status?.error ? `: ${status.error}` : ""}</span>
    ) : (
      <span className="text-[var(--color-provin-muted)]">Nav palaists</span>
    );

  return (
    <section className="mt-4 rounded-2xl bg-white px-4 py-3 shadow-[0_0_0_0.5px_rgba(0,0,0,0.1)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--color-apple-text)]">
          Automātika · <span className="normal-case tracking-normal">{head}</span>
          {status?.cacheHit ? <span className="ml-2 font-normal normal-case tracking-normal text-[var(--color-provin-muted)]">VIN SCAN no keša</span> : null}
        </h3>
        {view === "error" || view === "none" ? (
          <button type="button" className={btn} disabled={busy} onClick={retry}>
            {busy ? "Sāk…" : "Atkārtot"}
          </button>
        ) : null}
      </div>

      {status && Object.keys(status.steps).length ? (
        <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
          {STEP_ORDER.filter((id) => status.steps[id]).map((id) => {
            const s = status.steps[id]!;
            return (
              <span key={id} className={STEP_TONE[s.state]} title={s.note}>
                {STEP_LABEL[id]}: {s.state === "smartid_wait" ? "Smart-ID gaida" : (s.note ?? s.state)}
              </span>
            );
          })}
        </p>
      ) : null}

      {view === "ready" || (status?.flags.length ?? 0) > 0 ? (
        <div className="mt-2.5">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--color-provin-muted)]">Sarkanie karogi un pretrunas</h4>
          {status?.flags.length ? (
            <ul className="mt-1 space-y-1">
              {status.flags.map((f) => (
                <li key={f.text} className={`rounded-lg border px-2.5 py-1 text-[12px] ${FLAG_TONE[f.severity]}`}>
                  {f.text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[12px] text-[var(--color-provin-muted)]">Nav atrasts.</p>
          )}
        </div>
      ) : null}

      {view === "ready" ? (
        <div className="mt-2.5">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--color-provin-muted)]">Ieteicams piedāvāt</h4>
          {status?.recommendations.length ? (
            <>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12.5px] text-[var(--color-apple-text)]">
                {status.recommendations.map((r) => (
                  <li key={r.text}>{r.text}</li>
                ))}
              </ul>
              <p className="mt-1 text-[11px] text-[var(--color-provin-muted)]">{productLabels.join(" · ")}</p>
            </>
          ) : (
            <p className="mt-1 text-[12px] text-[var(--color-provin-muted)]">Nav datu, ko pamatoti piedāvāt.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
