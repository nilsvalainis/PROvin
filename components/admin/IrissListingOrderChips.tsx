"use client";

import { IRISS_LISTING_CARD_ACTION_ORDER } from "@/lib/iriss-listing-card-actions";
import { listingOrderChipSubtitle, type IrissListingOrderBrief } from "@/lib/iriss-listings-orders";

export function IrissListingOrderChips({
  orders,
  compact = false,
  onPreview,
}: {
  orders: readonly IrissListingOrderBrief[];
  compact?: boolean;
  onPreview?: (order: IrissListingOrderBrief) => void;
}) {
  if (orders.length === 0) return null;
  return (
    <ul className={compact ? "space-y-0.5" : "space-y-1"}>
      {orders.map((o) => {
        const bits = listingOrderChipSubtitle(o);
        return (
          <li key={o.id} className="flex min-w-0 flex-col items-stretch gap-1 text-[11px] leading-snug text-slate-600 sm:flex-row sm:items-start sm:gap-1.5">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-[var(--color-apple-text)]">{o.clientName}</div>
              {bits ? <div className="truncate text-slate-500">{bits}</div> : null}
            </div>
            {onPreview ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview(o);
                }}
                className="inline-flex h-7 w-fit shrink-0 items-center rounded-full border border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                {IRISS_LISTING_CARD_ACTION_ORDER}
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
