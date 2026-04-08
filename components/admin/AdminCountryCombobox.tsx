"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const COUNTRY_OPTIONS = [
  "Latvija",
  "Vācija",
  "Beļģija",
  "Francija",
  "Dānija",
  "Nīderlande",
  "Igaunija",
  "Lietuva",
  "Spānija",
  "Itālija",
  "Somija",
  "Zviedrija",
  "Polija",
  "Austrija",
  "ASV",
] as const;

type Props = {
  value: string;
  onChange: (next: string) => void;
  className: string;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  name?: string;
  "aria-label"?: string;
  "data-provin-field"?: string;
  "data-provin-block"?: string;
  "data-row-index"?: number;
};

export function AdminCountryCombobox(props: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const {
    value,
    onChange,
    className,
    disabled,
    placeholder,
    id,
    name,
    "aria-label": ariaLabel,
    "data-provin-field": dataProvinField,
    "data-provin-block": dataProvinBlock,
    "data-row-index": dataRowIndex,
  } = props;

  useEffect(() => {
    if (!open) return;
    const onDocDown = (ev: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open]);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return COUNTRY_OPTIONS;
    return COUNTRY_OPTIONS.filter((c) => c.toLowerCase().includes(q));
  }, [value]);

  return (
    <div ref={rootRef} className="relative">
      <input
        type="text"
        className={className}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        id={id}
        name={name}
        aria-label={ariaLabel}
        data-provin-field={dataProvinField}
        data-provin-block={dataProvinBlock}
        data-row-index={dataRowIndex}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          if (!open) setOpen(true);
        }}
      />
      {open && !disabled ? (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-44 overflow-auto rounded-md border border-slate-200/80 bg-white/90 p-1 shadow-[0_10px_26px_rgba(15,23,42,0.12)] backdrop-blur-sm">
          {filtered.length > 0 ? (
            filtered.map((country) => (
              <button
                key={country}
                type="button"
                className="block w-full rounded px-2 py-1 text-left text-[11px] text-slate-700 hover:bg-[var(--color-provin-accent-soft)]"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(country);
                  setOpen(false);
                }}
              >
                {country}
              </button>
            ))
          ) : (
            <p className="px-2 py-1 text-[11px] text-slate-500">Nav sarakstā — vari ievadīt manuāli.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
