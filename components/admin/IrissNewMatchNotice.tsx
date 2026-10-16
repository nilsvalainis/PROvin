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
    <div className="relative inline-flex shrink-0 items-center gap-1">
      <span
        className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-600 px-1 text-[10px] font-semibold leading-none text-white tabular-nums"
        title={label}
        aria-hidden
      >
        {notices.length}
      </span>
      <button
        type="button"
        className="inline-flex h-7 items-center rounded-full px-1.5 text-[11px] font-semibold text-[#3a3a3c] hover:bg-[#e9e9ee]"
        aria-expanded={open}
        aria-label={open ? `Aizvērt, ${label}` : `Saraksts, ${label}`}
        title={label}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Aizvērt" : "Saraksts"}
      </button>
      {open ? (
        <ul className="absolute right-0 top-full z-40 mt-1 max-h-72 w-[min(92vw,28rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 text-[13px] text-slate-700 shadow-lg">
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
