"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { isLogisticsOrderArchived } from "@/lib/iriss-logistics-archive";
import {
  logisticsMapFitKey,
  logisticsOrderMapLabel,
  logisticsPreviousPointLabel,
} from "@/lib/iriss-logistics-labels";
import {
  applyLogisticsMapCamera,
  elementHasBox,
  readLogisticsMapCamera,
  waitForGoogleMapTilesIdle,
  type LogisticsMapCamera,
} from "@/lib/iriss-logistics-map-print";
import { cargoCssColor, formatLogisticsPostal, type CargoBucket } from "@/lib/iriss-logistics-cargo-plan";
import { clusterIsSameSpot, layoutMapPins, resolveLabelOverlaps } from "@/lib/iriss-logistics-map-cluster";
import type { LogisticsOrder, LogisticsPoint, LogisticsPreviousPointRow } from "@/lib/iriss-logistics-types";

type Gmaps = typeof google.maps;

/** Tipu definīcijās nav ControlPosition; izpildlaikā tas eksistē. */
function zoomTopRight(): number {
  return (window.google.maps as unknown as { ControlPosition: { RIGHT_TOP: number } }).ControlPosition.RIGHT_TOP;
}

type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  selected: boolean;
  archived?: boolean;
  printNumber?: number;
  cargo?: CargoBucket;
  statusLv?: string;
  auction?: string;
  showOnMap?: boolean;
  routeNumber?: number;
  carMake?: string;
  carModel?: string;
  postal?: string;
  centerName?: string;
};

function toMapPoints(
  mode: "cars" | "previous",
  orders: LogisticsOrder[],
  previous: LogisticsPreviousPointRow[],
  selectedIds: ReadonlySet<string>,
  extra?: {
    cargoByCarId?: ReadonlyMap<string, CargoBucket>;
    showOnMapIds?: ReadonlySet<string>;
    statusByCarId?: ReadonlyMap<string, string>;
    routeNumbers?: ReadonlyMap<string, number>;
  },
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
    .filter((o) => !extra?.showOnMapIds || extra.showOnMapIds.has(o.id))
    .map((o) => ({
      id: o.id,
      lat: o.pickupLat as number,
      lng: o.pickupLng as number,
      label: logisticsOrderMapLabel(o),
      selected: selectedIds.has(o.id),
      archived: isLogisticsOrderArchived(o),
      cargo: extra?.cargoByCarId?.get(o.id) ?? "none",
      statusLv: extra?.statusByCarId?.get(o.id) ?? "",
      auction: o.auction,
      showOnMap: extra?.showOnMapIds ? extra.showOnMapIds.has(o.id) : true,
      routeNumber: extra?.routeNumbers?.get(o.id),
      carMake: o.make.trim() || (o.title.trim().split(/\s+/)[0] ?? ""),
      carModel: o.model.trim() || o.title.trim().split(/\s+/).slice(1).join(" "),
      postal: formatLogisticsPostal(o.pickupSnapshot),
      centerName: o.pickupSnapshot?.name?.trim() ?? "",
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
  cargoByCarId?: ReadonlyMap<string, CargoBucket>;
  showOnMapIds?: ReadonlySet<string>;
  bounceCarId?: string | null;
  hoverCarId?: string | null;
  statusByCarId?: ReadonlyMap<string, string>;
  routeNumbers?: ReadonlyMap<string, number>;
  /** Maršruti, kas zīmēti tieši mūsu kartē (katrai kravai sava krāsa). */
  routePaths?: ReadonlyArray<{ path: ReadonlyArray<{ lat: number; lng: number }>; color: string }>;
  /** "Rādīt nosaukumus": katram punktam pastāvīga etiķete (marka, modelis, indekss, centrs). */
  showLabels?: boolean;
  routeEnds?: ReadonlyArray<{ lat: number; lng: number; kind: "start" | "end"; type?: string }>;
  pinVariant?: "default" | "cargo";
  onHoverCar?: (id: string | null) => void;
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
    cargoByCarId,
    showOnMapIds,
    bounceCarId,
    hoverCarId,
    statusByCarId,
    routeNumbers,
    routePaths,
    showLabels = false,
    routeEnds,
    pinVariant = "default",
    onHoverCar,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const overlaysRef = useRef<google.maps.OverlayView[]>([]);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const linesRef = useRef<Array<{ setMap: (map: google.maps.Map | null) => void }>>([]);
  const lastPtsRef = useRef<MapPoint[]>([]);
  /** Kamera (fitBounds) tikai pirmajā ielādē vai kad mainās punktu kopa. Hover un izcēlums skatu neaiztiek. */
  const lastFitKeyRef = useRef<string | null>(null);
  const lastFocusKeyRef = useRef<string | null>(null);
  /** Atvērtā vienas vietas grupas saraksts paliek atvērts arī tad, kad slānis pārzīmējas (hover). */
  const openClusterRef = useRef<string | null>(null);
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
        // + / − augšā labajā stūrī: pirkstu sasniedzams bez ritināšanas uz leju.
        zoomControl: true,
        zoomControlOptions: { position: zoomTopRight() },
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
    for (const l of linesRef.current) l.setMap(null);
    markersRef.current = [];
    overlaysRef.current = [];
    linesRef.current = [];
    const pts = toMapPoints(mode, orders, previous, selectedIds, {
      cargoByCarId,
      showOnMapIds,
      statusByCarId,
      routeNumbers,
    }).map((p) => ({
      ...p,
      printNumber: printNumbers?.get(p.id),
      selected: printNumbers ? printNumbers.has(p.id) : p.selected,
    }));
    lastPtsRef.current = pts;
    const bounds = new google.maps.LatLngBounds();
    // Drukā tās pašas lāses (ar drukas numuriem), lai papīrs izskatās tāpat kā ekrāns.
    const useCargoPins = pinVariant === "cargo" && mode === "cars";
    for (const p of pts) bounds.extend({ lat: p.lat, lng: p.lng });
    if (useCargoPins) {
      const layer = makeCargoLayerOverlay({
        map,
        pts,
        colorOf: (p) => PIN_COLOR[p.cargo ?? "none"],
        activeIds: new Set([bounceCarId, hoverCarId].filter((x): x is string => Boolean(x))),
        onSelect,
        onHover: onHoverCar,
        openKey: openClusterRef,
        showLabels,
      });
      layer.setMap(map);
      overlaysRef.current.push(layer);
      for (const end of routeEnds ?? []) {
        const overlay = makeRouteEndOverlay(end, cargoCssColor(hostRef.current, "none"));
        overlay.setMap(map);
        overlaysRef.current.push(overlay);
        bounds.extend({ lat: end.lat, lng: end.lng });
      }
      const PolylineCtor = (google.maps as unknown as { Polyline: new (opts: Record<string, unknown>) => { setMap: (map: google.maps.Map | null) => void } }).Polyline;
      for (const r of routePaths ?? []) {
        if (r.path.length < 2) continue;
        // Kā Google Maps: zila līnija ar tumšāku apmali.
        linesRef.current.push(new PolylineCtor({ map, path: r.path, strokeColor: ROUTE_LINE_BORDER, strokeOpacity: 1, strokeWeight: 5, zIndex: 1 }));
        linesRef.current.push(new PolylineCtor({ map, path: r.path, strokeColor: r.color, strokeOpacity: 1, strokeWeight: 3, zIndex: 2 }));
      }
    } else {
    for (const p of pts) {
      const pos = { lat: p.lat, lng: p.lng };
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
    }
    const fitKey = logisticsMapFitKey(mode, pts.map((p) => p.id));
    const focusKey = focus ? `${focus.lat},${focus.lng}` : null;
    const fitChanged = fitKey !== lastFitKeyRef.current;
    const focusChanged = focusKey !== lastFocusKeyRef.current;
    lastFitKeyRef.current = fitKey;
    lastFocusKeyRef.current = focusKey;
    if (!lockView && (fitChanged || (focusChanged && focus))) {
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
    map.setOptions({
      disableDefaultUI: lockView,
      zoomControl: !lockView,
      zoomControlOptions: { position: zoomTopRight() },
      gestureHandling: lockView ? "none" : "greedy",
    });
  }, [
    mode,
    orders,
    previous,
    selectedIds,
    focus,
    ready,
    onSelect,
    lockView,
    printNumbers,
    cargoByCarId,
    showOnMapIds,
    bounceCarId,
    hoverCarId,
    statusByCarId,
    routeNumbers,
    routePaths,
    showLabels,
    routeEnds,
    pinVariant,
    onHoverCar,
  ]);

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

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function pinTitle(p: MapPoint): string {
  return `${p.carMake ?? ""} ${p.carModel ?? ""}`.trim() || p.label;
}

/** Etiķetes otrā rinda: pasta indekss un loģistikas centrs. */
function pinPlace(p: MapPoint): string {
  return [p.postal, p.centerName].filter(Boolean).join(" · ");
}

function pinLabelHtml(members: MapPoint[]): string {
  const shown = members.slice(0, 3);
  const rows = shown
    .map((m) => {
      const place = pinPlace(m);
      return `<span class="t1">${escapeHtml(pinTitle(m))}</span>${place ? `<span class="t2">${escapeHtml(place)}</span>` : ""}`;
    })
    .join("");
  const more = members.length > shown.length ? `<span class="t2">+${members.length - shown.length} auto</span>` : "";
  return `<span class="iriss-log-pin-label">${rows}${more}</span>`;
}

/**
 * Viens slānis visiem auto punktiem. Pie katras tālummaiņas punkti, kas ekrānā ir tuvāk par 30 px,
 * saplūst grupā ar skaitu. Nosaukums parādās tikai, kad pele ir virs punkta vai auto ir izcelts.
 */
/** Google Maps maršruta līnijas apmale (zem zilās līnijas). */
const ROUTE_LINE_BORDER = "#1558b0";

/** Nosaukumu kartītes vienu zem otras, ja tās citādi pārklātos (mēra pēc ievietošanas DOM). */
function spreadLabels(root: HTMLElement) {
  const labels = [...root.querySelectorAll<HTMLElement>(".iriss-log-pin-label")];
  if (labels.length < 2) return;
  const base = root.getBoundingClientRect();
  const boxes = labels.map((l) => {
    l.style.transform = "";
    const r = l.getBoundingClientRect();
    return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
  });
  const dy = resolveLabelOverlaps(boxes);
  labels.forEach((l, i) => {
    if (!dy[i]) return;
    l.style.transform = `translateY(calc(-50% + ${dy[i]}px))`;
    l.classList.add("shifted");
  });
}

/** Kartes lāšu krāsas: Nākošā krava sarkana, Aiznākošā melna, pārējie pelēki (sakrīt ar kravu plāna punktiem). */
export const PIN_COLOR: Record<CargoBucket, string> = {
  next: "#ea4335",
  after: "#1d1d1f",
  none: "#9aa0a6",
};

/** Google stila lāse. `text` aplī (pieturas numurs) vai balts punkts. */
function teardropSvg(color: string, text: string, small: boolean): string {
  const w = small ? 22 : 30;
  const h = small ? 30 : 40;
  const inner = text
    ? `<text x="15" y="19.5" text-anchor="middle" font-size="${text.length > 1 ? 11 : 13}" font-weight="700" fill="#fff" font-family="Inter,Arial,sans-serif">${escapeHtml(text)}</text>`
    : `<circle cx="15" cy="15" r="4.6" fill="#fff"/>`;
  return `<svg class="iriss-log-tear-svg" width="${w}" height="${h}" viewBox="0 0 30 40" aria-hidden="true"><path d="M15 1.2C7.4 1.2 1.2 7.2 1.2 14.7 1.2 25 15 38.8 15 38.8S28.8 25 28.8 14.7C28.8 7.2 22.6 1.2 15 1.2z" fill="${color}" stroke="#fff" stroke-width="2"/>${inner}</svg>`;
}

/**
 * Viens slānis visiem auto punktiem (Google lāses):
 * - maršruta pieturas: sava lāse ar numuru; vienā adresē lāses izvērstas blakus ar līniju uz īsto punktu;
 * - pārējie auto: lāse bez numura; tuvi kopā ekrānā saplūst lāsē ar uzrakstu "N auto".
 */
function makeCargoLayerOverlay(input: {
  map: google.maps.Map;
  pts: MapPoint[];
  colorOf: (p: MapPoint) => string;
  activeIds: ReadonlySet<string>;
  onSelect: (id: string) => void;
  onHover?: (id: string | null) => void;
  openKey: { current: string | null };
  showLabels: boolean;
}): google.maps.OverlayView {
  const open = input.openKey;
  class Layer extends google.maps.OverlayView {
    root: HTMLDivElement | null = null;
    closeListener: google.maps.MapsEventListener | null = null;
    onAdd() {
      this.root = document.createElement("div");
      this.root.className = "iriss-log-pin-layer";
      this.getPanes()?.overlayMouseTarget.appendChild(this.root);
      this.closeListener = input.map.addListener("click", () => {
        if (!open.current) return;
        open.current = null;
        this.draw();
      });
    }
    draw() {
      const proj = this.getProjection();
      const root = this.root;
      if (!proj || !root) return;
      root.replaceChildren();
      const placed = input.pts.flatMap((p) => {
        const px = proj.fromLatLngToDivPixel(new google.maps.LatLng(p.lat, p.lng));
        return px ? [{ id: p.id, x: px.x, y: px.y, lat: p.lat, lng: p.lng, routeNumber: p.printNumber ?? p.routeNumber, p }] : [];
      });
      const tip = (p: MapPoint) =>
        `<span class="iriss-log-pin-tip"><b>${escapeHtml(pinTitle(p))}</b>${p.statusLv ? `<i>${escapeHtml(p.statusLv)}</i>` : ""}</span>`;
      const layout = layoutMapPins(placed, input.showLabels ? 14 : 30);
      // Vispirms līnijas uz īsto punktu (zem lāsēm).
      for (const item of layout) {
        if (item.kind !== "stop" || (item.dx === 0 && item.dy === 0)) continue;
        const line = document.createElement("div");
        line.className = "iriss-log-spread-line";
        const len = Math.hypot(item.dx, item.dy);
        line.style.left = `${item.anchorX}px`;
        line.style.top = `${item.anchorY}px`;
        line.style.width = `${len}px`;
        line.style.transform = `rotate(${Math.atan2(item.dy, item.dx)}rad)`;
        root.appendChild(line);
        const dot = document.createElement("div");
        dot.className = "iriss-log-spread-dot";
        dot.style.left = `${item.anchorX}px`;
        dot.style.top = `${item.anchorY}px`;
        root.appendChild(dot);
      }
      for (const item of layout) {
        const el = document.createElement("div");
        el.style.left = `${item.x}px`;
        el.style.top = `${item.y}px`;
        if (item.kind === "stop" || item.kind === "single") {
          const p = item.point.p;
          const active = input.activeIds.has(p.id);
          const none = (p.cargo ?? "none") === "none";
          el.className = `iriss-log-tear${active ? " active" : ""}${p.selected ? " selected" : ""}${none ? " small" : ""}`;
          el.innerHTML = `${teardropSvg(input.colorOf(p), item.kind === "stop" ? String(item.point.routeNumber) : "", none)}${
            input.showLabels ? pinLabelHtml([p]) : tip(p)
          }`;
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            input.onSelect(p.id);
          });
          el.addEventListener("mouseenter", () => input.onHover?.(p.id));
          el.addEventListener("mouseleave", () => input.onHover?.(null));
          root.appendChild(el);
          continue;
        }
        const members = item.members.map((m) => m.p);
        const key = members.map((m) => m.id).sort().join("|");
        const colors = new Set(members.map((m) => input.colorOf(m)));
        const color = colors.size === 1 ? [...colors][0]! : "#5f6368";
        const active = members.some((m) => input.activeIds.has(m.id));
        el.className = `iriss-log-tear group${active ? " active" : ""}`;
        const names = members.slice(0, 4).map((m) => `<b>${escapeHtml(pinTitle(m))}</b>`).join("");
        const more = members.length > 4 ? `<i>+${members.length - 4}</i>` : "";
        el.innerHTML = `${teardropSvg(color, "", false)}<span class="iriss-log-tear-count">${members.length} auto</span>${
          input.showLabels ? pinLabelHtml(members) : `<span class="iriss-log-pin-tip">${names}${more}</span>`
        }`;
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          if (clusterIsSameSpot(members)) {
            open.current = open.current === key ? null : key;
            this.draw();
            return;
          }
          const bounds = new google.maps.LatLngBounds();
          for (const m of members) bounds.extend({ lat: m.lat, lng: m.lng });
          input.map.fitBounds(bounds, 80);
        });
        if (open.current === key) {
          el.classList.add("open");
          const list = document.createElement("div");
          list.className = "iriss-log-pin-list";
          for (const m of members) {
            const row = document.createElement("button");
            row.type = "button";
            row.innerHTML = `<span class="iriss-log-pin-list-dot" style="background:${input.colorOf(m)}"></span><span>${escapeHtml(pinTitle(m))}</span>`;
            row.addEventListener("click", (e) => {
              e.stopPropagation();
              input.onSelect(m.id);
            });
            row.addEventListener("mouseenter", () => input.onHover?.(m.id));
            row.addEventListener("mouseleave", () => input.onHover?.(null));
            list.appendChild(row);
          }
          el.appendChild(list);
        }
        root.appendChild(el);
      }
      if (input.showLabels) spreadLabels(root);
    }
    onRemove() {
      this.closeListener?.remove();
      this.closeListener = null;
      this.root?.remove();
      this.root = null;
    }
  }
  return new Layer();
}

function makeRouteEndOverlay(
  end: { lat: number; lng: number; kind: "start" | "end"; type?: string },
  color: string,
): google.maps.OverlayView {
  const icon = end.type === "port" ? "⛴" : end.type === "border" ? "▣" : "●";
  class End extends google.maps.OverlayView {
    div: HTMLDivElement | null = null;
    onAdd() {
      this.div = document.createElement("div");
      this.div.className = "iriss-log-pin-wrap";
      this.div.innerHTML = `<div style="width:22px;height:22px;border-radius:999px;background:${color};color:#fff;display:grid;place-items:center;font-size:11px">${icon}</div>`;
      this.getPanes()?.overlayMouseTarget.appendChild(this.div);
    }
    draw() {
      const proj = this.getProjection();
      if (!proj || !this.div) return;
      const p = proj.fromLatLngToDivPixel(new google.maps.LatLng(end.lat, end.lng));
      if (!p) return;
      this.div.style.left = `${p.x}px`;
      this.div.style.top = `${p.y}px`;
    }
    onRemove() {
      this.div?.remove();
      this.div = null;
    }
  }
  return new End();
}

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

