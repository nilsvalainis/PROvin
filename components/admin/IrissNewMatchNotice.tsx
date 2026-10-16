"use client";

import { useState } from "react";
import type { IrissListingMatchNotice } from "@/lib/iriss-listing-match-client";

export function IrissNewMatchNotice({
  notices,
  onOpen,
}: {
  notices: readonly IrissListingMatchNotice[];
  onOpen: (notice: IrissListingMatchNotice) => void;
}) {
  const [open, setOpen] = useState(false);
  if (notices.length === 0) return null;
  const label = notices.length === 1 ? "1 jauna atbilstība" : `${notices.length} jaunas atbilstības`;
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        className="inline-flex h-10 min-h-10 items-center gap-1.5 rounded-full bg-white px-2.5 text-[12px] text-slate-800 ring-1 ring-slate-200 sm:h-7 sm:min-h-0 sm:px-2"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="font-medium whitespace-nowrap">{label}</span>
        <span className="text-[12px] font-semibold text-slate-500">{open ? "Aizvērt" : "Saraksts"}</span>
      </button>
      {open ? (
        <ul className="absolute left-0 top-full z-40 mt-1 max-h-72 w-[min(92vw,28rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 text-[13px] text-slate-700 shadow-lg">
          {notices.map((notice) => (
            <li key={`${notice.orderId}|${notice.listingId}`}>
              <a
                href={notice.href}
                className="flex min-h-11 items-center justify-between gap-3 px-3 py-1"
                onClick={(e) => {
                  e.preventDefault();
                  onOpen(notice);
                }}
              >
                <span className="min-w-0 truncate">
                  {notice.clientName} · {notice.title}
                </span>
                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{notice.platform}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
