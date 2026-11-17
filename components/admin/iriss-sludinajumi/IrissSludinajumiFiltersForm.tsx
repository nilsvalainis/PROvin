"use client";

import type { ReactNode } from "react";
import { LISTING_SOURCE_CHIPS } from "@/lib/iriss-listings-list-view";
import type { IrissListingPlatform } from "@/lib/iriss-listings-types";

export function IrissSludinajumiFiltersForm({
  sources,
  onToggleSource,
  minKey,
  maxKey,
  minDefault,
  maxDefault,
  onMin,
  onMax,
  hideTech,
  onHideTech,
  techCount,
  hideOverBudget,
  onHideOverBudget,
  overBudgetThreshold,
  onThreshold,
  overBudgetCount,
  onlyHidden,
  onOnlyHidden,
  hiddenCount,
  resultCount,
  onApply,
  extra,
}: {
  sources: readonly IrissListingPlatform[];
  onToggleSource: (id: IrissListingPlatform) => void;
  minKey: string;
  maxKey: string;
  minDefault: string;
  maxDefault: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
  hideTech: boolean;
  onHideTech: (v: boolean) => void;
  techCount: number;
  hideOverBudget: boolean;
  onHideOverBudget: (v: boolean) => void;
  overBudgetThreshold: number;
  onThreshold: (v: number) => void;
  overBudgetCount: number;
  onlyHidden: boolean;
  onOnlyHidden: (v: boolean) => void;
  hiddenCount: number;
  resultCount: number;
  onApply: () => void;
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      {extra}
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.045em] text-[var(--slud-ink3,var(--iriss-ink-3))]">Avoti</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {LISTING_SOURCE_CHIPS.map((src) => {
            const on = sources.length === 0 || sources.includes(src.id);
            return (
              <button
                key={src.id}
                type="button"
                aria-pressed={on}
                onClick={() => onToggleSource(src.id)}
                className="slud-chip inline-flex h-8 items-center rounded-full bg-[var(--slud-fill,rgba(116,120,138,.11))] px-3 text-[13px] font-medium text-[var(--slud-ink,var(--iriss-ink))]"
                data-on={on ? "true" : "false"}
              >
                {src.label}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.045em] text-[var(--slud-ink3,var(--iriss-ink-3))]">Cena, €</p>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            min={0}
            inputMode="numeric"
            aria-label="Cena no"
            placeholder="No"
            defaultValue={minDefault}
            key={`min-${minKey}`}
            onBlur={(e) => onMin(e.target.value.trim())}
            className="h-10 w-full rounded-xl bg-[var(--slud-s2,var(--iriss-surface-2))] px-3 text-[15px] outline-none"
          />
          <span className="text-[var(--slud-ink3,var(--iriss-ink-3))]">-</span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            aria-label="Cena līdz"
            placeholder="Līdz"
            defaultValue={maxDefault}
            key={`max-${maxKey}`}
            onBlur={(e) => onMax(e.target.value.trim())}
            className="h-10 w-full rounded-xl bg-[var(--slud-s2,var(--iriss-surface-2))] px-3 text-[15px] outline-none"
          />
        </div>
      </div>
      <label className="flex items-start gap-2.5 text-[15px]">
        <input
          type="checkbox"
          className="mt-0.5 h-5 w-5 rounded"
          checked={hideTech}
          onChange={(e) => onHideTech(e.target.checked)}
        />
        <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
          <span>Slēpt ar motora vai kārbas bojājumiem</span>
          <span className="tabular-nums text-[var(--slud-ink3,var(--iriss-ink-3))]">{techCount}</span>
        </span>
      </label>
      <label className="flex items-start gap-2.5 text-[15px]">
        <input
          type="checkbox"
          className="mt-0.5 h-5 w-5 rounded"
          checked={hideOverBudget}
          onChange={(e) => onHideOverBudget(e.target.checked)}
        />
        <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
          <span className="flex flex-wrap items-center gap-1.5">
            Slēpt virs budžeta +
            <input
              type="number"
              min={0}
              inputMode="numeric"
              aria-label="Slieksnis virs budžeta, €"
              value={overBudgetThreshold}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                const raw = e.target.value.trim();
                if (raw === "") return;
                const n = Number(raw);
                if (Number.isFinite(n) && n >= 0) onThreshold(n);
              }}
              className="h-8 w-[4.5rem] rounded-lg bg-[var(--slud-s2,var(--iriss-surface-2))] px-2 text-center text-[13px] outline-none"
            />
            €
          </span>
          <span className="tabular-nums text-[var(--slud-ink3,var(--iriss-ink-3))]">{overBudgetCount}</span>
        </span>
      </label>
      <label className="flex items-start gap-2.5 text-[15px]">
        <input
          type="checkbox"
          className="mt-0.5 h-5 w-5 rounded"
          checked={onlyHidden}
          onChange={(e) => onOnlyHidden(e.target.checked)}
        />
        <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
          <span>Rādīt tikai paslēptos</span>
          <span className="tabular-nums text-[var(--slud-ink3,var(--iriss-ink-3))]">{hiddenCount}</span>
        </span>
      </label>
      <button type="button" onClick={onApply} className="slud-primary mt-1 h-11 w-full rounded-full text-[15px] font-semibold">
        Rādīt {resultCount} auto
      </button>
    </div>
  );
}
