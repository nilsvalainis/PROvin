"use client";

import type { AutodnaPreviousSearch } from "@/lib/autodna-previous-searches";

/** AutoDNA «Iepriekšējie meklējumi» - tikai lasāms saraksts (no PDF); tas pats klienta PDF kartītē. */
export function AdminAutodnaPreviousSearches({
  rows,
  readOnly,
  onRemove,
}: {
  rows: AutodnaPreviousSearch[] | undefined;
  readOnly?: boolean;
  onRemove: () => void;
}) {
  if (!rows?.length) return null;
  return (
    <div className="mt-3 w-full min-w-0">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-provin-muted)]">Iepriekšējie meklējumi</p>
        {!readOnly ? (
          <button
            type="button"
            onClick={onRemove}
            className="text-[10px] font-medium text-[var(--color-provin-muted)] underline underline-offset-2 hover:text-red-700"
          >
            Noņemt
          </button>
        ) : null}
      </div>
      <div className="border-t border-slate-200">
        {rows.map((r, i) => (
          <div
            key={`${r.dateTime}-${i}`}
            className="grid grid-cols-2 items-center gap-x-3 gap-y-1 border-b border-slate-200 py-2 text-[11px] sm:grid-cols-[1.1fr_1.1fr_0.9fr_1fr_96px]"
          >
            {(
              [
                ["Datums un laiks", r.dateTime],
                ["Pakalpojuma veids", r.service],
                ["IP", r.ip],
                ["Atrašanās vieta", r.location],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="min-w-0">
                <div className="text-[9.5px] text-[var(--color-provin-muted)]">{k}</div>
                <div className="truncate font-medium tabular-nums text-[#1d1d1f]">{v || "-"}</div>
              </div>
            ))}
            {r.map ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.map} alt="" className="h-8 w-24 rounded-md border border-slate-200 object-cover" />
            ) : (
              <span />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
