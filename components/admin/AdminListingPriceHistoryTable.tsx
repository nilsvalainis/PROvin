"use client";

import {
  formatAdifyDeltaLabel,
  formatAdifyMileageLabel,
  formatAdifyPriceLabel,
  formatAdifySignedEur,
  formatAdifyYearLabel,
  type TirgusPriceHistoryRow,
} from "@/lib/adify-listing-history";

type Props = {
  rows: TirgusPriceHistoryRow[];
  priceChangeEur: number;
  durationDays: number | null;
};

export function AdminListingPriceHistoryTable({ rows, priceChangeEur, durationDays }: Props) {
  if (rows.length === 0) return null;

  return (
    <div className="w-full min-w-0">
      <p className="mb-1.5 text-[12px] font-bold text-[#2B2F4A]">Cenas izmaiņas šajā sludinājumā</p>
      <div className="relative">
        <div className="relative overflow-hidden rounded-xl border border-[#2B2F4A40] bg-white p-3">
          <ul className="m-0 list-none p-0">
            {rows.map((row, i) => {
              const deltaLabel = formatAdifyDeltaLabel(row.delta);
              const dropped = row.delta < 0;
              return (
                <li
                  key={`${row.date}-${row.price}-${i}`}
                  className="mb-2 flex last:mb-0"
                >
                  <span className="flex-1 border-r border-[#2B2F4A40] pr-2 text-center text-[13px] font-semibold leading-tight text-[#2B2F4A] sm:text-[15px]">
                    <span>{formatAdifyPriceLabel(row.price)}</span>
                    {deltaLabel ? (
                      <span
                        className={`ml-0.5 text-[11px] ${dropped ? "text-green-500" : "text-red-500"}`}
                      >
                        {deltaLabel}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex-1 border-r border-[#2B2F4A40] px-2 text-center text-[13px] font-semibold leading-tight text-[#2B2F4A] sm:text-[15px]">
                    {formatAdifyMileageLabel(row.mileage)}
                  </span>
                  <span className="flex-1 border-r border-[#2B2F4A40] px-2 text-center text-[13px] font-semibold leading-tight text-[#2B2F4A] sm:text-[15px]">
                    {formatAdifyYearLabel(row.year)}
                  </span>
                  <span className="flex-1 pl-2 text-center text-[13px] font-semibold leading-tight text-[#2B2F4A] sm:text-[15px]">
                    {row.date}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="-mt-2 flex rounded-b-xl border border-[#2B2F4A40] bg-[#686A94] px-5 pb-3 pt-5 text-[13px] text-white">
          <div className="flex-1">
            Cenas izmaiņa: <strong>{formatAdifySignedEur(priceChangeEur)}</strong>
          </div>
          <div className="text-center">
            Ilgums:{" "}
            <strong>{durationDays != null ? `${durationDays} diena(s)` : "—"}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
