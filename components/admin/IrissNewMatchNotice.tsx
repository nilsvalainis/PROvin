"use client";

import { useState } from "react";
import type { IrissListingMatchNotice } from "@/lib/iriss-listing-match";

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
    <section className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-700 shadow-sm">
      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="font-medium">{label}</span>
        <span className="text-[12px] font-semibold text-slate-500">{open ? "Aizvērt" : "Saraksts"}</span>
      </button>
      {open ? (
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {notices.map((notice) => (
            <li key={`${notice.orderId}|${notice.listingId}`}>
              <a
                href={notice.href}
                className="flex min-h-11 items-center justify-between gap-3 py-1"
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
    </section>
  );
}
