"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import {
  AdminFlashMaxPanel,
  FLASH_MAX_TIER_LEGEND,
  flashMaxDraftToSelection,
  flashMaxRunnableCount,
  useFlashMaxDraft,
} from "@/components/admin/AdminFlashMaxPanel";
import type { FlashMaxSelection } from "@/lib/admin-flash-max";
import type { WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";

type Props = {
  disabled?: boolean;
  busy?: boolean;
  onRun: (selection: FlashMaxSelection) => void;
  /** Sticky joslai: izvēlne atveras pa kreisi. */
  menuAlign?: "start" | "end";
  compact?: boolean;
  /** PRO pasūtījuma labā josla — zibens ikona, bez fona. */
  rail?: boolean;
  sourceBlocks?: WorkspaceSourceBlocks | null;
};

function RailFlashLightningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M13 2L4 14h7l-1 8 10-14h-7V2z"
        fill="#fbbf24"
        stroke="#d97706"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const chip =
  "rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40";

export function AdminFlashMaxButton({
  disabled,
  busy,
  onRun,
  menuAlign = "start",
  compact,
  rail,
  sourceBlocks,
}: Props) {
  const [open, setOpen] = useState(false);
  const draft = useFlashMaxDraft();
  const rootRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // Datu pārbaude tikai atvērtam logam (poga ir lapā vienmēr; nobraukuma un avotu savākšana nav lēta).
  const selectedCount = open ? flashMaxRunnableCount(draft, sourceBlocks) : 0;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const confirm = () => {
    if (busy || selectedCount === 0) return;
    setOpen(false);
    onRun(flashMaxDraftToSelection(draft, sourceBlocks));
  };

  return (
    <div className="relative min-w-0" ref={rootRef}>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={
          rail
            ? "inline-flex h-7 w-7 shrink-0 items-center justify-center border-0 bg-transparent p-0 transition disabled:cursor-not-allowed disabled:opacity-35"
            : compact
              ? "inline-flex h-7 w-full shrink-0 items-center justify-center gap-0.5 rounded-md border border-teal-700/40 bg-teal-600/90 px-1 text-[9px] font-semibold text-white shadow-sm transition hover:bg-teal-600 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
              : "inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-teal-700/40 bg-teal-600 px-2 text-[10px] font-semibold text-white shadow-sm transition hover:bg-teal-700 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
        }
        title="Atver izvēli: kuras sadaļas, ar kuriem aģentiem un kādu komandu ģenerēt. Noklusējums paliek esošie Flash Max lauki."
      >
        {busy ? (
          <Loader2 className={`${rail ? "h-5 w-5" : "h-3.5 w-3.5"} shrink-0 animate-spin text-slate-600`} aria-hidden />
        ) : rail ? (
          <RailFlashLightningIcon className="block h-5 w-5 max-h-5 max-w-5" />
        ) : (
          <Sparkles className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
        )}
        {compact && !rail ? "MAX" : null}
        {!compact && !rail ? "FLASH MAX" : null}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-labelledby={titleId}
          className={`absolute top-full z-50 mt-1 w-[min(28rem,calc(100vw-1.5rem))] rounded-xl border border-slate-200 bg-white p-2.5 shadow-[0_12px_40px_rgba(15,23,42,0.14)] ${
            menuAlign === "end" ? "right-0" : "left-0"
          }`}
        >
          <p id={titleId} className="mb-1 text-[11px] font-semibold text-[var(--color-apple-text)]">
            FLASH MAX
          </p>
          <AdminFlashMaxPanel draft={draft} sourceBlocks={sourceBlocks} busy={busy} />
          <div className="mt-2 flex items-center justify-end gap-1.5 border-t border-slate-100 pt-2">
            <button type="button" className={chip} disabled={busy} onClick={() => setOpen(false)}>
              Atcelt
            </button>
            <button
              type="button"
              disabled={busy || selectedCount === 0}
              onClick={confirm}
              className="inline-flex h-7 items-center rounded-lg bg-teal-600 px-2.5 text-[10px] font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-45"
              title={FLASH_MAX_TIER_LEGEND}
            >
              Ģenerēt {selectedCount}
            </button>
          </div>
        </div>
      ) : null}
      {/* Statuss (fāze, rezultāts, kļūdas) vairs netiek rādīts zem pogas - tas izstiepa rīkjoslu (Nils 27.11).
          Rīkjoslā to rāda kompakta čipa AdminFlashMaxStatusChip. */}
    </div>
  );
}
