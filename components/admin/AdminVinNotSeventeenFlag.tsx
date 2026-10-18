"use client";

import { orderVinIsNotSeventeen } from "@/lib/order-field-validation";

/** Redzams karogs pasūtījumiem, kuru VIN nav 17 zīmes (numurzīme vai nepilns kods). */
export function AdminVinNotSeventeenFlag({
  vin,
  compact = false,
}: {
  vin: string;
  compact?: boolean;
}) {
  if (!orderVinIsNotSeventeen(vin)) return null;
  return (
    <span
      className={
        compact
          ? "inline-flex shrink-0 items-center rounded-[5px] bg-red-50 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-red-800 ring-1 ring-red-200/90"
          : "mt-1 inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-800 ring-1 ring-red-200"
      }
      role="status"
      title="VIN nav 17 zīmes"
    >
      VIN nav 17 zīmes
    </span>
  );
}
