"use client";

import type { IrissPriceChip, IrissPriceHistoryRow } from "@/lib/iriss-listing-price-chips";
import { listingFmtEur } from "@/lib/iriss-listings-card";

export function IrissPriceChangeChip({ chip }: { chip: IrissPriceChip }) {
  const down = chip.direction === "down";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
        down
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-amber-200 bg-amber-50 text-amber-900"
      }`}
    >
      {chip.label}
    </span>
  );
}

export function IrissPriceHistoryPanel({ rows }: { rows: readonly IrissPriceHistoryRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-2 rounded-xl border border-[var(--iriss-line)] bg-[#fafafa] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[var(--iriss-ink-2)]">Cenas izmaiņas</p>
      <ul className="mt-1 space-y-1">
        {rows.slice(-6).map((row) => (
          <li key={`${row.at}-${row.from}-${row.to}`} className="flex justify-between gap-2 text-[11px]">
            <span className="text-[var(--iriss-ink-2)]">{row.stamp}</span>
            <span className={row.direction === "down" ? "font-semibold text-emerald-700" : "font-semibold text-amber-800"}>
              {listingFmtEur(row.to)} {row.direction === "down" ? "↓" : "↑"}
              {listingFmtEur(Math.abs(row.delta))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
