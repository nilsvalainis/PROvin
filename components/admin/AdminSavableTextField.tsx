"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { AdminAiPolishTextareaShell } from "@/components/admin/AdminAiPolishTextareaShell";

const toolbarBtn =
  "rounded-md border border-slate-200/90 bg-white px-2 py-1 text-[11px] font-semibold tracking-tight text-[var(--color-apple-text)] shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40";

const toolbarBtnCompact =
  "rounded-md border border-slate-200/90 bg-white px-1.5 py-0.5 text-[10px] font-semibold tracking-tight text-[var(--color-apple-text)] shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40";

export type AdminSavableTextFieldProps = {
  id: string;
  /** Ja nav — rāda tikai pogas (piem., zem sadaļas virsraksta) */
  label?: string;
  value: string;
  onChange: (next: string) => void;
  /** Pēc apstiprināta saglabājuma (piem., papildu flush) */
  onAfterSave?: () => void;
  multiline?: boolean;
  minHeightClass?: string;
  placeholder?: string;
  mono?: boolean;
  disabled?: boolean;
  inputType?: "text" | "url";
  /** Kad mainās pasūtījums / hidrācija — atiestata iekšējo „pēdējo saglabāto” punktu */
  resetVersion?: number | string;
  /** Papildu klases textarea (piem. max augstums, resize). */
  textareaExtraClass?: string;
  /** Ja true — bez Saglabāt/Labot (vadība ārpus komponenta). */
  hideToolbar?: boolean;
  /** Kompakts izmērs — saskaņots ar CSDD / LTAB admin laukiem (11px, šauri apmale). */
  compact?: boolean;
  /** Viendimensiju laukam: elements labajā pusē ievades rindā (piem., Copy). */
  endAdornment?: ReactNode;
};

export function AdminSavableTextField({
  id,
  label,
  value,
  onChange,
  onAfterSave,
  multiline,
  minHeightClass = "min-h-[88px]",
  placeholder,
  mono,
  disabled,
  inputType = "text",
  resetVersion,
  textareaExtraClass = "",
  hideToolbar = false,
  compact = false,
  endAdornment,
}: AdminSavableTextFieldProps) {
  const [viewMode, setViewMode] = useState(false);
  const [flash, setFlash] = useState(false);
  const snapshotRef = useRef(value);

  useEffect(() => {
    snapshotRef.current = value;
    setViewMode(false);
  }, [resetVersion]); // eslint-disable-line react-hooks/exhaustive-deps -- snapshot atiestatās tikai pie resetVersion; value šajā brīdī ir aktuālais no render

  const save = () => {
    if (disabled) return;
    snapshotRef.current = value;
    onAfterSave?.();
    setViewMode(true);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 2000);
  };

  const labot = () => {
    if (disabled) return;
    if (viewMode) {
      setViewMode(false);
    } else {
      onChange(snapshotRef.current);
    }
  };

  const fieldClass = compact
    ? [
        "w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] leading-snug text-[var(--color-apple-text)]",
        "placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25",
        mono ? "font-mono" : "",
        multiline ? minHeightClass : "",
      ]
        .filter(Boolean)
        .join(" ")
    : [
        "w-full rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 text-sm leading-relaxed text-[var(--color-apple-text)]",
        "focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-provin-accent)]/20",
        mono ? "font-mono" : "",
        multiline ? minHeightClass : "",
      ]
        .filter(Boolean)
        .join(" ");

  const viewMinH = compact && !multiline ? "min-h-[28px]" : minHeightClass;
  const viewBoxClass = `${fieldClass} ${viewMinH} whitespace-pre-wrap`;

  const labelClass = compact
    ? "text-[10px] font-medium text-[var(--color-provin-muted)]"
    : "text-xs font-medium text-[var(--color-provin-muted)]";

  const btnClass = compact ? toolbarBtnCompact : toolbarBtn;
  const toolbarGap = compact ? "gap-1" : "gap-2";
  const labelRowMb = compact ? "mb-0.5" : "mb-1";

  const flexRowWithAdornment = Boolean(endAdornment && !multiline);
  const fieldClassSized = flexRowWithAdornment
    ? fieldClass.replace(/\bw-full\b/, "flex-1 min-w-0")
    : fieldClass;
  const viewBoxClassSized = flexRowWithAdornment
    ? `${fieldClassSized} ${viewMinH} whitespace-pre-wrap`
    : viewBoxClass;

  return (
    <div>
      {hideToolbar ? (
        label ? (
          <label className={`${labelRowMb} block ${labelClass}`} htmlFor={viewMode ? undefined : id}>
            {label}
          </label>
        ) : null
      ) : (
        <div
          className={`${labelRowMb} flex flex-wrap items-center ${toolbarGap} ${label ? "justify-between" : "justify-end"}`}
        >
          {label ? (
            <label className={labelClass} htmlFor={viewMode ? undefined : id}>
              {label}
            </label>
          ) : null}
          <div className={`flex flex-wrap items-center justify-end ${compact ? "gap-0.5" : "gap-1"}`}>
            {flash ? (
              <span
                className={`font-semibold text-emerald-700 ${compact ? "text-[10px]" : "text-[11px]"}`}
                role="status"
              >
                Saglabāts
              </span>
            ) : null}
            <button type="button" className={btnClass} onClick={save} disabled={disabled}>
              Saglabāt
            </button>
            <button type="button" className={btnClass} onClick={labot} disabled={disabled}>
              Labot
            </button>
          </div>
        </div>
      )}
      {viewMode ? (
        flexRowWithAdornment ? (
          <div className="flex min-w-0 items-center gap-1">
            <div
              className={viewBoxClassSized}
              id={`${id}-view`}
              aria-readonly
            >
              {value.trim() ? value : <span className="text-slate-400">—</span>}
            </div>
            {endAdornment}
          </div>
        ) : (
          <div
            className={viewBoxClass}
            id={`${id}-view`}
            aria-readonly
          >
            {value.trim() ? value : <span className="text-slate-400">—</span>}
          </div>
        )
      ) : multiline ? (
        <AdminAiPolishTextareaShell value={value} onPolished={onChange} disabled={disabled}>
          <textarea
            id={id}
            className={`${fieldClass} resize-y ${textareaExtraClass}`.trim()}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            spellCheck
            disabled={disabled}
          />
        </AdminAiPolishTextareaShell>
      ) : flexRowWithAdornment ? (
        <div className="flex min-w-0 items-center gap-1">
          <input
            id={id}
            type={inputType}
            className={fieldClassSized}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            disabled={disabled}
          />
          {endAdornment}
        </div>
      ) : (
        <input
          id={id}
          type={inputType}
          className={fieldClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          disabled={disabled}
        />
      )}
    </div>
  );
}
