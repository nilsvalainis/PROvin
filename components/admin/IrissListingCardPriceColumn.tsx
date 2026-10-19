import { IrissListingBudgetBox } from "@/components/admin/IrissListingBudgetBox";
import { IrissListTaxBadge } from "@/components/admin/IrissListTaxBadge";
import type { ListingCountdown } from "@/lib/iriss-listings-card";
import { listingFmtEur } from "@/lib/iriss-listings-card";
import type { ListingTax } from "@/lib/iriss-listings-vat";
import type { ReactNode } from "react";

export function IrissListingCardPriceColumn({
  priceLabel,
  bid,
  bidCount,
  tax,
  countdown,
  priceBuyNow,
  priceTotal,
  budget,
  gala,
  real,
  maxBid,
  room,
  topActions,
  className = "hidden w-[260px] shrink-0 sm:block",
}: {
  priceLabel: string;
  bid: number | null;
  bidCount?: number | null;
  tax: ListingTax;
  countdown: ListingCountdown;
  priceBuyNow?: number | null;
  priceTotal?: number | null;
  budget: number | null;
  gala: number | null;
  real: ReturnType<typeof import("@/lib/iriss-listings-cost").listingRealCost> | null;
  maxBid: number | null;
  room: number | null;
  topActions?: ReactNode;
  className?: string;
}) {
  const panel = (
    <div className="rounded-xl bg-[#f2f2f5] p-3">
      <div className="flex flex-nowrap items-start justify-between gap-2">
        <div className="min-w-0 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {priceLabel}{bidCount != null ? ` · ${bidCount} solījumi` : ""}
        </div>
        {topActions ? <div className="flex shrink-0 flex-nowrap items-center gap-1.5">{topActions}</div> : null}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <span className="text-[26px] font-extrabold tabular-nums leading-none">{bid == null ? "-" : listingFmtEur(bid)}</span>
        <IrissListTaxBadge tax={tax} size="md" quiet />
      </div>
      {priceBuyNow != null && priceBuyNow !== bid ? (
        <div className="mt-0.5 text-[11px] text-slate-500">pirkt uzreiz {listingFmtEur(priceBuyNow)}</div>
      ) : null}
      {priceTotal != null && priceTotal !== bid ? (
        <div className="mt-0.5 text-[11px] text-slate-500">kopā {listingFmtEur(priceTotal)}</div>
      ) : null}
      {countdown.t || countdown.end ? (
        <div className={`mt-2 flex flex-wrap items-center gap-1.5 text-[12px] font-extrabold tabular-nums ${countdown.k}`}>
          ⏱ {countdown.t}
          {countdown.end ? <span className="font-semibold text-slate-500">· {countdown.end}</span> : null}
        </div>
      ) : null}
    </div>
  );

  return (
    <div className={className}>
      {panel}
      <IrissListingBudgetBox budget={budget} gala={gala} real={real} maxBid={maxBid} room={room} priceMissing={bid == null} priceLabel={priceLabel} />
    </div>
  );
}

export function IrissListingCardPriceColumnMobile(props: Omit<Parameters<typeof IrissListingCardPriceColumn>[0], "className">) {
  return <IrissListingCardPriceColumn {...props} className="sm:hidden" />;
}
