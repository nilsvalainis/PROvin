"use client";

import { ChevronRight, Pin, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { IrissOverflowItem, IrissOverflowMenu } from "@/components/admin/IrissOverflowMenu";
import { IrissScanEditor } from "@/components/admin/IrissScanEditor";
import { IrissScanFinds } from "@/components/admin/IrissScanFinds";
import { AdminMobileRoundBtn, AdminMobileSearchField, AdminMobileTopBar } from "@/components/admin/mobile/AdminMobileChrome";
import type { IrissListingHitStatus } from "@/lib/iriss-listing-match-client";
import { irissScanFindBucket, type IrissScanFindCard } from "@/lib/iriss-scan-finds";
import { orderIrissScanListRows } from "@/lib/iriss-scan-list-order";
import {
  countIrissScanLinks,
  formatIrissScanLastRead,
  formatIrissScanNewHitsLabel,
  formatIrissScanSourcesText,
  formatIrissScanTitle,
  irissScanNewHitsFor,
} from "@/lib/iriss-scan-list-view";
import type { IrissScanListOrder, IrissScanListRow, IrissScanRecord } from "@/lib/iriss-scan-types";

function useDesktopSplit(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") return () => undefined;
      const mq = window.matchMedia("(min-width: 768px)");
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () => (typeof window !== "undefined" ? window.matchMedia("(min-width: 768px)").matches : false),
    () => false,
  );
}

export function IrissScanListClient({
  rows,
  initialListOrder,
  newHitsByScan = {},
  finds = [],
  selectedRecord = null,
  unsavedDraft = false,
  mode = "list",
}: {
  rows: IrissScanListRow[];
  initialListOrder: IrissScanListOrder | null;
  newHitsByScan?: Record<string, number>;
  finds?: IrissScanFindCard[];
  selectedRecord?: IrissScanRecord | null;
  unsavedDraft?: boolean;
  mode?: "list" | "edit";
}) {
  const router = useRouter();
  const desktop = useDesktopSplit();
  const [localRows, setLocalRows] = useState(rows);
  const [query, setQuery] = useState("");
  const [ectBusy, setEctBusy] = useState(false);
  const [ectMsg, setEctMsg] = useState<string | null>(null);
  const [liveFinds, setLiveFinds] = useState(finds);
  const [hitsByScan, setHitsByScan] = useState(newHitsByScan);
  const ordered = useMemo(() => orderIrissScanListRows(localRows, initialListOrder), [localRows, initialListOrder]);

  useEffect(() => {
    setLocalRows(rows);
  }, [rows]);

  useEffect(() => {
    setLiveFinds(finds);
  }, [finds]);

  useEffect(() => {
    setHitsByScan(newHitsByScan);
  }, [newHitsByScan]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/iriss-scan", { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json().catch(() => ({}))) as { rows?: IrissScanListRow[] };
        if (cancelled || !Array.isArray(data.rows)) return;
        setLocalRows(data.rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? ordered.filter((r) => `${r.brandModel} ${r.vin ?? ""}`.toLowerCase().includes(q)) : ordered;
  }, [ordered, query]);
  const linkTotal = useMemo(() => localRows.reduce((n, r) => n + countIrissScanLinks(r), 0), [localRows]);

  const selectedId = selectedRecord?.id ?? "";
  const desktopRecord =
    selectedRecord ??
    (desktop && !unsavedDraft ? ordered[0] ?? null : null);
  const showList = mode === "list" || desktop;
  const showEditor = mode === "edit" || (desktop && Boolean(desktopRecord));
  const editorRecord = selectedRecord ?? desktopRecord;
  const editorFinds = editorRecord ? liveFinds.filter((f) => f.scanId === editorRecord.id) : liveFinds;

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
      const updated = data.updatedCount ?? data.saved?.length ?? 0;
      setEctMsg(updated === 0 ? "eCarsTrade saites jau ir aktuālas" : `Aizstātas eCarsTrade saites: ${updated} ieraksti`);
    } finally {
      setEctBusy(false);
    }
  }

  async function setFindStatus(card: IrissScanFindCard, status: IrissListingHitStatus) {
    setLiveFinds((prev) =>
      prev.map((f) =>
        f.listingId === card.listingId && f.orderId === card.orderId
          ? { ...f, status, bucket: irissScanFindBucket(status) }
          : f,
      ),
    );
    if (status !== "jauns") {
      setHitsByScan((prev) => {
        const n = Math.max(0, (prev[card.scanId] ?? 0) - (card.status === "jauns" ? 1 : 0));
        return { ...prev, [card.scanId]: n };
      });
    }
    await fetch("/api/admin/iriss-listings/match-status", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ orderId: card.orderId, listingId: card.listingId, status }] }),
    }).catch(() => {});
  }

  const onEditorRecordChange = useCallback((next: IrissScanRecord) => {
    setLocalRows((prev) => {
      const i = prev.findIndex((r) => r.id === next.id);
      if (i === -1) return [next, ...prev];
      const copy = [...prev];
      copy[i] = next;
      return copy;
    });
  }, []);

  const onEditorDeleted = useCallback(
    (id: string) => {
      setLocalRows((prev) => prev.filter((r) => r.id !== id));
      if (!desktop) router.push("/admin/iriss/scan");
    },
    [desktop, router],
  );

  const listBody = (
    <div className="iriss-scan-list min-w-0">
      {visibleRows.length === 0 ? (
        <p className="mt-6 text-center text-[13px] text-[var(--ink3)]">
          {query.trim() ? "Nekas nav atrasts" : "Nav radara ierakstu"}
        </p>
      ) : (
        <ul className="space-y-2">
          {visibleRows.map((row) => {
            const hits = irissScanNewHitsFor(row.id, hitsByScan);
            const sources = formatIrissScanSourcesText(row);
            const last = formatIrissScanLastRead(row.updatedAt);
            const active = editorRecord?.id === row.id;
            return (
              <li key={row.id}>
                <Link
                  href={`/admin/iriss/scan/${encodeURIComponent(row.id)}`}
                  aria-label={`Atvērt radaru: ${formatIrissScanTitle(row.brandModel) || row.vin || "ieraksts"}`}
                  className={`iriss-scan-row flex min-h-[72px] items-center gap-3 rounded-2xl bg-[var(--s1)] px-3.5 py-3 shadow-[var(--sh)] transition hover:bg-[var(--s2)] md:min-h-[64px] ${
                    active ? "ring-1 ring-[var(--ink)]/10" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      {row.pinnedAt ? <Pin className="h-3 w-3 shrink-0 fill-current text-[var(--ink3)]" aria-label="Piesprausts" /> : null}
                      <p className="truncate text-[15px] font-semibold text-[var(--ink)]">{formatIrissScanTitle(row.brandModel)}</p>
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-[var(--ink2)]">{sources || "Nav saišu"}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {hits > 0 ? (
                      <span className="inline-flex h-6 items-center rounded-full bg-[var(--chip-active-bg)] px-2 text-[11px] font-semibold text-[var(--chip-active-fg)]">
                        {formatIrissScanNewHitsLabel(hits)}
                      </span>
                    ) : null}
                    {last ? <span className="text-[11px] text-[var(--ink3)]">{last}</span> : null}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[var(--ink3)]" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  return (
    <div className="iriss-radars-view bg-[var(--bg-base)]">
      {showList ? (
        <div className="md:hidden">
          <AdminMobileTopBar
            title="Radars"
            trailing={
              <>
                <IrissOverflowMenu label="Vairāk">
                  <IrissOverflowItem disabled={ectBusy} onClick={() => void appendEcarstradeLinks()}>
                    {ectBusy ? "Atjauno eCarsTrade saites..." : "Atjaunot eCarsTrade saites"}
                  </IrissOverflowItem>
                </IrissOverflowMenu>
                <AdminMobileRoundBtn name="pievienot" primary label="Jauns ieraksts" href="/admin/iriss/scan/new" />
              </>
            }
          >
            <AdminMobileSearchField value={query} onChange={setQuery} placeholder="Meklēt marku..." />
          </AdminMobileTopBar>
        </div>
      ) : null}

      {showList ? (
        <header className="iriss-scan-toolbar mb-3 hidden md:block">
          <div className="flex items-center gap-2">
            <h1 className="shrink-0 text-[22px] font-bold tracking-tight text-[var(--ink)]">Radars</h1>
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink3)]" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Meklēt marku..."
                aria-label="Meklēt marku"
                className="h-10 w-full rounded-full border-0 bg-[var(--s1)] pl-9 pr-3 text-[14px] text-[var(--ink)] shadow-[var(--sh)] outline-none placeholder:text-[var(--ink3)]"
              />
            </label>
            <button
              type="button"
              onClick={() => void appendEcarstradeLinks()}
              disabled={ectBusy}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[var(--s1)] px-3 text-[13px] font-semibold text-[var(--ink)] shadow-[var(--sh)] disabled:opacity-40"
              title="Atjaunot eCarsTrade saites no Auto1 / Openlane / Autobid / Mobile filtriem"
            >
              <RefreshCw className={`h-4 w-4 ${ectBusy ? "animate-spin" : ""}`} aria-hidden />
              {ectBusy ? "ET..." : "Atjaunot eCarsTrade"}
            </button>
            <Link
              href="/admin/iriss/scan/new"
              className="inline-flex h-10 items-center rounded-full bg-[var(--chip-active-bg)] px-3 text-[13px] font-semibold text-[var(--chip-active-fg)]"
            >
              Jauns ieraksts
            </Link>
          </div>
          <p className="mt-1 text-[12px] text-[var(--ink3)]">
            {localRows.length} {localRows.length === 1 ? "ieraksts" : "ieraksti"} · {linkTotal} saites
            {query ? ` · atrasti ${visibleRows.length}` : ""}
            {ectMsg ? ` · ${ectMsg}` : ""}
          </p>
        </header>
      ) : null}

      <div className={showList && showEditor ? "grid items-start gap-4 md:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]" : ""}>
        {showList ? (
          <div>
            {listBody}
            {mode === "list" && !desktop ? (
              <div className="mt-5">
                <IrissScanFinds finds={liveFinds} onStatus={(card, status) => void setFindStatus(card, status)} />
              </div>
            ) : null}
          </div>
        ) : null}

        {showEditor && editorRecord ? (
          <div className="min-w-0 rounded-3xl bg-[var(--s1)] p-4 shadow-[var(--sh)] max-md:bg-transparent max-md:p-0 max-md:shadow-none">
            <IrissScanEditor
              key={`${unsavedDraft ? "new" : "edit"}:${editorRecord.id}`}
              initialRecord={editorRecord}
              unsavedDraft={unsavedDraft && editorRecord.id === selectedId}
              showBack={mode === "edit" && !desktop}
              newHits={irissScanNewHitsFor(editorRecord.id, hitsByScan)}
              finds={editorFinds}
              onRecordChange={onEditorRecordChange}
              onDeleted={onEditorDeleted}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
