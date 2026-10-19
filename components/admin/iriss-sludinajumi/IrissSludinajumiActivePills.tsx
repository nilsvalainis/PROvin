"use client";

import { X } from "lucide-react";
import type { ListingFilterPill } from "@/lib/iriss-listings-list-view";

const STROKE = 1.6;

export function IrissSludinajumiActivePills({
  pills,
  onClear,
  onClearAll,
}: {
  pills: readonly ListingFilterPill[];
  onClear: (id: ListingFilterPill["id"]) => void;
  onClearAll: () => void;
}) {
  if (pills.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="text-[13px] font-medium text-[var(--slud-ink2,#5e636e)]">Aktīvie filtri:</span>
      {pills.map((pill) => (
        <span
          key={pill.id}
          className="inline-flex h-7 max-w-full items-center gap-1 rounded-full bg-[var(--slud-fill,rgba(116,120,138,.11))] px-2.5 text-[12.5px] text-[var(--slud-ink,#0b0c10)]"
        >
          <span className="truncate">{pill.label}</span>
          <button type="button" aria-label={`Noņemt filtru: ${pill.label}`} onClick={() => onClear(pill.id)} className="grid h-5 w-5 place-items-center rounded-full hover:bg-[var(--slud-fill2)]">
            <X className="h-3 w-3" strokeWidth={STROKE} />
          </button>
        </span>
      ))}
      <button type="button" onClick={onClearAll} className="h-7 px-1.5 text-[12.5px] font-medium text-[var(--slud-ink2,#5e636e)] hover:underline">
        Notīrīt visus
      </button>
    </div>
  );
}
