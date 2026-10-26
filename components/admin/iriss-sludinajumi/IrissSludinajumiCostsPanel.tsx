"use client";

import type { ListingCostParts } from "@/lib/iriss-listings-cost";
import { listingExtrasI } from "@/lib/iriss-listings-cost";

const FIELDS: ReadonlyArray<{ key: keyof ListingCostParts; label: string }> = [
  { key: "fee", label: "Izsoles komisija" },
  { key: "transport", label: "Transports" },
  { key: "commission", label: "Komisija" },
  { key: "unplanned", label: "Neplānotās" },
];

function fmt(n: number): string {
  const rounded = Math.round(n);
  const grouped = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${rounded < 0 ? "-" : ""}${grouped} €`;
}

export function IrissSludinajumiCostsPanel({
  costs,
  onChange,
}: {
  costs: ListingCostParts;
  onChange: (part: keyof ListingCostParts, value: number) => void;
}) {
  const total = listingExtrasI(costs);
  return (
    <div>
      <p className="text-[13px] leading-5 text-[var(--slud-ink2,var(--iriss-ink-2))]">
        Papildu izmaksas vienam auto. Pieskaita cenai, lai rēķinātu &quot;Var solīt vēl&quot; un filtru &quot;Slēpt virs
        budžeta&quot;. Budžets nāk no piesaistītā pasūtījuma. Katram auto var pārrakstīt kartītē.
      </p>
      <div className="mt-3 divide-y divide-[var(--slud-hair)]">
        {FIELDS.map((f) => (
          <label key={f.key} className="flex items-center justify-between gap-3 py-2.5 text-[15px]">
            <span>{f.label}</span>
            <span className="inline-flex items-center gap-1">
              <input
                type="number"
                inputMode="numeric"
                aria-label={f.label}
                value={costs[f.key]}
                onChange={(e) => onChange(f.key, Number(e.target.value) || 0)}
                className="h-9 w-24 rounded-lg bg-[var(--slud-s2,var(--iriss-surface-2))] px-2 text-right text-[15px] tabular-nums outline-none"
              />
              <span className="text-[var(--slud-ink2)]">€</span>
            </span>
          </label>
        ))}
        <div className="flex items-center justify-between py-2.5 text-[15px] font-semibold">
          <span>Kopā uz auto</span>
          <span className="tabular-nums">{fmt(total)}</span>
        </div>
      </div>
      <p className="mt-1 text-[12px] text-[var(--slud-ink3,var(--iriss-ink-3))]">Saglabājas šajā pārlūkā.</p>
    </div>
  );
}
