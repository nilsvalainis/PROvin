/**
 * LIST kartītes budžeta kaste. Īsas rindas, bez paskaidrojumiem.
 */
import type { ListingRealCost } from "@/lib/iriss-listings-cost";
import { listingBudgetFitPill, listingFmtEur } from "@/lib/iriss-listings-card";

export const LISTING_BUDGET_LABEL = "Klienta budžets";
export const LISTING_TOTAL_COST_LABEL = "Kopējās izmaksas";
export const LISTING_COSTS_LABEL = "+ Izmaksas";
export const LISTING_VAT_LABEL = "+ PVN 21%";
export const LISTING_PRICE_LABEL = "Pašreizējā cena";
export const LISTING_MAX_BID_LABEL = "Maks. solījums";

export type IrissListingBudgetBoxProps = {
  budget: number | null;
  gala: number | null;
  real: ListingRealCost | null;
  maxBid: number | null;
  room: number | null;
  priceMissing?: boolean;
};

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span>{label}</span>
      {strong ? <b>{value}</b> : <span>{value}</span>}
    </div>
  );
}

export function IrissListingBudgetBox({ budget, gala, real, maxBid, room, priceMissing }: IrissListingBudgetBoxProps) {
  if (priceMissing || !real) return null;
  const total = gala ?? real.total;
  const pill = budget != null ? listingBudgetFitPill(budget, total) : null;

  return (
    <div className="mt-2 grid gap-0.5 rounded-xl border border-dashed border-[#E5E7EB] p-3 text-[11px] tabular-nums">
      <Row label={LISTING_PRICE_LABEL} value={listingFmtEur(real.price)} />
      <Row label={LISTING_COSTS_LABEL} value={listingFmtEur(real.extras)} />
      <Row label={LISTING_VAT_LABEL} value={listingFmtEur(real.vat)} />
      <Row label={`= ${LISTING_TOTAL_COST_LABEL}`} value={listingFmtEur(total)} strong />
      {budget != null ? <Row label={LISTING_BUDGET_LABEL} value={listingFmtEur(budget)} strong /> : null}
      {pill ? (
        <div>
          <span
            className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-extrabold sm:text-[11px] ${
              pill.ok ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
            }`}
          >
            {pill.label}
          </span>
        </div>
      ) : null}
      {maxBid != null ? <Row label={LISTING_MAX_BID_LABEL} value={listingFmtEur(maxBid)} strong /> : null}
      {room != null ? (
        <div className="flex justify-between gap-3 text-slate-500">
          <span>{room >= 0 ? "var solīt vēl" : "virs maks."}</span>
          <span>{listingFmtEur(Math.abs(room))}</span>
        </div>
      ) : null}
    </div>
  );
}
