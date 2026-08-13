"use client";

import {
  formatAdifyDeltaLabel,
  formatAdifyMileageLabel,
  formatAdifyPriceLabel,
  formatAdifySignedEur,
  type TirgusPriceHistoryRow,
} from "@/lib/adify-listing-history";

type Props = {
  rows: TirgusPriceHistoryRow[];
  priceChangeEur: number;
  durationDays: number | null;
  foundMessage?: string | null;
};

export function AdminListingPriceHistoryTable({
  rows,
  priceChangeEur,
  durationDays,
  foundMessage,
}: Props) {
  if (rows.length === 0) return null;

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-lg border border-slate-200/90 bg-white shadow-sm">
      {foundMessage ? (
        <p className="border-b border-[var(--color-provin-accent)]/20 bg-[var(--color-provin-accent-soft)]/50 px-3 py-1.5 text-[11px] font-semibold text-[var(--color-provin-accent-hover)]">
          {foundMessage}
        </p>
      ) : null}
      <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-provin-muted)]">
        Cenas izmaiņas šajā sludinājumā
      </p>
      <ul className="m-0 list-none divide-y divide-slate-100 px-1 pb-1">
        {rows.map((row, i) => {
          const deltaLabel = formatAdifyDeltaLabel(row.delta);
          const dropped = row.delta < 0;
          return (
            <li key={`${row.date}-${row.price}-${i}`} className="grid grid-cols-3 items-center gap-1 px-2 py-1.5">
              <span className="min-w-0 text-[12px] font-semibold leading-tight text-[var(--color-apple-text)]">
                <span>{formatAdifyPriceLabel(row.price)}</span>
                {deltaLabel ? (
                  <span
                    className={`ml-1 text-[10px] font-semibold ${
                      dropped ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {deltaLabel}
                  </span>
                ) : null}
              </span>
              <span className="min-w-0 text-center text-[12px] font-medium tabular-nums text-[var(--color-apple-text)]">
                {formatAdifyMileageLabel(row.mileage)}
              </span>
              <span className="min-w-0 text-right text-[12px] font-medium tabular-nums text-[var(--color-provin-muted)]">
                {row.date}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between gap-3 border-t border-[var(--color-provin-accent)]/25 bg-[var(--color-provin-accent)] px-3 py-2 text-[11px] text-white">
        <span>
          Cenas izmaiņa: <strong>{formatAdifySignedEur(priceChangeEur)}</strong>
        </span>
        <span>
          Ilgums: <strong>{durationDays != null ? `${durationDays} diena(s)` : "—"}</strong>
        </span>
      </div>
    </div>
  );
}
