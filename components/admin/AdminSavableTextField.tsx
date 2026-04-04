"use client";

import { useEffect, useRef, useState } from "react";

const toolbarBtn =
  "rounded-md border border-slate-200/90 bg-white px-2 py-1 text-[11px] font-semibold tracking-tight text-[var(--color-apple-text)] shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40";

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

  const fieldClass = [
    "w-full rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 text-sm leading-relaxed text-[var(--color-apple-text)]",
    "focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-provin-accent)]/20",
    mono ? "font-mono" : "",
    multiline ? minHeightClass : "",
  ]
    .filter(Boolean)
    .join(" ");

  const viewBoxClass = `${fieldClass} ${minHeightClass} whitespace-pre-wrap`;

  return (
    <div>
      {hideToolbar ? (
        label ? (
          <label className="mb-1 block text-xs font-medium text-[var(--color-provin-muted)]" htmlFor={viewMode ? undefined : id}>
            {label}
          </label>
        ) : null
      ) : (
        <div
          className={`mb-1 flex flex-wrap items-center gap-2 ${label ? "justify-between" : "justify-end"}`}
        >
          {label ? (
            <label className="text-xs font-medium text-[var(--color-provin-muted)]" htmlFor={viewMode ? undefined : id}>
              {label}
            </label>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-1">
            {flash ? (
              <span className="text-[11px] font-semibold text-emerald-700" role="status">
                Saglabāts
              </span>
            ) : null}
            <button type="button" className={toolbarBtn} onClick={save} disabled={disabled}>
              Saglabāt
            </button>
            <button type="button" className={toolbarBtn} onClick={labot} disabled={disabled}>
              Labot
            </button>
          </div>
        </div>
      )}
      {viewMode ? (
        <div
          className={viewBoxClass}
          id={viewMode ? `${id}-view` : undefined}
          aria-readonly
        >
          {value.trim() ? value : <span className="text-slate-400">—</span>}
        </div>
      ) : multiline ? (
        <textarea
          id={id}
          className={`${fieldClass} resize-y ${textareaExtraClass}`.trim()}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          spellCheck
          disabled={disabled}
        />
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
