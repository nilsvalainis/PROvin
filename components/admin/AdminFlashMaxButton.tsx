"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import {
  FLASH_MAX_JOBS,
  FLASH_MAX_OPERATOR_NOTES_MAX_LEN,
  clipFlashMaxOperatorNotes,
  defaultFlashMaxSelection,
  emptyFlashMaxSelection,
  summaryOnlyFlashMaxSelection,
  type FlashMaxJob,
  type FlashMaxSelection,
} from "@/lib/admin-flash-max";
import { AI_ADMIN_TIER_BUTTON_ORDER } from "@/lib/ai-admin-field-defaults";
import { aiAdminModelTierLabel, type AiAdminModelTier } from "@/lib/ai-admin-model-tier";

type Props = {
  disabled?: boolean;
  busy?: boolean;
  phase?: string | null;
  notice?: string | null;
  error?: string | null;
  onRun: (selection: FlashMaxSelection) => void;
};

const SHORT_TIER: Record<AiAdminModelTier, string> = {
  "gemini-flash": "Flash",
  gemini: "Gemini",
  flash: "Sonnet",
  pro: "Opus",
  lite: "Haiku",
};

const chip =
  "rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40";

function JobRow({
  job,
  checked,
  tier,
  disabled,
  onToggle,
  onTier,
}: {
  job: FlashMaxJob;
  checked: boolean;
  tier: AiAdminModelTier;
  disabled: boolean;
  onToggle: (id: string, next: boolean) => void;
  onTier: (id: string, next: AiAdminModelTier) => void;
}) {
  const boxId = useId();
  return (
    <label
      htmlFor={boxId}
      className={`flex min-w-0 items-center gap-1.5 rounded px-0.5 py-0.5 ${checked ? "" : "opacity-70"}`}
    >
      <input
        id={boxId}
        type="checkbox"
        className="h-3 w-3 shrink-0 rounded border-slate-300 text-teal-600 focus:ring-teal-600/30"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onToggle(job.id, e.target.checked)}
      />
      <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-[var(--color-apple-text)]">
        {job.label}
      </span>
      <select
        aria-label={`${job.label} aģents`}
        disabled={disabled}
        value={tier}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onTier(job.id, e.target.value as AiAdminModelTier)}
        className="h-5 max-w-[6.75rem] shrink-0 rounded border border-slate-200 bg-white px-0.5 text-[9px] font-semibold text-slate-700 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25"
      >
        {AI_ADMIN_TIER_BUTTON_ORDER.map((opt) => (
          <option key={opt} value={opt}>
            {SHORT_TIER[opt]}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AdminFlashMaxButton({ disabled, busy, phase, notice, error, onRun }: Props) {
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<FlashMaxSelection>(defaultFlashMaxSelection);
  const [operatorNotes, setOperatorNotes] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const selectedCount = selection.selectedIds.length;
  const dailyJobs = useMemo(() => FLASH_MAX_JOBS.filter((j) => j.group === "daily"), []);
  const extraJobs = useMemo(() => FLASH_MAX_JOBS.filter((j) => j.group === "extra"), []);

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

  const toggle = (id: string, next: boolean) => {
    setSelection((prev) => ({
      ...prev,
      selectedIds: next ? [...new Set([...prev.selectedIds, id])] : prev.selectedIds.filter((x) => x !== id),
    }));
  };

  const setTier = (id: string, next: AiAdminModelTier) => {
    setSelection((prev) => ({ ...prev, tiers: { ...prev.tiers, [id]: next } }));
  };

  const confirm = () => {
    if (busy || selectedCount === 0) return;
    setOpen(false);
    onRun({
      ...selection,
      operatorNotes: clipFlashMaxOperatorNotes(operatorNotes),
    });
  };

  return (
    <div className="relative min-w-0 flex-1 basis-0" ref={rootRef}>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex h-8 w-full min-w-0 items-center justify-center gap-1 overflow-hidden rounded-lg border border-teal-700/40 bg-teal-600 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-45"
        title="Atver izvēli: kuras sadaļas, ar kuriem aģentiem un kādu komandu ģenerēt. Noklusējums paliek esošie Flash Max lauki."
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
        )}
        FLASH MAX
      </button>
      {open ? (
        <div
          role="dialog"
          aria-labelledby={titleId}
          className="absolute left-0 top-full z-50 mt-1 w-[min(24rem,calc(100vw-1.5rem))] rounded-xl border border-slate-200 bg-white p-2.5 shadow-[0_12px_40px_rgba(15,23,42,0.14)]"
        >
          <div className="mb-1.5 flex flex-wrap items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p id={titleId} className="text-[11px] font-semibold text-[var(--color-apple-text)]">
                FLASH MAX
              </p>
              <p className="text-[9px] leading-snug text-slate-500">
                Izvēlies sadaļas, ieraksti komandu, tad apstiprini. Aģenti pēc noklusējuma — kā ✨ pogās.
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              <button type="button" className={chip} disabled={busy} onClick={() => setSelection(defaultFlashMaxSelection())}>
                Noklusējumi
              </button>
              <button type="button" className={chip} disabled={busy} onClick={() => setSelection(emptyFlashMaxSelection())}>
                Notīrīt
              </button>
              <button
                type="button"
                className={chip}
                disabled={busy}
                onClick={() => setSelection(summaryOnlyFlashMaxSelection())}
              >
                Tikai kopsavilkums
              </button>
            </div>
          </div>
          <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
            Ikdienas sadaļas
          </p>
          <div className="max-h-[40vh] space-y-0.5 overflow-y-auto pr-0.5">
            {dailyJobs.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                checked={selection.selectedIds.includes(job.id)}
                tier={selection.tiers[job.id] ?? "gemini-flash"}
                disabled={!!busy}
                onToggle={toggle}
                onTier={setTier}
              />
            ))}
            <p className="pt-1.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
              Citas sadaļas
            </p>
            <p className="pb-0.5 text-[9px] leading-snug text-slate-400">
              Parasti nav Flash Max — ieķeksē, kad vajag arī šos logus.
            </p>
            {extraJobs.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                checked={selection.selectedIds.includes(job.id)}
                tier={selection.tiers[job.id] ?? "gemini-flash"}
                disabled={!!busy}
                onToggle={toggle}
                onTier={setTier}
              />
            ))}
          </div>
          <label className="mt-2 block border-t border-slate-100 pt-2">
            <span className="mb-0.5 block text-[9px] font-semibold uppercase tracking-wide text-slate-400">
              Papildu piezīmes / komanda
            </span>
            <span className="mb-1 block text-[9px] leading-snug text-slate-500">
              Iet visiem izvēlētajiem aģentiem. Apstrādā katru tēmu; ja saki „tikai par…”, pārējais netiek
              papildināts. Jauns fakts — labo visus tekstus pēc tā.
            </span>
            <textarea
              className="min-h-[4.5rem] w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] leading-snug text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25"
              placeholder="Piem., jauns AutoDNA: 12.03.2019 Vācijā 18 400 €; labo visus komentārus pēc šiem faktiem…"
              value={operatorNotes}
              disabled={busy}
              maxLength={FLASH_MAX_OPERATOR_NOTES_MAX_LEN}
              onChange={(e) => setOperatorNotes(e.target.value.slice(0, FLASH_MAX_OPERATOR_NOTES_MAX_LEN))}
              aria-label="Papildu piezīmes FLASH MAX ģenerēšanai"
            />
          </label>
          <div className="mt-2 flex items-center justify-end gap-1.5 border-t border-slate-100 pt-2">
            <button type="button" className={chip} disabled={busy} onClick={() => setOpen(false)}>
              Atcelt
            </button>
            <button
              type="button"
              disabled={busy || selectedCount === 0}
              onClick={confirm}
              className="inline-flex h-7 items-center rounded-lg bg-teal-600 px-2.5 text-[10px] font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-45"
              title={AI_ADMIN_TIER_BUTTON_ORDER.map((t) => `${SHORT_TIER[t]} = ${aiAdminModelTierLabel(t)}`).join(" · ")}
            >
              Ģenerēt {selectedCount}
            </button>
          </div>
        </div>
      ) : null}
      {phase ? (
        <p className="mt-1 max-w-[18rem] text-[10px] leading-snug text-teal-800" role="status">
          {phase}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-1 max-w-[22rem] text-[10px] leading-snug text-emerald-800/90" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="mt-1 max-w-[22rem] text-[10px] leading-snug text-amber-800/90" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
