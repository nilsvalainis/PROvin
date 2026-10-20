"use client";

import { useEffect, useRef, useState } from "react";
import type { IrissListingMatchNotice } from "@/lib/iriss-listing-match-client";
import { LISTING_PLATFORM_LABEL } from "@/lib/iriss-listings-panel";
import type { IrissListingPlatform } from "@/lib/iriss-listings-types";

export function IrissNewMatchNotice({
  notices,
  onOpen,
}: {
  notices: readonly IrissListingMatchNotice[];
  onOpen: (notice: IrissListingMatchNotice) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const n = notices.length;
  const empty = n === 0;
  const label = "Jaunas atbilstības";
  return (
    <div ref={ref} className="relative inline-flex shrink-0 items-center">
      <button
        type="button"
        disabled={empty}
        className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-medium text-[var(--slud-ink,#0b0c10)] hover:bg-[var(--slud-fill,rgba(116,120,138,.11))] disabled:cursor-default disabled:opacity-45 disabled:hover:bg-transparent"
        aria-expanded={open}
        aria-label={open ? `Aizvērt, ${label} ${n}` : `${label} ${n}`}
        title={empty ? `${label} 0` : label}
        onClick={() => {
          if (empty) return;
          setOpen((v) => !v);
        }}
      >
        {label}
        <span className="slud-badge inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums">
          {n}
        </span>
      </button>
      {open && !empty ? (
        <ul className="absolute right-0 top-full z-40 mt-1 max-h-72 w-[min(92vw,28rem)] overflow-y-auto rounded-xl border border-[var(--slud-hair,rgba(17,24,39,.075))] bg-[var(--slud-s1,#fff)] py-1 text-[13px] shadow-lg">
          {notices.map((notice) => (
            <li key={`${notice.orderId}|${notice.listingId}`}>
              <a
                href={notice.href}
                className="flex min-h-11 items-center justify-between gap-3 px-3 py-1"
                onClick={(e) => {
                  e.preventDefault();
                  onOpen(notice);
                  setOpen(false);
                }}
              >
                <span className="min-w-0 truncate">
                  {notice.clientName} · {notice.title}
                </span>
                <span className="shrink-0 text-[11px] font-medium text-[var(--slud-ink2,#5e636e)]">
                  {LISTING_PLATFORM_LABEL[notice.platform as IrissListingPlatform] ?? notice.platform}
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
