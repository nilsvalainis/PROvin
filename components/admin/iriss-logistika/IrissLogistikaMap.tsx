"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { isLogisticsOrderArchived } from "@/lib/iriss-logistics-archive";
import { logisticsOrderMapLabel, logisticsPreviousPointLabel } from "@/lib/iriss-logistics-labels";
import {
  applyLogisticsMapCamera,
  elementHasBox,
  readLogisticsMapCamera,
  waitForGoogleMapTilesIdle,
  type LogisticsMapCamera,
} from "@/lib/iriss-logistics-map-print";
import type { LogisticsOrder, LogisticsPoint, LogisticsPreviousPointRow } from "@/lib/iriss-logistics-types";

type Gmaps = typeof google.maps;

type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  selected: boolean;
  archived?: boolean;
  printNumber?: number;
};

function toMapPoints(
  mode: "cars" | "previous",
  orders: LogisticsOrder[],
  previous: LogisticsPreviousPointRow[],
  selectedIds: ReadonlySet<string>,
): MapPoint[] {
  if (mode === "previous") {
    return previous
      .filter((p) => p.lat != null && p.lng != null)
      .map((p) => ({
        id: p.pointId,
        lat: p.lat as number,
        lng: p.lng as number,
        label: logisticsPreviousPointLabel(p),
        selected: selectedIds.has(p.pointId),
      }));
  }
  return orders
    .filter((o) => o.pickupLat != null && o.pickupLng != null)
    .map((o) => ({
      id: o.id,
      lat: o.pickupLat as number,
      lng: o.pickupLng as number,
      label: logisticsOrderMapLabel(o),
      selected: selectedIds.has(o.id),
      archived: isLogisticsOrderArchived(o),
    }));
}

type Props = {
  height: number;
  mode: "cars" | "previous";
  orders: LogisticsOrder[];
  points?: LogisticsPoint[];
  previous: LogisticsPreviousPointRow[];
  selectedIds: ReadonlySet<string>;
  focus?: { lat: number; lng: number } | null;
  onSelect: (id: string) => void;
  notice?: string;
  /** Drukā: neatlasa jaunu kadru (paliek pašreizējais zoom/centrs). */
  lockView?: boolean;
  /** Drukā: numurē atzīmētos punktus (pārējie paliek pelēki). */
  printNumbers?: ReadonlyMap<string, number>;
  /** Hero karte: augstumu nosaka CSS (aspect-ratio), ne fiksēti pikseļi. */
  fill?: boolean;
};

export type IrissLogistikaMapHandle = {
  snapshotView: () => LogisticsMapCamera | null;
  applyView: (camera: LogisticsMapCamera) => void;
  hostEl: () => HTMLDivElement | null;
  notifyResize: () => void;
  waitForTilesIdle: () => Promise<void>;
  fitVisible: (pad?: number) => void;
};

export const IrissLogistikaMap = forwardRef<IrissLogistikaMapHandle, Props>(function IrissLogistikaMap(
  {
    height,
    mode,
    orders,
    previous,
    selectedIds,
    focus,
    onSelect,
    notice,
    lockView = false,
    printNumbers,
    fill = false,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const overlaysRef = useRef<google.maps.OverlayView[]>([]);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const lastPtsRef = useRef<MapPoint[]>([]);
  const [limitNotice, setLimitNotice] = useState(notice ?? "");
  const [ready, setReady] = useState(false);

  useImperativeHandle(ref, () => ({
    snapshotView: () => {
      const map = mapRef.current;
      return map ? readLogisticsMapCamera(map) : null;
    },
    applyView: (camera) => {
      const map = mapRef.current;
      if (map) applyLogisticsMapCamera(map, camera);
    },
    hostEl: () => hostRef.current,
    notifyResize: () => {
      const map = mapRef.current;
      if (!map || !window.google?.maps?.event || !elementHasBox(hostRef.current)) return;
      google.maps.event.trigger(map, "resize");
    },
    waitForTilesIdle: () => {
      const map = mapRef.current;
      if (!map || !window.google?.maps?.event) return Promise.resolve();
      return waitForGoogleMapTilesIdle((event, fn) => {
        google.maps.event.addListenerOnce(map, event, fn);
      });
    },
    fitVisible: (pad = 36) => {
      const map = mapRef.current;
      const pts = lastPtsRef.current;
      if (!map || pts.length === 0) return;
      const picked = pts.filter((p) => p.selected);
      const use = picked.length > 0 ? picked : pts;
      if (use.length === 1) {
        map.setCenter({ lat: use[0]!.lat, lng: use[0]!.lng });
        map.setZoom(9);
        return;
      }
      const bounds = new google.maps.LatLngBounds();
      for (const p of use) bounds.extend({ lat: p.lat, lng: p.lng });
      map.fitBounds(bounds, pad);
    },
  }), []);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const res = await fetch("/api/admin/iriss-logistics/maps-config", {
        method: "POST",
        credentials: "include",
      });
      const body = (await res.json()) as { ok?: boolean; key?: string; notice?: string };
      if (cancelled) return;
      if (!body.ok || !body.key) {
        setLimitNotice(body.notice || "Karte nav pieejama.");
        return;
      }
      await loadGoogleMaps(body.key);
      if (cancelled || !hostRef.current || !window.google?.maps) return;
      mapRef.current = new google.maps.Map(hostRef.current, {
        mapTypeId: "roadmap",
        zoom: 6,
        center: { lat: 51.2, lng: 9.5 },
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        clickableIcons: false,
        gestureHandling: "greedy",
      });
      setReady(true);
    }
    void boot().catch(() => setLimitNotice("Kartes ielāde neizdevās."));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!ready || !host) return;
    const relayout = () => {
      const map = mapRef.current;
      if (!map || !window.google?.maps?.event || !elementHasBox(host)) return;
      google.maps.event.trigger(map, "resize");
    };
    relayout();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(relayout);
    observer.observe(host);
    return () => observer.disconnect();
  }, [ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const m of markersRef.current) m.setMap(null);
    for (const o of overlaysRef.current) o.setMap(null);
    markersRef.current = [];
    overlaysRef.current = [];
    const pts = toMapPoints(mode, orders, previous, selectedIds).map((p) => ({
      ...p,
      printNumber: printNumbers?.get(p.id),
      selected: printNumbers ? printNumbers.has(p.id) : p.selected,
    }));
    lastPtsRef.current = pts;
    const bounds = new google.maps.LatLngBounds();
    for (const p of pts) {
      const pos = { lat: p.lat, lng: p.lng };
      bounds.extend(pos);
      const numbered = p.printNumber != null;
      const marker = new google.maps.Marker({
        map,
        position: pos,
        clickable: true,
        opacity: p.archived ? 0.45 : 1,
        label: numbered
          ? { text: String(p.printNumber), color: "#fff", fontSize: "11px", fontWeight: "700" }
          : undefined,
        icon: p.selected || numbered
          ? {
              path: google.maps.SymbolPath.CIRCLE,
              scale: numbered ? 10 : 7,
              fillColor: "#3d5bd9",
              fillOpacity: 1,
              strokeColor: "#fff",
              strokeWeight: 2,
            }
          : {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 4,
              fillColor: "#9aa1ad",
              fillOpacity: 0.9,
              strokeWeight: 0,
            },
      });
      marker.addListener("click", () => onSelect(p.id));
      markersRef.current.push(marker);
      const overlay = makeLabelOverlay(p.label, pos, Boolean(p.selected || numbered), Boolean(p.archived));
      overlay.setMap(map);
      overlaysRef.current.push(overlay);
    }
    if (!lockView) {
      if (focus) {
        map.panTo(focus);
        if ((map.getZoom() ?? 7) < 9) map.setZoom(10);
      } else if (pts.length === 1) {
        map.setCenter({ lat: pts[0]!.lat, lng: pts[0]!.lng });
        map.setZoom(9);
      } else if (pts.length > 1) {
        map.fitBounds(bounds, 36);
      }
    }
    map.setOptions({ disableDefaultUI: lockView, zoomControl: !lockView, gestureHandling: lockView ? "none" : "greedy" });
  }, [mode, orders, previous, selectedIds, focus, ready, onSelect, lockView, printNumbers]);

  return (
    <div
      className={`iriss-log-map-shell relative overflow-hidden bg-[#d7dde6] ${fill ? "" : "rounded-[14px]"}`}
      style={fill ? undefined : { height }}
    >
      <div ref={hostRef} className="absolute inset-0" />
      {limitNotice ? (
        <div className="absolute inset-0 z-[1] flex items-center justify-center bg-[#d7dde6]/90 px-4 text-center text-[12.5px] leading-snug text-[#334155]">
          {limitNotice}
        </div>
      ) : null}
      <p className="pointer-events-none absolute bottom-1.5 right-2 z-[1] text-[10px] text-black/50">Google Maps</p>
    </div>
  );
});

function makeLabelOverlay(
  text: string,
  pos: google.maps.LatLngLiteral,
  selected: boolean,
  archived: boolean,
): google.maps.OverlayView {
  class Label extends google.maps.OverlayView {
    div: HTMLDivElement | null = null;
    constructor() {
      super();
    }
    onAdd() {
      this.div = document.createElement("div");
      this.div.className = `iriss-log-label ${selected ? "on" : "off"}`;
      this.div.textContent = text;
      this.div.style.opacity = archived ? "0.55" : "1";
      const panes = this.getPanes();
      panes?.overlayMouseTarget.appendChild(this.div);
    }
    draw() {
      const proj = this.getProjection();
      if (!proj || !this.div) return;
      const p = proj.fromLatLngToDivPixel(new google.maps.LatLng(pos.lat, pos.lng));
      if (!p) return;
      this.div.style.position = "absolute";
      this.div.style.left = `${p.x + 8}px`;
      this.div.style.top = `${p.y - 9}px`;
    }
    onRemove() {
      this.div?.remove();
      this.div = null;
    }
  }
  return new Label();
}

let mapsLoader: Promise<Gmaps> | null = null;

function loadGoogleMaps(key: string): Promise<Gmaps> {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (mapsLoader) return mapsLoader;
  mapsLoader = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-iriss-gmaps]");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google.maps));
      existing.addEventListener("error", () => reject(new Error("gmaps")));
      return;
    }
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&language=lv`;
    s.async = true;
    s.dataset.irissGmaps = "1";
    s.onload = () => resolve(window.google.maps);
    s.onerror = () => reject(new Error("gmaps"));
    document.head.appendChild(s);
  });
  return mapsLoader;
}

