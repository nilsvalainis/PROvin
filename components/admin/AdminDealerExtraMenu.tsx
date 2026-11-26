"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatDealerExtraCount,
  type DealerExtraAvailability,
  type DealerExtraKey,
} from "@/lib/dealer-pdf-extra";

/**
 * Dīlera PDF «+ Extra (N)» (Nils 26.11): bezmaksas avotu sadaļas dīlera PDF beigās.
 * Izvēle dzīvo tikai lapas stāvoklī - pasūtījumā netiek saglabāta. Sarakstā tikai sadaļas ar datiem.
 */

export function dealerExtraSelectedLabel(n: number): string {
  return n === 1 ? "1 izvēlēta" : `${n} izvēlētas`;
}

export function DealerExtraList({
  items,
  selected,
  onToggle,
  size = "desktop",
}: {
  items: DealerExtraAvailability[];
  selected: readonly DealerExtraKey[];
  onToggle: (key: DealerExtraKey, on: boolean) => void;
  size?: "desktop" | "touch";
}) {
  if (items.length === 0) {
    return <p className="px-3 py-2 text-[12px] font-medium text-[#b42318]">Nav datu</p>;
  }
  const row =
    size === "touch"
      ? "flex min-h-11 w-full cursor-pointer select-none items-center gap-3 px-3 text-[15px] font-medium text-[var(--color-apple-text)]"
      : "flex w-full cursor-pointer select-none items-center gap-2.5 px-3 py-1.5 text-[12px] font-medium text-[var(--color-apple-text)] hover:bg-black/[0.03]";
  return (
    <div role="group" aria-label="Extra sadaļas">
      {items.map((it) => {
        const on = selected.includes(it.key);
        return (
          <label key={it.key} className={row} data-dealer-extra-opt={it.key}>
            <input
              type="checkbox"
              className="h-4 w-4 shrink-0 rounded border-slate-300 text-[var(--color-provin-accent)]"
              checked={on}
              onChange={(e) => onToggle(it.key, e.target.checked)}
            />
            <span className="min-w-0 flex-1 truncate">{it.label}</span>
            {it.count > 0 ? (
              <span className="shrink-0 text-[11px] font-semibold tabular-nums text-[var(--color-provin-accent)]">
                {formatDealerExtraCount(it.count)}
              </span>
            ) : null}
          </label>
        );
      })}
    </div>
  );
}

export function AdminDealerExtraMenu({
  getItems,
  selected,
  onChange,
  toneClass,
  disabled = false,
}: {
  /** Aprēķina tikai atverot (ne katrā renderā). */
  getItems: (selected: readonly DealerExtraKey[]) => DealerExtraAvailability[];
  selected: readonly DealerExtraKey[];
  onChange: (next: DealerExtraKey[]) => void;
  toneClass: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const getItemsRef = useRef(getItems);
  getItemsRef.current = getItems;
  const items = useMemo(() => (open ? getItemsRef.current(selected) : []), [open, selected]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
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

  const toggle = (key: DealerExtraKey, on: boolean) => {
    const set = new Set(selected);
    if (on) set.add(key);
    else set.delete(key);
    onChange([...set]);
  };

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        data-dealer-extra-button
        aria-haspopup="true"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold tracking-tight disabled:opacity-40 ${toneClass}`}
      >
        + Extra
        {selected.length > 0 ? (
          <span className="rounded-full bg-[var(--color-provin-accent)] px-1.5 text-[10px] font-bold leading-[16px] text-white tabular-nums">
            {selected.length}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Extra sadaļas"
          className="absolute bottom-[calc(100%+8px)] right-0 z-50 w-[300px] rounded-xl border border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)] py-2 shadow-[0_12px_32px_rgba(15,23,42,0.16)]"
        >
          <div className="flex items-baseline justify-between px-3 pb-1.5">
            <span className="text-[12px] font-semibold text-[var(--color-apple-text)]">Extra sadaļas</span>
            <span className="text-[11px] font-medium text-[var(--color-provin-muted)]">
              {dealerExtraSelectedLabel(selected.length)}
            </span>
          </div>
          <DealerExtraList items={items} selected={selected} onToggle={toggle} />
          <div className="mt-1.5 flex justify-end gap-2 border-t border-[var(--admin-border-subtle)] px-3 pt-2">
            <button
              type="button"
              className="h-7 rounded-lg px-2.5 text-[11px] font-semibold text-[var(--color-provin-muted)] hover:bg-black/[0.04] disabled:opacity-45"
              disabled={selected.length === 0}
              onClick={() => onChange([])}
            >
              Notīrīt
            </button>
            <button
              type="button"
              className="h-7 rounded-lg bg-[#1d1d1f] px-3 text-[11px] font-semibold text-white"
              onClick={() => setOpen(false)}
            >
              Gatavs
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
