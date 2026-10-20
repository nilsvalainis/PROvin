"use client";

import Link from "next/link";
import { IrissMiniLvPlate } from "@/components/admin/IrissMiniLvPlate";
import { useIrissWaybillPlateStrip } from "@/components/admin/useIrissWaybillPlateStrip";

export function IrissPavadzimesPlateStrip({
  enabled,
  embedded = false,
  label = true,
}: {
  enabled: boolean;
  embedded?: boolean;
  label?: boolean;
}) {
  const { items, loaded } = useIrissWaybillPlateStrip(enabled);
  const rowClass = embedded
    ? "am-chip-fade -mr-4 flex max-w-full items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    : "flex max-w-full items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

  if (!enabled) return null;
  if (!loaded) {
    return (
      <div className="mb-0 max-w-full md:hidden" aria-hidden>
        <div className={rowClass}>
          <span className="h-11 w-28 shrink-0 animate-pulse rounded-[10px] bg-[var(--fill-secondary)]" />
          <span className="h-11 w-24 shrink-0 animate-pulse rounded-[10px] bg-[var(--fill-secondary)]" />
          <span className="h-11 w-24 shrink-0 animate-pulse rounded-[10px] bg-[var(--fill-secondary)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="mb-0 max-w-full md:hidden" aria-label="Pavadzīmju derīgums">
      <div className={rowClass}>
        {label ? <span className="shrink-0 text-[12px] font-medium text-[var(--label-secondary)]">Pavadzīmes</span> : null}
        {items.map((item) => (
          <Link
            key={item.plate}
            href="/admin/iriss/pavadzimes"
            className="iriss-plate-strip-item inline-flex min-h-11 shrink-0 items-center gap-1.5"
            aria-label={`${item.plate}, ${item.statusLabel}`}
          >
            <IrissMiniLvPlate plate={item.plate} />
            <span className="iriss-plate-status">
              <i aria-hidden className="iriss-plate-status-dot" />
              {item.statusLabel}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
