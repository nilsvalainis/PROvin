/**
 * LIST kartītes budžeta kaste. Izolēta, lai nākamo maketu var pārzīmēt šeit, nepārrakstot rindu.
 * Maketa etiķetes: Klienta budžets, Kopējās izmaksas. Mobilajā slēpj budžeta rindu un „var solīt vēl”.
 */
import type { ListingRealCost } from "@/lib/iriss-listings-cost";
import { listingVatShareLine } from "@/lib/iriss-listings-cost";
import { listingFmtEur } from "@/lib/iriss-listings-card";

export const LISTING_BUDGET_LABEL = "Klienta budžets";
export const LISTING_TOTAL_COST_LABEL = "Kopējās izmaksas";
export const LISTING_BUDGET_MISSING = "Klienta budžets nav";

export type IrissListingBudgetBoxProps = {
  budget: number | null;
  gala: number | null;
  real: ListingRealCost | null;
  maxBid: number | null;
  room: number | null;
  /** Nav derīgas solījuma cenas (tukšs stāvoklis). */
  priceMissing?: boolean;
};

export function IrissListingBudgetBox({ budget, gala, real, maxBid, room, priceMissing }: IrissListingBudgetBoxProps) {
  const left = gala != null && budget != null ? budget - gala : null;

  if (priceMissing || !real) {
    return (
      <div className="mt-2 grid gap-0.5 rounded-xl border border-dashed border-[#E5E7EB] p-3 text-[11px] tabular-nums">
        <div className="text-slate-500">
          {budget != null ? (
            <>
              {LISTING_BUDGET_LABEL} <b className="text-[var(--color-apple-text)]">{listingFmtEur(budget)}</b>
            </>
          ) : (
            <span className="font-semibold text-amber-900">{LISTING_BUDGET_MISSING}</span>
          )}
          {priceMissing ? " · Cenas nav" : ""}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 grid gap-0.5 rounded-xl border border-dashed border-[#E5E7EB] p-3 text-[11px] tabular-nums">
      {budget != null ? (
        <div className="hidden justify-between sm:flex">
          <span>{LISTING_BUDGET_LABEL}</span>
          <b>{listingFmtEur(budget)}</b>
        </div>
      ) : (
        <div className="font-semibold text-amber-900">{LISTING_BUDGET_MISSING}</div>
      )}
      <div className="flex justify-between">
        <span>{LISTING_TOTAL_COST_LABEL}</span>
        <b>{listingFmtEur(gala ?? real.total)}</b>
      </div>
      <div className="text-[10px] leading-snug text-slate-500">{listingVatShareLine(real, (n) => listingFmtEur(n))}</div>
      {left != null ? (
        <div>
          {left >= 0 ? (
            <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-800 sm:text-[11px]">
              +{listingFmtEur(left)}
            </span>
          ) : (
            <span className="rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-extrabold text-red-800 sm:text-[11px]">
              -{listingFmtEur(-left)}
            </span>
          )}
        </div>
      ) : null}
      {maxBid != null ? (
        <div className="flex justify-between text-slate-500">
          <span>Maks.</span>
          <b className="text-[var(--color-apple-text)]">{listingFmtEur(maxBid)}</b>
        </div>
      ) : null}
      {room != null ? (
        <div className="hidden justify-between text-slate-500 sm:flex">
          <span>{room >= 0 ? "var solīt vēl" : "virs maks."}</span>
          <span>{listingFmtEur(Math.abs(room))}</span>
        </div>
      ) : null}
    </div>
  );
}
