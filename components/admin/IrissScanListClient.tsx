"use client";

import { ChevronRight, MoreHorizontal, Pin, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { IrissAuctionLogo } from "@/components/admin/IrissAuctionLogo";
import { buildListingPlatformChips } from "@/lib/iriss-listing-links";
import { irissScanSourceCounts } from "@/lib/iriss-scan-sources";
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
  const [menuId, setMenuId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [ectBusy, setEctBusy] = useState(false);
  const [ectMsg, setEctMsg] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const ordered = useMemo(() => orderRows(localRows, initialListOrder), [localRows, initialListOrder]);
  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? ordered.filter((r) => `${r.brandModel} ${r.vin ?? ""}`.toLowerCase().includes(q)) : ordered;
  }, [ordered, query]);
  const linkTotal = useMemo(() => localRows.reduce((n, r) => n + buildListingPlatformChips(r, 100).length, 0), [localRows]);

  useEffect(() => {
    if (!menuId) return;
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuId(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuId(null);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuId]);

  async function togglePin(row: IrissScanListRow) {
    setBusyId(row.id);
    setMenuId(null);
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
  }

  async function appendEcarstradeLinks() {
    if (ectBusy) return;
    setEctBusy(true);
    setEctMsg(null);
    try {
      const res = await fetch("/api/admin/iriss-scan/ecarstrade-links", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply: true, replace: true }),
      });
      const data = (await res.json()) as {
        error?: string;
        addedCount?: number;
        updatedCount?: number;
        saved?: IrissScanListRow[];
      };
      if (!res.ok) {
        setEctMsg(data.error === "store_disabled" ? "Krātuve nav pieejama" : "eCarsTrade saišu atjaunošana neizdevās");
        return;
      }
      if (data.saved?.length) {
        const byId = new Map(data.saved.map((r) => [r.id, r]));
        setLocalRows((prev) => prev.map((row) => byId.get(row.id) ?? row));
      }
      const added = data.addedCount ?? 0;
      const updated = data.updatedCount ?? 0;
      setEctMsg(added === 0 ? "eCarsTrade saites jau ir aktuālas" : `Aizstātas eCarsTrade saites: ${updated} ieraksti`);
    } finally {
      setEctBusy(false);
    }
  }

  return (
    <>
      <div className="mx-auto w-full max-w-[860px] px-2 sm:px-0">
        {/* min-7: virsraksts + skaits, meklēšana pa labi; zem tā sīka pelēka statusa rinda. */}
        <header className="sticky top-0 z-20 -mx-2 bg-[#F8F8F9]/95 px-2 pb-1.5 pt-2 backdrop-blur sm:mx-0 sm:px-0">
          <div className="flex items-center gap-2">
            <h1 className="flex-1 text-[17px] font-semibold tracking-tight text-[var(--color-apple-text)]">Radars</h1>
            {searchOpen || query ? (
              <input
                type="search"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onBlur={() => { if (!query) setSearchOpen(false); }}
                placeholder="Meklēt marku…"
                className="h-9 w-44 rounded-[10px] bg-[#e9e9ee] px-3 text-[14px] outline-none sm:w-64"
              />
            ) : (
              <button type="button" onClick={() => setSearchOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-[#e9e9ee] px-3 text-[13px] font-medium text-[#3a3a3c]">
                <Search className="h-4 w-4" aria-hidden /> <span className="hidden min-[420px]:inline">Meklēt</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => void appendEcarstradeLinks()}
              disabled={ectBusy}
              className="inline-flex h-9 items-center rounded-[10px] bg-[#e9e9ee] px-3 text-[13px] font-medium text-[#3a3a3c] disabled:opacity-40"
              title="Aizstāt eCarsTrade saites ar jaunu filtru (ne pievienot klāt)"
            >
              {ectBusy ? "ET…" : "Atjaunot ET"}
            </button>
          </div>
          <p className="mt-0.5 text-[11.5px] text-[#8e8e93]">
            {localRows.length} {localRows.length === 1 ? "ieraksts" : "ieraksti"} · {linkTotal} saites{query ? ` · atrasti ${visibleRows.length}` : ""}
            {ectMsg ? ` · ${ectMsg}` : ""}
          </p>
        </header>

        {visibleRows.length === 0 ? (
          <p className="mt-6 text-center text-[13px] text-[#8e8e93]">Nekas nav atrasts</p>
        ) : (
          <ul className="mt-2 overflow-visible rounded-xl bg-white shadow-[0_0_0_0.5px_rgba(0,0,0,0.08)]">
            {visibleRows.map((row) => {
              const counts = irissScanSourceCounts(row);
              return (
                <li key={row.id} className="relative flex items-center border-b border-[#e5e5ea] last:border-b-0">
                  <Link
                    href={`/admin/iriss/scan/${encodeURIComponent(row.id)}`}
                    aria-label={`Atvērt radaru: ${row.brandModel || row.vin || "ieraksts"}`}
                    className="flex min-h-[56px] min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 pr-1 transition hover:bg-black/[0.02]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        {row.pinnedAt ? <Pin className="h-3 w-3 shrink-0 fill-current text-[#8e8e93]" aria-label="Piesprausts" /> : null}
                        <p className="truncate text-[15px] font-medium text-[var(--color-apple-text)]">{row.brandModel || "Bez nosaukuma"}</p>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11.5px] text-[#8e8e93]">
                        {counts.length === 0 ? <span>Nav saišu</span> : null}
                        {counts.map((c) => (
                          <span key={c.key} className="inline-flex items-center gap-1" title={c.label}>
                            <IrissAuctionLogo platform={c.logoKey} fallback={c.short} className="h-3 w-[24px]" />
                            {c.count > 1 ? <span>{c.count}</span> : null}
                          </span>
                        ))}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#c7c7cc]" aria-hidden />
                  </Link>
                  <div ref={menuId === row.id ? menuRef : undefined} className="relative shrink-0 pr-2">
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => setMenuId((m) => (m === row.id ? null : row.id))}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#8e8e93] transition hover:bg-black/[0.04] disabled:opacity-40"
                      aria-label="Darbības"
                      title="Darbības"
                    >
                      <MoreHorizontal className="h-5 w-5" aria-hidden />
                    </button>
                    {menuId === row.id ? (
                      <div className="absolute right-2 top-10 z-30 w-52 overflow-hidden rounded-xl bg-white/95 text-[14px] shadow-[0_8px_30px_rgba(0,0,0,0.16),0_0_0_0.5px_rgba(0,0,0,0.1)] backdrop-blur">
                        {buildListingPlatformChips(row, 100).length > 0 ? (
                          <button type="button" onClick={() => { buildListingPlatformChips(row, 100).forEach((c) => window.open(c.href, "_blank", "noopener,noreferrer")); setMenuId(null); }} className="block w-full border-b border-[#e5e5ea] px-3.5 py-2.5 text-left hover:bg-black/[0.03]">
                            Atvērt visas saites
                          </button>
                        ) : null}
                        <button type="button" onClick={() => void togglePin(row)} className="block w-full border-b border-[#e5e5ea] px-3.5 py-2.5 text-left hover:bg-black/[0.03]">
                          {row.pinnedAt ? "Atspraust" : "Piespraust augšā"}
                        </button>
                        <button type="button" onClick={() => { setMenuId(null); setDeleteTargetId(row.id); }} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-red-600 hover:bg-red-50/60">
                          <Trash2 className="h-4 w-4" aria-hidden /> Dzēst
                        </button>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {deleteTargetId ? (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/40 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6" onClick={() => !busyId && setDeleteTargetId(null)} role="presentation">
          <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[15px] font-semibold text-[var(--color-apple-text)]">Dzēst šo radara ierakstu?</h2>
            <p className="mt-1 text-[13px] text-[#8e8e93]">Darbību nevar atsaukt.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setDeleteTargetId(null)} disabled={Boolean(busyId)} className="h-11 rounded-xl bg-[#f2f2f7] text-[15px] font-medium text-[var(--color-apple-text)] disabled:opacity-50">
                Atcelt
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!deleteTargetId) return;
                  setBusyId(deleteTargetId);
                  try {
                    const res = await fetch(`/api/admin/iriss-scan/${encodeURIComponent(deleteTargetId)}`, { method: "DELETE", credentials: "include" });
                    if (!res.ok) return;
                    setLocalRows((prev) => prev.filter((x) => x.id !== deleteTargetId));
                    setDeleteTargetId(null);
                  } finally {
                    setBusyId(null);
                  }
                }}
                disabled={Boolean(busyId)}
                className="h-11 rounded-xl bg-red-600 text-[15px] font-semibold text-white disabled:opacity-50"
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
