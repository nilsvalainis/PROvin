"use client";

import { Plus, Trash2 } from "lucide-react";
import { useCallback } from "react";

const labelClass = "text-[8px] font-semibold uppercase tracking-[0.06em] text-[var(--color-provin-muted)]";
const inputClass =
  "min-h-[34px] w-full rounded-md border border-slate-200/90 bg-white px-2 py-1 text-[11px] text-[var(--color-apple-text)] shadow-sm outline-none placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

export type AuctionVendorLinksValues = {
  mobile: string;
  autobid: string;
  openline: string;
  auto1: string;
  citi: string[];
};

type Props = {
  values: AuctionVendorLinksValues;
  onChange: (next: AuctionVendorLinksValues) => void;
};

const MAX_CITI = 12;

export function AdminAuctionVendorLinksBlock({ values, onChange }: Props) {
  const patch = useCallback((p: Partial<AuctionVendorLinksValues>) => {
    onChange({ ...values, ...p });
  }, [onChange, values]);

  const setCitiRow = useCallback(
    (index: number, v: string) => {
      const next = [...values.citi];
      next[index] = v;
      onChange({ ...values, citi: next });
    },
    [onChange, values],
  );

  const addCitiRow = useCallback(() => {
    if (values.citi.length >= MAX_CITI) return;
    onChange({ ...values, citi: [...values.citi, ""] });
  }, [onChange, values]);

  const removeCitiRow = useCallback(
    (index: number) => {
      if (values.citi.length <= 1) return;
      onChange({ ...values, citi: values.citi.filter((_, i) => i !== index) });
    },
    [onChange, values],
  );

  return (
    <div className="mt-2 space-y-1.5 border-t border-slate-200/80 pt-2">
      <p className={labelClass}>Sludinājumu platformas (saites)</p>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        <label className="block min-w-0">
          <span className={labelClass}>Mobile</span>
          <input
            type="url"
            inputMode="url"
            className={inputClass}
            value={values.mobile}
            onChange={(e) => patch({ mobile: e.target.value })}
            placeholder="https://…"
            autoComplete="off"
          />
        </label>
        <label className="block min-w-0">
          <span className={labelClass}>Autobid</span>
          <input
            type="url"
            inputMode="url"
            className={inputClass}
            value={values.autobid}
            onChange={(e) => patch({ autobid: e.target.value })}
            placeholder="https://…"
            autoComplete="off"
          />
        </label>
        <label className="block min-w-0">
          <span className={labelClass}>Openline</span>
          <input
            type="url"
            inputMode="url"
            className={inputClass}
            value={values.openline}
            onChange={(e) => patch({ openline: e.target.value })}
            placeholder="https://…"
            autoComplete="off"
          />
        </label>
        <label className="block min-w-0">
          <span className={labelClass}>Auto1</span>
          <input
            type="url"
            inputMode="url"
            className={inputClass}
            value={values.auto1}
            onChange={(e) => patch({ auto1: e.target.value })}
            placeholder="https://…"
            autoComplete="off"
          />
        </label>
      </div>
      <div className="space-y-1">
        {values.citi.map((row, i) => (
          <div key={`citi-${i}`} className="flex min-w-0 items-end gap-1">
            <label className="min-w-0 flex-1">
              <span className={labelClass}>{i === 0 ? "Citi" : `Citi (${i + 1})`}</span>
              <input
                type="url"
                inputMode="url"
                className={inputClass}
                value={row}
                onChange={(e) => setCitiRow(i, e.target.value)}
                placeholder="https://…"
                autoComplete="off"
              />
            </label>
            {values.citi.length > 1 ? (
              <button
                type="button"
                onClick={() => removeCitiRow(i)}
                className="mb-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200/90 text-slate-600 shadow-sm transition hover:bg-red-50 hover:text-red-700"
                aria-label={`Noņemt Citi rindu ${i + 1}`}
                title="Noņemt rindu"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
              </button>
            ) : (
              <span className="w-8 shrink-0" aria-hidden />
            )}
          </div>
        ))}
        <button
          type="button"
          disabled={values.citi.length >= MAX_CITI}
          onClick={addCitiRow}
          className="inline-flex h-8 w-full max-w-[10rem] items-center justify-center gap-1 rounded-md border border-dashed border-emerald-600/40 bg-emerald-50/50 text-[10px] font-semibold text-emerald-900 transition hover:bg-emerald-100/80 disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
          Citi rinda
        </button>
      </div>
    </div>
  );
}
