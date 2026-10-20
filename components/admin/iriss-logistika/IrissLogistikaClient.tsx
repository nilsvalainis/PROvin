"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { IrissProjectIndicator } from "@/components/admin/IrissProjectIndicator";
import { IrissAuctionLogo } from "@/components/admin/iriss-logistika/IrissAuctionLogo";
import { IrissLogistikaAuctionSourcesPanel } from "@/components/admin/iriss-logistika/IrissLogistikaAuctionSourcesPanel";
import { IrissLogistikaCabinet } from "@/components/admin/iriss-logistika/IrissLogistikaCabinet";
import { IrissLogistikaMap, type IrissLogistikaMapHandle } from "@/components/admin/iriss-logistika/IrissLogistikaMap";
import { IrissLogistikaNewPurchase } from "@/components/admin/iriss-logistika/IrissLogistikaNewPurchase";
import { StatusFilterChip, StatusFilterChipRow } from "@/components/shared/StatusFilterChips";
import { filterLogisticsOrdersByView, isLogisticsOrderActive, isLogisticsOrderArchived } from "@/lib/iriss-logistics-archive";
import { logisticsGoogleMapsDirUrl, logisticsGoogleMapsPlaceUrl } from "@/lib/iriss-logistics-maps-dir";
import { logisticsOrderMapLabel } from "@/lib/iriss-logistics-labels";
import {
  LOGISTICS_PRINT_HTML_CLASS,
  LOGISTICS_PRINT_PAGE_CSS,
  logisticsOrdersForMapPrint,
  logisticsPrintLegendRows,
  logisticsPrintNumberMap,
  logisticsPrintSheetTitle,
  type LogisticsMapCamera,
} from "@/lib/iriss-logistics-map-print";
import {
  formatLogisticsAddress,
  formatLogisticsDate,
  formatLogisticsEur,
  LOGISTICS_AUCTIONS,
  LOGISTICS_DEFAULT_LIST_VIEW,
  LOGISTICS_LIST_VIEW_LV,
  LOGISTICS_ORDER_STATUS_LV,
  type LogisticsListView,
  type LogisticsAuctionSource,
  type LogisticsOrder,
  type LogisticsPoint,
  type LogisticsPreviousPointRow,
} from "@/lib/iriss-logistics-types";

type PageTab = "orders" | "points" | "settings";

type Props = {
  initialOrders: LogisticsOrder[];
  initialPoints: LogisticsPoint[];
  initialPrevious: LogisticsPreviousPointRow[];
  initialSources: LogisticsAuctionSource[];
  storeEnabled: boolean;
  viewerName?: string;
  canEnableTotp?: boolean;
};

export function IrissLogistikaClient({
  initialOrders,
  initialPoints,
  initialPrevious,
  initialSources,
  storeEnabled,
  viewerName,
  canEnableTotp,
}: Props) {
  const [orders, setOrders] = useState(initialOrders);
  const [points] = useState(initialPoints);
  const [previous] = useState(initialPrevious);
  const [pageTab, setPageTab] = useState<PageTab>("orders");
  const [view, setView] = useState<LogisticsListView>(LOGISTICS_DEFAULT_LIST_VIEW);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(
    initialOrders.find((o) => isLogisticsOrderActive(o))?.id ?? null,
  );
  const [showPrevious, setShowPrevious] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [pointId, setPointId] = useState<string | null>(initialPoints[0]?.id ?? null);
  const [preview, setPreview] = useState<{ lat: number; lng: number } | null>(null);
  const [pointQuery, setPointQuery] = useState("");
  const [printing, setPrinting] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const mapHandleRef = useRef<IrissLogistikaMapHandle>(null);
  const cameraBeforeFs = useRef<LogisticsMapCamera | null>(null);
  const mapFsCardRef = useRef<HTMLDivElement>(null);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const visibleOrders = useMemo(() => {
    const filtered = filterLogisticsOrdersByView(orders, view);
    const q = query.trim().toLowerCase();
    if (!q) return filtered;
    return filtered.filter((o) => `${o.title} ${o.make} ${o.model} ${o.vin} ${o.auction}`.toLowerCase().includes(q));
  }, [orders, view, query]);

  const active = orders.find((o) => o.id === activeId) ?? visibleOrders[0] ?? null;
  const counts = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      today: filterLogisticsOrdersByView(orders, "today", today).length,
      due: filterLogisticsOrdersByView(orders, "due", today).length,
      active: filterLogisticsOrdersByView(orders, "active").length,
      trips: 0,
      archive: filterLogisticsOrdersByView(orders, "archive").length,
    };
  }, [orders]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setActiveId(id);
  }, []);

  async function patchOrder(id: string, action: "wake" | "picked_up" | "delivered") {
    const res = await fetch(`/api/admin/iriss-logistics/orders/${encodeURIComponent(id)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const body = (await res.json()) as { order?: LogisticsOrder };
    if (!body.order) return;
    setOrders((prev) => prev.map((o) => (o.id === id ? body.order! : o)));
    if (action !== "wake") setView((v) => (v === "archive" ? v : "active"));
  }

  async function assignPoint(orderId: string, pickupPointId: string) {
    const res = await fetch(`/api/admin/iriss-logistics/orders/${encodeURIComponent(orderId)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pickupPointId }),
    });
    const body = (await res.json()) as { order?: LogisticsOrder };
    if (body.order) setOrders((prev) => prev.map((o) => (o.id === orderId ? body.order! : o)));
  }

  const dirUrl = useMemo(() => {
    const pts = selectedIds
      .map((id) => orders.find((o) => o.id === id))
      .filter((o): o is LogisticsOrder => Boolean(o && o.pickupLat != null && o.pickupLng != null))
      .map((o) => ({ lat: o.pickupLat as number, lng: o.pickupLng as number }));
    return logisticsGoogleMapsDirUrl(pts);
  }, [selectedIds, orders]);

  const groupedPoints = useMemo(() => {
    const q = pointQuery.trim().toLowerCase();
    const list = q
      ? points.filter((p) => `${p.name} ${p.city} ${p.auction} ${p.street}`.toLowerCase().includes(q))
      : points;
    return LOGISTICS_AUCTIONS.map((auction) => ({
      auction,
      rows: list.filter((p) => p.auction === auction),
    })).filter((g) => g.rows.length > 0);
  }, [points, pointQuery]);

  const selectedPoint = points.find((p) => p.id === pointId) ?? groupedPoints[0]?.rows[0] ?? null;
  const usedCount = (id: string) => orders.filter((o) => o.pickupPointId === id).length;
  const printOrders = useMemo(
    () => logisticsOrdersForMapPrint(visibleOrders, selectedSet),
    [visibleOrders, selectedSet],
  );
  const printLegend = useMemo(() => logisticsPrintLegendRows(printOrders), [printOrders]);
  const printNumbers = useMemo(() => logisticsPrintNumberMap(printOrders), [printOrders]);
  const printSheet = useMemo(
    () => logisticsPrintSheetTitle(new Date(), printOrders.length),
    [printOrders.length, printing],
  );
  const otherPrintCount = Math.max(0, visibleOrders.filter((o) => o.pickupLat != null && o.pickupLng != null).length - printOrders.length);

  useEffect(() => {
    document.documentElement.classList.toggle(LOGISTICS_PRINT_HTML_CLASS, printing);
    let pageStyle: HTMLStyleElement | null = null;
    if (printing) {
      pageStyle = document.createElement("style");
      pageStyle.setAttribute("data-iriss-log-print-page", "1");
      pageStyle.textContent = LOGISTICS_PRINT_PAGE_CSS;
      document.head.appendChild(pageStyle);
    }
    return () => {
      document.documentElement.classList.remove(LOGISTICS_PRINT_HTML_CLASS);
      pageStyle?.remove();
    };
  }, [printing]);

  useEffect(() => {
    function endPrint() {
      setPrinting(false);
    }
    window.addEventListener("afterprint", endPrint);
    return () => window.removeEventListener("afterprint", endPrint);
  }, []);

  useEffect(() => {
    if (!mapFullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMapFullscreen();
    };
    window.addEventListener("keydown", onKey);
    const frame = requestAnimationFrame(() => {
      mapFsCardRef.current?.focus();
      mapHandleRef.current?.notifyResize();
      mapHandleRef.current?.fitVisible();
    });
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      cancelAnimationFrame(frame);
    };
  }, [mapFullscreen]);

  function openMapFullscreen() {
    cameraBeforeFs.current = mapHandleRef.current?.snapshotView() ?? null;
    setMapFullscreen(true);
  }

  function closeMapFullscreen() {
    setMapFullscreen(false);
    requestAnimationFrame(() => {
      mapHandleRef.current?.notifyResize();
      if (cameraBeforeFs.current) mapHandleRef.current?.applyView(cameraBeforeFs.current);
    });
  }

  async function printCurrentMap() {
    if (printing) return;
    const handle = mapHandleRef.current;
    const view = handle?.snapshotView() ?? null;
    flushSync(() => setPrinting(true));
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    handle?.notifyResize();
    if (view) handle?.applyView(view);
    await handle?.waitForTilesIdle();
    void fetch("/api/admin/iriss/logistika/print", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    window.print();
  }

  if (!storeEnabled) {
    return (
      <div className="px-4 py-8 text-sm">
        Loģistikas krātuve nav pieejama. Iestatiet Blob vai ADMIN_IRISS_LOGISTICS_DIR.
      </div>
    );
  }

  return (
    <div className="iriss-log-screen px-3 pb-28 pt-3 md:px-4 md:pb-8">
      <header className="iriss-log-no-print md:static">
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-[22px] font-semibold tracking-tight md:text-[20px]">Loģistika</h1>
              <IrissProjectIndicator />
            </div>
            <p className="mt-0.5 text-[12px] text-[var(--ink2)]">
              {counts.active} aktīvi{counts.archive ? ` · ${counts.archive} arhīvā` : ""} · km
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[12px]">
              <button type="button" onClick={() => setPageTab("orders")} className={`rounded-full px-2.5 py-1 ${pageTab === "orders" ? "bg-white font-semibold shadow-sm" : "text-[var(--ink2)]"}`}>
                Pasūtījumi {counts.active}
              </button>
              <button type="button" onClick={() => setPageTab("points")} className={`rounded-full px-2.5 py-1 ${pageTab === "points" ? "bg-white font-semibold shadow-sm" : "text-[var(--ink2)]"}`}>
                Punktu datubāze {points.length}
              </button>
              <button type="button" onClick={() => setPageTab("settings")} className={`rounded-full px-2.5 py-1 ${pageTab === "settings" ? "bg-white font-semibold shadow-sm" : "text-[var(--ink2)]"}`}>
                Iestatījumi
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={pageTab === "points" ? pointQuery : query}
              onChange={(e) => (pageTab === "points" ? setPointQuery(e.target.value) : setQuery(e.target.value))}
              placeholder={pageTab === "points" ? "Meklēt punktu, pilsētu, izsoli" : "VIN, nosaukums, pickup nr."}
              className="hidden h-9 w-56 rounded-full border-0 bg-white px-3 text-[13px] shadow-sm md:block"
            />
            <button type="button" onClick={() => setPurchaseOpen(true)} className="inline-flex h-9 items-center rounded-full bg-[var(--ink)] px-3 text-[12.5px] font-semibold text-white">
              + Nopirkts
            </button>
          </div>
        </div>
        {pageTab === "orders" ? (
          <div className="mt-3">
            <StatusFilterChipRow layout="scroll" label="Loģistikas filtri">
              {(["today", "due", "active", "archive"] as const).map((key) => (
                <StatusFilterChip
                  key={key}
                  label={LOGISTICS_LIST_VIEW_LV[key]}
                  count={counts[key]}
                  pressed={view === key}
                  tone={key === "archive" ? "inactive" : key === "today" ? "searching" : "active"}
                  onClick={() => setView(key)}
                />
              ))}
            </StatusFilterChipRow>
          </div>
        ) : null}
      </header>

      {pageTab === "settings" ? (
        <div className="mt-3 max-w-3xl space-y-3">
          <IrissLogistikaAuctionSourcesPanel initialSources={initialSources} />
          {canEnableTotp ? <IrissLogistikaStaffTotp viewerName={viewerName ?? ""} /> : null}
        </div>
      ) : pageTab === "points" ? (
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(16rem,22rem)_1fr]">
          <div className="space-y-3">
            {groupedPoints.map((g) => (
              <section key={g.auction}>
                <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink3)]">
                  <IrissAuctionLogo name={g.auction} />
                  <span>· {g.rows.length}</span>
                </p>
                <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                  {g.rows.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPointId(p.id)}
                      className={`flex w-full items-start gap-2 border-b border-[#f3f4f6] px-3 py-2.5 text-left last:border-0 ${p.id === selectedPoint?.id ? "bg-[var(--acc-soft)]" : ""}`}
                    >
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--acc)]" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold">{p.name}</span>
                        <span className="block text-[12px] text-[var(--ink2)]">
                          {p.postcode} {p.city} {p.hoursText ? `· ${p.hoursText}` : ""}
                        </span>
                      </span>
                      <span className="text-[12px] tabular-nums text-[var(--ink3)]">{usedCount(p.id)}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
          {selectedPoint ? (
            <article className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-[18px] font-semibold">{selectedPoint.name}</h2>
                  <p className="text-[12px] text-[var(--ink2)]">{selectedPoint.auction}</p>
                </div>
                {selectedPoint.lat != null && selectedPoint.lng != null ? (
                  <a
                    className="inline-flex h-8 items-center rounded-full border border-[#e5e7eb] px-3 text-[12px] font-semibold"
                    href={logisticsGoogleMapsPlaceUrl(selectedPoint.lat, selectedPoint.lng)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Google Maps
                  </a>
                ) : null}
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <dl className="grid grid-cols-[6.5rem_1fr] gap-y-1 text-[13px]">
                  <dt className="text-[var(--ink2)]">Adrese</dt>
                  <dd>{formatLogisticsAddress(selectedPoint)}</dd>
                  <dt className="text-[var(--ink2)]">Darba laiks</dt>
                  <dd>{selectedPoint.hoursText || "jāprecizē"}</dd>
                  <dt className="text-[var(--ink2)]">Kontakts</dt>
                  <dd>{selectedPoint.contactName || "-"}</dd>
                  <dt className="text-[var(--ink2)]">Tālrunis</dt>
                  <dd>{selectedPoint.phone || "-"}</dd>
                  <dt className="text-[var(--ink2)]">E-pasts</dt>
                  <dd className="break-all">{selectedPoint.email || "-"}</dd>
                </dl>
                <IrissLogistikaMap
                  height={180}
                  mode="previous"
                  orders={[]}
                  previous={
                    selectedPoint.lat != null && selectedPoint.lng != null
                      ? [
                          {
                            pointId: selectedPoint.id,
                            name: selectedPoint.name,
                            auction: selectedPoint.auction,
                            city: selectedPoint.city,
                            lat: selectedPoint.lat,
                            lng: selectedPoint.lng,
                            useCount: usedCount(selectedPoint.id),
                            lastPickupDate: "",
                          },
                        ]
                      : []
                  }
                  selectedIds={new Set([selectedPoint.id])}
                  onSelect={() => undefined}
                />
              </div>
              {selectedPoint.notes ? <p className="mt-3 text-[12.5px] leading-snug text-[var(--ink2)]">{selectedPoint.notes}</p> : null}
              <p className="mt-3 text-[12px] text-[var(--ink3)]">Izmantots pasūtījumos · {usedCount(selectedPoint.id)}</p>
            </article>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
          <div className="min-w-0">
            {selectedIds.length > 0 ? (
              <div className="iriss-log-no-print mb-2 hidden items-center gap-2 rounded-2xl bg-white px-3 py-2 text-[12.5px] shadow-sm md:flex">
                <span className="font-semibold">Atzīmētas {selectedIds.length}</span>
                <button type="button" className="text-[var(--ink2)]" onClick={() => setSelectedIds([])}>
                  Notīrīt
                </button>
                <button type="button" className="ml-auto rounded-full border border-[#e5e7eb] px-3 py-1 font-semibold" onClick={() => void printCurrentMap()}>
                  Drukāt karti
                </button>
                {dirUrl ? (
                  <a href={dirUrl} target="_blank" rel="noreferrer" className="rounded-full bg-[var(--ink)] px-3 py-1 font-semibold text-white">
                    Sastādīt maršrutu
                  </a>
                ) : null}
              </div>
            ) : null}
            <div
              className={mapFullscreen ? "iriss-log-map-fs" : ""}
              onClick={mapFullscreen ? () => closeMapFullscreen() : undefined}
              role={mapFullscreen ? "presentation" : undefined}
            >
            <div
              ref={mapFsCardRef}
              tabIndex={mapFullscreen ? -1 : undefined}
              role={mapFullscreen ? "dialog" : undefined}
              aria-modal={mapFullscreen ? true : undefined}
              aria-label={mapFullscreen ? "Karte" : undefined}
              className={mapFullscreen ? "iriss-log-map-fs-card" : "overflow-hidden rounded-2xl bg-white shadow-sm"}
              onClick={mapFullscreen ? (e) => e.stopPropagation() : undefined}
            >
              <div className="iriss-log-no-print flex items-center justify-between gap-2 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink3)]">
                  Karte
                  {mapFullscreen ? (
                    <span className="ml-2 font-medium normal-case tracking-normal text-[var(--ink2)]">
                      {counts.active} aktīvi auto · {selectedIds.length} atzīmēti
                    </span>
                  ) : null}
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-pressed={showPrevious}
                    onClick={() => setShowPrevious((v) => !v)}
                    className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${showPrevious ? "bg-[var(--acc-soft)] text-[var(--acc)]" : "bg-[#f3f4f6]"}`}
                  >
                    Iepriekš izmantotie punkti
                  </button>
                  <button
                    type="button"
                    onClick={() => void printCurrentMap()}
                    className="rounded-full border border-[#e5e7eb] px-2.5 py-1 text-[12px] font-semibold"
                  >
                    Drukāt
                  </button>
                  {mapFullscreen ? (
                    <button type="button" aria-label="Aizvērt" onClick={() => closeMapFullscreen()} className="rounded-full border border-[#e5e7eb] px-2 py-1 text-[12px] font-semibold">
                      X
                    </button>
                  ) : (
                    <button type="button" onClick={() => openMapFullscreen()} className="rounded-full border border-[#e5e7eb] px-2.5 py-1 text-[12px] font-semibold">
                      Pilnekrāns
                    </button>
                  )}
                </div>
              </div>
              <div className="iriss-log-print-root px-2 pb-2">
                <div className="iriss-log-map-hero">
                  <div className="iriss-log-print-chrome pointer-events-none absolute left-2 right-2 top-2 z-[3] flex items-end justify-between gap-2 text-[11px] text-[#334155]">
                    <p className="font-semibold">{printSheet.heading}</p>
                    <p>{printSheet.meta}</p>
                  </div>
                  <IrissLogistikaMap
                    ref={mapHandleRef}
                    fill
                    height={420}
                    mode={printing || mapFullscreen ? "cars" : showPrevious ? "previous" : "cars"}
                    orders={showPrevious && !printing && !mapFullscreen ? [] : visibleOrders}
                    previous={previous}
                    selectedIds={selectedSet}
                    focus={printing ? null : preview}
                    lockView={printing}
                    printNumbers={printing ? printNumbers : undefined}
                    onSelect={(id) => {
                      if (showPrevious && !mapFullscreen) {
                        setPointId(id);
                        setPageTab("points");
                        return;
                      }
                      toggleSelect(id);
                    }}
                  />
                  <ul className="iriss-log-print-legend pointer-events-none absolute bottom-2 right-2 z-[3] flex flex-col gap-0.5 text-[10px] text-[#111]">
                    {printLegend.length === 0 ? (
                      <li>Nav punktu ar koordinātēm.</li>
                    ) : (
                      printLegend.map((row) => (
                        <li key={row.id}>
                          <span className="mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#3d5bd9] text-[9px] font-bold text-white">
                            {row.n}
                          </span>
                          {row.label}
                        </li>
                      ))
                    )}
                    {otherPrintCount > 0 ? <li className="text-[#6b7280]">pelēks punkts = citi aktīvie</li> : null}
                  </ul>
                </div>
              </div>
              {showPrevious ? (
                <ul className="iriss-log-no-print border-t border-[#f3f4f6] px-3 py-2 text-[13px]">
                  {previous.map((p) => (
                    <li key={p.pointId}>
                      <button type="button" className="flex w-full items-center gap-2 py-1.5 text-left" onClick={() => { setPointId(p.pointId); setPageTab("points"); }}>
                        <span className="min-w-0 flex-1 truncate">
                          {p.city || p.name}
                          {p.auction ? (
                            <>
                              {" · "}
                              <IrissAuctionLogo name={p.auction} />
                            </>
                          ) : null}
                        </span>
                        <span className="text-[12px] text-[var(--ink3)]">{p.lastPickupDate ? `pēd. ${formatLogisticsDate(p.lastPickupDate)}` : ""}</span>
                        <span className="tabular-nums text-[var(--ink2)]">{p.useCount}×</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            </div>
            <ul className="iriss-log-no-print mt-3 overflow-hidden rounded-2xl bg-white shadow-sm">
              {visibleOrders.map((o) => {
                const archived = isLogisticsOrderArchived(o);
                const href = o.auctionUrl || o.listingUrl;
                return (
                  <li
                    key={o.id}
                    className={`flex items-start gap-2 border-b border-[#f3f4f6] px-3 py-2.5 last:border-0 ${archived ? "opacity-55" : ""} ${o.id === active?.id ? "bg-[var(--acc-soft)]" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSet.has(o.id)}
                      onChange={() => toggleSelect(o.id)}
                      className="mt-1"
                      aria-label="Atzīmēt"
                    />
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setActiveId(o.id)}>
                      <span className="block text-[13.5px] font-semibold">{o.title || logisticsOrderMapLabel(o)}</span>
                      <span className="block font-mono text-[11px] text-[var(--ink3)]">{o.vin}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--ink2)]">
                        {o.auction ? <IrissAuctionLogo name={o.auction} /> : <span>Privāts</span>}
                        {href ? (
                          <a href={href} target="_blank" rel="noreferrer" className="font-semibold text-[var(--acc)]" onClick={(e) => e.stopPropagation()}>
                            {o.source === "private" ? "Sludinājums" : "Atvērt izsolē"}
                          </a>
                        ) : null}
                        <span>{o.statusNote || LOGISTICS_ORDER_STATUS_LV[o.status]}</span>
                      </span>
                      {o.nextAction ? <span className="mt-0.5 block text-[12px] text-[var(--ink2)]">→ {o.nextAction}</span> : null}
                    </button>
                    {archived ? (
                      <button
                        type="button"
                        className="shrink-0 rounded-full border border-[#e5e7eb] px-2.5 py-1 text-[12px] font-semibold"
                        onClick={() => void patchOrder(o.id, "wake")}
                      >
                        Pamodināt
                      </button>
                    ) : o.priceEur != null ? (
                      <span className="shrink-0 text-[12px] font-semibold text-[var(--acc)]">{formatLogisticsEur(o.priceEur)}</span>
                    ) : null}
                  </li>
                );
              })}
              {visibleOrders.length === 0 ? (
                <li className="px-3 py-6 text-center text-[13px] text-[var(--ink2)]">
                  {view === "archive" ? "Arhīvs ir tukšs." : "Nav aktīvu auto. Piegādātie ir arhīvā."}
                </li>
              ) : null}
            </ul>
          </div>
          {active ? (
            <IrissLogistikaCabinet
              order={active}
              groupedPoints={groupedPoints}
              onAssignPoint={(orderId, pickupPointId) => void assignPoint(orderId, pickupPointId)}
              onPatchOrder={(id, action) => void patchOrder(id, action)}
            />
          ) : null}
        </div>
      )}

      {selectedIds.length > 0 && pageTab === "orders" ? (
        <div className="iriss-log-no-print fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom,0px))] z-20 flex items-center gap-2 bg-[var(--bg-base)] px-3 py-2 md:hidden">
          <span className="text-[13px] font-semibold">{selectedIds.length} atzīmētas</span>
          <button type="button" className="ml-auto text-[13px]" onClick={() => void printCurrentMap()}>
            Drukāt
          </button>
          {dirUrl ? (
            <a href={dirUrl} target="_blank" rel="noreferrer" className="rounded-full bg-[var(--ink)] px-3 py-1.5 text-[13px] font-semibold text-white">
              Sastādīt maršrutu
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="iriss-log-no-print">
      <IrissLogistikaNewPurchase
        open={purchaseOpen}
        points={points}
        onClose={() => setPurchaseOpen(false)}
        onPreviewCoords={(lat, lng) => setPreview({ lat, lng })}
        onCreated={(order) => {
          setOrders((prev) => [order, ...prev]);
          setActiveId(order.id);
          setPurchaseOpen(false);
          setView("active");
        }}
      />
      </div>
    </div>
  );
}

function IrissLogistikaStaffTotp({ viewerName }: { viewerName: string }) {
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [notice, setNotice] = useState("");

  async function post(body: Record<string, string>) {
    return fetch("/api/admin/iriss/logistika/totp", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-[15px] font-semibold">2FA (pēc izvēles)</h2>
      <p className="mt-1 text-[13px] text-[var(--ink2)]">
        {viewerName ? `${viewerName}, ` : ""}Loģistikas lomā var ieslēgt 2FA šeit. Cenas un klienti paliek neredzami.
      </p>
      {totpSecret ? (
        <div className="mt-3 space-y-2">
          <p className="break-all font-mono text-[11px] text-[var(--ink2)]">{totpSecret}</p>
          <input
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value)}
            className="h-10 w-full rounded-xl border border-[#e5e7eb] px-3 text-[16px]"
            placeholder="6 ciparu kods"
            inputMode="numeric"
          />
          <button
            type="button"
            className="h-9 rounded-full bg-[var(--ink)] px-3 text-[12.5px] font-semibold text-white"
            onClick={async () => {
              const res = await post({ action: "confirm", code: totpCode });
              setNotice(res.ok ? "2FA ieslēgta." : "Kods nederīgs.");
            }}
          >
            Apstiprināt
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="mt-3 h-9 rounded-full border border-[#e5e7eb] px-3 text-[12.5px] font-semibold"
          onClick={async () => {
            const res = await post({ action: "start" });
            const data = (await res.json()) as { secret?: string };
            setTotpSecret(data.secret ?? null);
          }}
        >
          Ieslēgt 2FA
        </button>
      )}
      {notice ? <p className="mt-2 text-[12px] text-[var(--ink2)]">{notice}</p> : null}
    </section>
  );
}
