"use client";

import type { IrissListingOrderBrief } from "@/lib/iriss-listings-orders";

function fmtBudget(n: number | null, raw: string): string {
  if (n != null) return `${Math.round(n).toLocaleString("lv-LV")} €`;
  const t = raw.trim();
  if (!t || t === "\u2014" || t === "-") return "Budžets nav";
  return t;
}

export function IrissListingOrderChips({
  orders,
  compact = false,
  onPreview,
}: {
  orders: readonly IrissListingOrderBrief[];
  compact?: boolean;
  onPreview?: (order: IrissListingOrderBrief) => void;
}) {
  if (orders.length === 0) {
    return <p className="text-[11px] text-slate-500">Pasūtījums nav piesaistīts</p>;
  }
  return (
    <ul className={compact ? "space-y-0.5" : "space-y-1"}>
      {orders.map((o) => {
        const bits = [o.brandModel || "marka ?", fmtBudget(o.budget, o.budgetRaw), o.preferredColors || "Krāsa nav"].filter(Boolean);
        return (
          <li key={o.id} className="flex min-w-0 items-start gap-1.5 text-[11px] leading-snug text-slate-600">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-[var(--color-apple-text)]">{o.clientName}</div>
              <div className="truncate text-slate-500">{bits.join(" · ")}</div>
            </div>
            {onPreview ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview(o);
                }}
                className="inline-flex h-7 shrink-0 items-center rounded-full border border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                Pasūtījums
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
