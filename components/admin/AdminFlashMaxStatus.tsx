"use client";

import { useEffect, useRef } from "react";
import { ChevronDown, Loader2, X } from "lucide-react";

import type { FlashMaxStatusSummary } from "@/lib/admin-flash-max";

/**
 * FLASH MAX statuss rīkjoslā - viena rinda (čipa), kas nemaina rīkjoslas augstumu (Nils 27.11: garš
 * teksts zem pogas izstiepa rīkjoslu un saspieda avotu sadaļas). Detaļas - atsevišķs panelis zem rīkjoslas.
 */

const TONE_CHIP: Record<FlashMaxStatusSummary["tone"], string> = {
  busy: "border-teal-200 bg-teal-50 text-teal-900",
  ok: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warn: "border-amber-300 bg-amber-50 text-amber-900",
  error: "border-red-300 bg-red-50 text-red-800",
};

export function AdminFlashMaxStatusChip({
  status,
  open,
  onToggle,
  controlsId,
}: {
  status: FlashMaxStatusSummary;
  open: boolean;
  onToggle: () => void;
  controlsId: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controlsId}
      data-flash-max-status={status.tone}
      title={status.chip}
      className={`inline-flex h-7 min-w-0 max-w-[15rem] shrink items-center gap-1 rounded-lg border px-2 text-[10px] font-semibold transition hover:brightness-95 ${TONE_CHIP[status.tone]}`}
    >
      {status.tone === "busy" ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden /> : null}
      <span className="min-w-0 truncate">{status.chip}</span>
      <ChevronDown className={`h-3 w-3 shrink-0 transition ${open ? "rotate-180" : ""}`} aria-hidden />
    </button>
  );
}

/** Detaļu panelis: novietots absolūti zem rīkjoslas pilnā platumā, tāpēc lapas izkārtojumu nebīda. */
export function AdminFlashMaxStatusDetails({
  id,
  status,
  onClose,
  onOpenReview,
}: {
  id: string;
  status: FlashMaxStatusSummary;
  onClose: () => void;
  onOpenReview?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || ref.current?.contains(t) || t.closest("[data-flash-max-status]")) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDoc);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      id={id}
      role="region"
      aria-label="FLASH MAX rezultāts"
      className="absolute inset-x-0 top-full z-40 mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] leading-snug text-slate-700 shadow-[0_12px_40px_rgba(15,23,42,0.14)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 font-semibold text-[var(--color-apple-text)]">
          {status.tone === "busy"
            ? status.chip
            : `Sagatavoti ${status.okCount}${status.skipped.length ? `, izlaisti ${status.skipped.length}` : ""}${
                status.failed.length ? `, kļūdas ${status.failed.length}` : ""
              }`}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Aizvērt"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      {status.failed.length ? (
        <ul className="mt-1 space-y-0.5">
          {status.failed.map((f) => (
            <li key={f.id} className="font-medium text-red-700 dark:text-red-300">
              {f.label}: {f.detail ?? "kļūda"}
            </li>
          ))}
        </ul>
      ) : null}
      {status.skipped.length ? (
        <p className="mt-1 text-slate-500">
          Izlaisti: {status.skipped.map((s) => (s.detail ? `${s.label} (${s.detail})` : s.label)).join(", ")}
        </p>
      ) : null}
      {status.reviewLine ? (
        <p className="mt-1 flex flex-wrap items-center gap-x-2">
          <span className={status.reviewPending > 0 ? "text-amber-800 dark:text-amber-200" : ""}>{status.reviewLine}</span>
          {status.reviewPending > 0 && onOpenReview ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenReview();
              }}
              className="font-semibold text-[var(--color-provin-accent)] underline underline-offset-2"
            >
              pārskatīt
            </button>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
