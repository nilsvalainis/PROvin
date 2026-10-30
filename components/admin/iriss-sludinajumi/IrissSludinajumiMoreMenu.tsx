"use client";

import { Activity, Calculator, RefreshCw, Trash2 } from "lucide-react";
import { listingSyncProgressLabel } from "@/lib/iriss-listings-panel";

const STROKE = 1.6;

export function IrissSludinajumiMoreMenu({
  syncBusy,
  syncMsg,
  problemCount,
  extrasLabel,
  includeSort,
  sortLabel,
  onSort,
  onSync,
  onSourceStatus,
  onCosts,
  onReset,
}: {
  syncBusy: boolean;
  syncMsg: string | null;
  problemCount: number;
  extrasLabel: string;
  includeSort?: boolean;
  sortLabel?: string;
  onSort?: () => void;
  onSync: () => void;
  onSourceStatus: () => void;
  onCosts: () => void;
  /** Nils 30.10: notīrīt ielasītos sludinājumus (tikai adminam). */
  onReset?: () => void;
}) {
  const progress = listingSyncProgressLabel(syncBusy, syncMsg);
  return (
    <div className="flex flex-col">
      {includeSort && onSort ? (
        <>
          <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.045em] text-[var(--slud-ink3,var(--iriss-ink-3))]">Kārtot</p>
          <button type="button" onClick={onSort} className="mb-3 flex min-h-11 w-full items-center justify-between rounded-xl px-1 text-left text-[15px] hover:bg-[var(--slud-fill)]">
            <span>Kārtot</span>
            <span className="text-[13px] text-[var(--slud-ink2)]">{sortLabel}</span>
          </button>
        </>
      ) : null}
      <p className="text-[12px] font-semibold uppercase tracking-[0.045em] text-[var(--slud-ink3,var(--iriss-ink-3))]">Nolasīšana</p>
      <button
        type="button"
        onClick={onSync}
        disabled={syncBusy}
        className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-xl px-1 text-left disabled:opacity-55"
      >
        <RefreshCw className={`h-4 w-4 shrink-0 ${syncBusy ? "animate-spin" : ""}`} strokeWidth={STROKE} />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium">Nolasīt tagad</span>
          <span className="block text-[12px] text-[var(--slud-ink2)]">bezmaksas avoti</span>
        </span>
        {progress ? <span className="tabular-nums text-[13px] text-[var(--slud-ink2)]">{progress}</span> : null}
      </button>
      <button type="button" onClick={onSourceStatus} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-1 text-left">
        <Activity className="h-4 w-4 shrink-0" strokeWidth={STROKE} />
        <span className="min-w-0 flex-1 text-[15px] font-medium">Avotu statuss</span>
        {problemCount > 0 ? (
          <span className="slud-badge inline-flex h-5 items-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums">
            {problemCount} kļūdas
          </span>
        ) : null}
      </button>
      <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.045em] text-[var(--slud-ink3,var(--iriss-ink-3))]">Aprēķins</p>
      <button type="button" onClick={onCosts} className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-xl px-1 text-left">
        <Calculator className="h-4 w-4 shrink-0" strokeWidth={STROKE} />
        <span className="min-w-0 flex-1 text-[15px] font-medium">Izmaksu pieņēmumi</span>
        <span className="shrink-0 text-[13px] tabular-nums text-[var(--slud-ink2)]">{extrasLabel} / auto</span>
      </button>
      {onReset ? (
        <>
          <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.045em] text-[var(--slud-ink3,var(--iriss-ink-3))]">Saraksts</p>
          <button type="button" onClick={onReset} className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-xl px-1 text-left text-[var(--iriss-bad)]">
            <Trash2 className="h-4 w-4 shrink-0" strokeWidth={STROKE} />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium">Notīrīt ielasītos sludinājumus</span>
              <span className="block text-[12px] text-[var(--slud-ink2)]">pasūtījumi un saites paliek; ielasās no jauna pēc saitēm</span>
            </span>
          </button>
        </>
      ) : null}
    </div>
  );
}
