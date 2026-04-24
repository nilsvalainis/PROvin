"use client";

import { Pin, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  buildListingPlatformChips,
  IR_LISTING_ALL_CHIP_STYLE,
  LISTING_PLATFORM_CHIPS_SCROLL_ROW_CLASS,
  LISTING_PLATFORM_CHIP_ANCHOR_BASE_CLASS,
} from "@/lib/iriss-listing-links";
import type { IrissScanListOrder, IrissScanListRow } from "@/lib/iriss-scan-types";
import { IrissScanNewFab } from "@/components/admin/IrissScanNewFab";

function orderRows(rows: IrissScanListRow[], order: IrissScanListOrder | null): IrissScanListRow[] {
  if (!order) return [...rows].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  const map = new Map(rows.map((r) => [r.id, r]));
  const used = new Set<string>();
  const pinned: IrissScanListRow[] = [];
  const unpinned: IrissScanListRow[] = [];
  for (const id of order.pinnedOrder) {
    const row = map.get(id);
    if (!row) continue;
    pinned.push(row);
    used.add(id);
  }
  for (const id of order.unpinnedOrder) {
    const row = map.get(id);
    if (!row) continue;
    unpinned.push(row);
    used.add(id);
  }
  const rest = rows.filter((r) => !used.has(r.id)).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  return [...pinned, ...unpinned, ...rest];
}

export function IrissScanListClient({ rows, initialListOrder }: { rows: IrissScanListRow[]; initialListOrder: IrissScanListOrder | null }) {
  const [localRows, setLocalRows] = useState(rows);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const visibleRows = useMemo(() => orderRows(localRows, initialListOrder), [localRows, initialListOrder]);

  return (
    <>
      <div className="mt-3 flex flex-col gap-3 sm:gap-4">
        {visibleRows.map((row) => {
          const chips = buildListingPlatformChips(row, 5);
          return (
            <div key={row.id} className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm transition hover:border-slate-300">
              <div className="flex items-stretch">
                <Link
                  href={`/admin/iriss/scan/${encodeURIComponent(row.id)}`}
                  aria-label={`Atvērt SCAN: ${row.brandModel || "—"}`}
                  className="flex min-w-0 flex-1 flex-row items-center gap-2.5 p-3 outline-none ring-[var(--color-provin-accent)]/30 transition hover:bg-black/[0.03] active:bg-black/[0.05] focus-visible:ring-2 sm:gap-3 sm:p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate text-[14px] font-semibold leading-snug text-[var(--color-apple-text)] sm:text-[15px]">{row.brandModel || "—"}</p>
                      {row.pinnedAt ? <Pin className="h-3.5 w-3.5 shrink-0 text-black" aria-hidden /> : null}
                    </div>
                  </div>
                  <span className="hidden shrink-0 self-center rounded-full border border-[#E5E7EB] px-2.5 py-1 text-[11px] font-semibold text-black shadow-sm sm:inline-flex sm:px-3 sm:py-1.5 sm:text-[12px]">
                    Atvērt
                  </span>
                </Link>
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={async () => {
                    setBusyId(row.id);
                    try {
                      const res = await fetch(`/api/admin/iriss-scan/${encodeURIComponent(row.id)}`, { credentials: "include" });
                      if (!res.ok) return;
                      const data = (await res.json()) as { record?: IrissScanListRow };
                      if (!data.record) return;
                      const patchRes = await fetch(`/api/admin/iriss-scan/${encodeURIComponent(row.id)}`, {
                        method: "PATCH",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ...data.record, pinnedAt: data.record.pinnedAt ? "" : new Date().toISOString() }),
                      });
                      if (!patchRes.ok) return;
                      const patched = (await patchRes.json()) as { record?: IrissScanListRow };
                      if (!patched.record) return;
                      setLocalRows((prev) => prev.map((x) => (x.id === row.id ? patched.record! : x)));
                    } finally {
                      setBusyId(null);
                    }
                  }}
                  className="m-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
                  title={row.pinnedAt ? "Noņemt piespraušanu" : "Piespraust augšā"}
                  aria-label={row.pinnedAt ? "Noņemt piespraušanu" : "Piespraust augšā"}
                >
                  <Pin className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => setDeleteTargetId(row.id)}
                  className="my-2 mr-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-red-200 bg-white text-red-700 shadow-sm transition hover:bg-red-50"
                  title="Dzēst ierakstu"
                  aria-label="Dzēst ierakstu"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {chips.length > 0 ? (
                <div className="border-t border-[#E5E7EB] px-3 py-2.5 sm:px-4 sm:py-2.5">
                  <div role="group" aria-label="Sludinājumu platformu saites" className={LISTING_PLATFORM_CHIPS_SCROLL_ROW_CLASS}>
                    {chips.map((c, i) => (
                      <a key={`${c.href}-${i}`} href={c.href} target="_blank" rel="noopener noreferrer" title={c.title} className={LISTING_PLATFORM_CHIP_ANCHOR_BASE_CLASS} style={c.chipStyle}>
                        {c.letter}
                      </a>
                    ))}
                    <button
                      type="button"
                      onClick={() => chips.forEach((chip) => window.open(chip.href, "_blank", "noopener,noreferrer"))}
                      title="Atvērt visas saites"
                      aria-label="Atvērt visas saites"
                      className={LISTING_PLATFORM_CHIP_ANCHOR_BASE_CLASS}
                      style={IR_LISTING_ALL_CHIP_STYLE}
                    >
                      ALL
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {deleteTargetId ? (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/45 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6" onClick={() => !busyId && setDeleteTargetId(null)} role="presentation">
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xl sm:p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-[var(--color-apple-text)]">Vai tiešām vēlaties neatgriezeniski dzēst šo SCAN ierakstu?</h2>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setDeleteTargetId(null)} disabled={Boolean(busyId)} className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-medium text-[var(--color-apple-text)] shadow-sm transition hover:bg-slate-50 disabled:opacity-50">
                Atcelt
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!deleteTargetId) return;
                  setBusyId(deleteTargetId);
                  try {
                    const res = await fetch(`/api/admin/iriss-scan/${encodeURIComponent(deleteTargetId)}`, {
                      method: "DELETE",
                      credentials: "include",
                    });
                    if (!res.ok) return;
                    setLocalRows((prev) => prev.filter((x) => x.id !== deleteTargetId));
                    setDeleteTargetId(null);
                  } finally {
                    setBusyId(null);
                  }
                }}
                disabled={Boolean(busyId)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-red-700 px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-red-800 disabled:opacity-50"
              >
                {busyId ? "Dzēš…" : "Dzēst"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <IrissScanNewFab />
    </>
  );
}
