"use client";

import { Check, X } from "lucide-react";
import { IRISS_LISTING_CARD_ACTION_ORDER } from "@/lib/iriss-listing-card-actions";
import { listingCriteriaMarks } from "@/lib/iriss-listing-criteria-checks";
import { listingOrderChipSubtitle, type IrissListingOrderBrief } from "@/lib/iriss-listings-orders";
import type { IrissOrderRoomHitSource } from "@/lib/iriss-order-room";

export function IrissListingOrderChips({
  orders,
  compact = false,
  onPreview,
  vehicle,
}: {
  orders: readonly IrissListingOrderBrief[];
  compact?: boolean;
  onPreview?: (order: IrissListingOrderBrief) => void;
  /** Ja dots - zem klienta ✓/✕ pa pasūtījuma prasībām (gads, km, kārba, krāsa...). */
  vehicle?: IrissOrderRoomHitSource;
}) {
  if (orders.length === 0) return null;
  return (
    <ul className={compact ? "space-y-0.5" : "space-y-1"}>
      {orders.map((o) => {
        const bits = listingOrderChipSubtitle(o);
        const marks = vehicle ? listingCriteriaMarks(vehicle, o) : [];
        return (
          <li key={o.id} className="flex min-w-0 flex-col items-stretch gap-1 text-[11px] leading-snug text-slate-600 sm:flex-row sm:items-start sm:gap-1.5">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-[var(--color-apple-text)]">{o.clientName}</div>
              {bits ? <div className="truncate text-slate-500">{bits}</div> : null}
              {marks.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-1" data-listing-criteria="">
                  {marks.map((m) => (
                    <span
                      key={m.id}
                      className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-[var(--color-apple-text)]"
                      title={m.pass ? "Atbilst prasībām" : "Neatbilst prasībām"}
                    >
                      {/* Ikona, ne ✓/✕ simbols: iOS tos zīmē kā krāsainas emoji. */}
                      {m.pass ? (
                        <Check aria-hidden className="h-3 w-3 text-emerald-700" strokeWidth={3} />
                      ) : (
                        <X aria-hidden className="h-3 w-3 text-red-600" strokeWidth={3} />
                      )}
                      <span className="sr-only">{m.pass ? "Atbilst:" : "Neatbilst:"}</span>
                      {m.label}
                    </span>
                  ))}
                </div>
              ) : null}
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
