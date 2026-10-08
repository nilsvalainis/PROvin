"use client";

import Link from "next/link";
import type { IrissListingOrderBrief } from "@/lib/iriss-listings-orders";
import { listingOrderShortId } from "@/lib/iriss-listings-orders";

function fmtBudget(n: number | null, raw: string): string {
  if (n != null) return `${Math.round(n).toLocaleString("lv-LV")} €`;
  const t = raw.trim();
  if (!t || t === "\u2014" || t === "-") return "Budžets nav";
  return t;
}

export function IrissListingOrderChips({
  orders,
  compact = false,
}: {
  orders: readonly IrissListingOrderBrief[];
  compact?: boolean;
}) {
  if (orders.length === 0) {
    return <p className="text-[11px] text-slate-500">Pasūtījums nav piesaistīts</p>;
  }
  return (
    <ul className={compact ? "space-y-0.5" : "space-y-1"}>
      {orders.map((o) => (
        <li key={o.id} className="min-w-0 text-[11px] leading-snug text-slate-600">
          <Link
            href={`/admin/iriss/pasutijumi/${encodeURIComponent(o.id)}`}
            className="font-semibold text-[var(--color-apple-text)] hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {o.clientName}
            <span className="font-medium text-slate-500"> · Nr. {listingOrderShortId(o.id)}</span>
          </Link>
          <span className="text-slate-500">
            {" "}
            {o.brandModel || "marka ?"}
            {o.productionYears ? ` · ${o.productionYears}` : ""}
            {" · "}
            {fmtBudget(o.budget, o.budgetRaw)}
          </span>
          {!compact && o.brief ? <span className="block truncate text-[10px] text-slate-400">{o.brief}</span> : null}
        </li>
      ))}
    </ul>
  );
}
