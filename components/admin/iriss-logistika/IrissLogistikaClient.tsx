"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { IrissProjectIndicator } from "@/components/admin/IrissProjectIndicator";
import { IrissAuctionLogo } from "@/components/admin/iriss-logistika/IrissAuctionLogo";
import { IrissLogistikaAuctionSourcesPanel } from "@/components/admin/iriss-logistika/IrissLogistikaAuctionSourcesPanel";
import { IrissLogistikaCabinet } from "@/components/admin/iriss-logistika/IrissLogistikaCabinet";
import { IrissLogistikaCarPopup } from "@/components/admin/iriss-logistika/IrissLogistikaCarPopup";
import { CabinetPhoneMapAndCard, LogisticsCarEndAction } from "@/components/admin/iriss-logistika/IrissLogistikaCarsTable";
import { autoparksSaitesHref } from "@/lib/iriss-car-share";
import { IrissLogistikaCargoPlan, type ManualCarInput } from "@/components/admin/iriss-logistika/IrissLogistikaCargoPlan";
import { IrissLogistikaMap, type IrissLogistikaMapHandle } from "@/components/admin/iriss-logistika/IrissLogistikaMap";
import { IrissLogistikaNewPurchase } from "@/components/admin/iriss-logistika/IrissLogistikaNewPurchase";
import { irissCreateOfferHref } from "@/components/admin/IrissCreateOfferButton";
import { IrissLogistikaPrintList } from "@/components/admin/iriss-logistika/IrissLogistikaPrintList";
import { AdminMobileChips, AdminMobileRoundBtn, AdminMobileSearchField, AdminMobileTopBar } from "@/components/admin/mobile/AdminMobileChrome";
import { IrissLogistikaRouteTemplatesPanel } from "@/components/admin/iriss-logistika/IrissLogistikaRouteTemplatesPanel";
import { StatusFilterChip, StatusFilterChipRow } from "@/components/shared/StatusFilterChips";
import { filterLogisticsOrdersByView, isLogisticsOrderActive, isLogisticsOrderArchived } from "@/lib/iriss-logistics-archive";
import { CABINET_PICKUP_STAGE_LV, type CabinetPickup, type CabinetPickupStage } from "@/lib/iriss-logistics-cabinet";
import {
  CARGO_BUCKET_LV,
  CARGO_COLOR_FALLBACK,
  addCargoVia,
  moveCargoVia,
  removeCargoVia,
  formatCargoDuration,
  formatCargoKm,
  cargoRoutePoints,
  cargoRoutePointsKey,
  carsInCargoBucket,
  emptyCargoPlan,
  normalizeCargoPath,
  moveCargoCar,
  setCargoShowOnMap,
  type CargoBucket,
  type CargoPlanState,
  type CargoRouteTemplate,
} from "@/lib/iriss-logistics-cargo-plan";
import { logisticsGoogleMapsDirUrl, logisticsGoogleMapsPlaceUrl } from "@/lib/iriss-logistics-maps-dir";
import { logisticsOrderMapLabel } from "@/lib/iriss-logistics-labels";
import { logisticsReadiness, READINESS_PREF_KEY, readinessPinColors, type ReadinessKind } from "@/lib/iriss-logistics-readiness";
import {
  LOGISTICS_PRINT_HTML_CLASS,
  LOGISTICS_PRINT_PAGE_CSS,
  isolateElementForPrint,
  logisticsPrintPlan,
  logisticsPrintSheetTitle,
  scheduleWhenElementHasBox,
  type LogisticsMapCamera,
} from "@/lib/iriss-logistics-map-print";
import {
  formatLogisticsAddress,
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
  /** Saite "Autoparks →" galvenē (tikai, ja Autoparks lomai atveras). */
  showAutoparksLink?: boolean;
  canCreateOffer?: boolean;
  /** Loģistikas ieraksts -> Autoparka auto (saite "Kartīte" kravu plānā). Tukšs, ja nav tiesību. */
  autoparksByOrder?: Record<string, string>;
};

const LABELS_PREF_KEY = "iriss.logistics.mapLabels";
/** Maršruta līnija kā Google Maps: zila; Aiznākošā gaišāk zila, lai abas var atšķirt. */
const PRINT_DUPLEX_PREF_KEY = "iriss-log-print-duplex-v1";

const ROUTE_LINE_COLOR = { next: "#1a73e8", after: "#7baaf7" } as const;
/** Pauze pēc pēdējās kravas izmaiņas, pirms maršruts pārrēķinās pats. */
const LIVE_ROUTE_DELAY_MS = 1500;
const FOCUS_PREF_KEY = "iriss.logistics.mapFocus";

type MapFocus = "all" | "next" | "after";

/** Cik ilgi punkts kartē lēkā pēc klikšķa uz rindas vai punkta. */
const LOGISTICS_BOUNCE_MS = 1600;

export function IrissLogistikaClient({
  initialOrders,
  initialPoints,
  initialPrevious,
  initialSources,
  storeEnabled,
  viewerName,
  canEnableTotp,
  canCreateOffer = false,
  showAutoparksLink = false,
  autoparksByOrder = {},
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
  const [showLabels, setShowLabels] = useState(false);
  /** «Gatavība» Nākošās kravas galvenē: noklusēti ieslēgts (makets 01), izvēli atceras pārlūks. */
  const [readinessOn, setReadinessOn] = useState(true);
  /** Abpusēja druka: 2. lapu apgriež par 180°, lai, apgriežot lapu pa garo malu, tā nav otrādi. */
  const [printDuplex, setPrintDuplex] = useState(false);
  useEffect(() => {
    try {
      setPrintDuplex(window.localStorage.getItem(PRINT_DUPLEX_PREF_KEY) === "1");
    } catch {
      // nav krātuves
    }
  }, []);
  /** Kartē tikai viens reiss: pārējo auto punkti netraucē skatīt maršrutu. */
  const [mapFocus, setMapFocus] = useState<MapFocus>("all");
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [pointId, setPointId] = useState<string | null>(initialPoints[0]?.id ?? null);
  const [preview, setPreview] = useState<{ lat: number; lng: number } | null>(null);
  const [pointQuery, setPointQuery] = useState("");
  const [printing, setPrinting] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [cargoPlan, setCargoPlan] = useState<CargoPlanState>(emptyCargoPlan());
  const [cargoTemplates, setCargoTemplates] = useState<CargoRouteTemplate[]>([]);
  const [cargoPickups, setCargoPickups] = useState<CabinetPickup[]>([]);
  const [, setCargoDocs] = useState<Record<string, { have: number; expected: number }>>({});
  const [pickupDocCarIds, setPickupDocCarIds] = useState<string[]>([]);
  const [bounceId, setBounceId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [popupId, setPopupId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const [cabinetOpen, setCabinetOpen] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const car = searchParams.get("car")?.trim() ?? "";
    if (!car) return;
    if (!orders.some((o) => o.id === car)) return;
    setActiveId(car);
    // No Autoparka kartītes ("Kartē"): iezīmē auto kartē; vecā saite bez view atver kabinetu.
    if (searchParams.get("view") === "map") {
      setPopupId(car);
      setBounceId(car);
      return;
    }
    setCabinetOpen(true);
  }, [orders, searchParams]);
  /** Maršruta poga: "Sastāda…" un kļūda tieši pie pogas, nevis lapas augšā. */
  const [routeUi, setRouteUi] = useState<Record<"next" | "after", { busy: boolean; notice: string }>>({
    next: { busy: false, notice: "" },
    after: { busy: false, notice: "" },
  });
  const [autoparkLink, setAutoparkLink] = useState<string | null>(null);
  const mapHandleRef = useRef<IrissLogistikaMapHandle>(null);
  const cameraBeforeFs = useRef<LogisticsMapCamera | null>(null);
  const mapFsCardRef = useRef<HTMLDivElement>(null);
  const printRootRef = useRef<HTMLDivElement>(null);
  const restorePrintRef = useRef<(() => void) | null>(null);
  /** Kartes kadrs pirms drukas: drukai zoom +1 (augstāka izšķirtspēja), pēc drukas atjauno. */
  const viewBeforePrintRef = useRef<ReturnType<NonNullable<typeof mapHandleRef.current>["snapshotView"]>>(null);
  const cabinetRef = useRef<HTMLDivElement>(null);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const bounceTimer = useRef<number | null>(null);
  /** Klikšķis tikai īsi parāda punktu kartē. Stāvoklis nepaliek, citādi ar hover lēkā divi punkti. */
  const pulseBounce = useCallback((id: string) => {
    if (bounceTimer.current != null) window.clearTimeout(bounceTimer.current);
    setBounceId(id);
    bounceTimer.current = window.setTimeout(() => {
      bounceTimer.current = null;
      setBounceId(null);
    }, LOGISTICS_BOUNCE_MS);
  }, []);
  useEffect(() => () => {
    if (bounceTimer.current != null) window.clearTimeout(bounceTimer.current);
  }, []);

  // Telefonā kabinets ir zem tabulas un kravu plāna - aizritinām līdz tam, lai pieskāriens rindai ir redzams.
  useEffect(() => {
    if (!cabinetOpen || !activeId) return;
    if (!window.matchMedia("(max-width: 1023px)").matches) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    cabinetRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [cabinetOpen, activeId]);

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

  useEffect(() => {
    void fetch("/api/admin/iriss-logistics/cargo-plan", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((body: {
        plan?: CargoPlanState;
        templates?: CargoRouteTemplate[];
        pickups?: CabinetPickup[];
        docCounts?: Record<string, { have: number; expected: number }>;
        pickupDocCarIds?: string[];
      }) => {
        if (body.plan) setCargoPlan(body.plan);
        setCargoTemplates(body.templates ?? []);
        setCargoPickups(body.pickups ?? []);
        setCargoDocs(body.docCounts ?? {});
        setPickupDocCarIds(body.pickupDocCarIds ?? []);
      })
      .catch(() => undefined);
  }, []);

  async function persistCargoPlan(next: CargoPlanState) {
    const before = cargoPlan;
    setCargoPlan(next);
    const res = await fetch("/api/admin/iriss-logistics/cargo-plan", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: next }),
    }).catch(() => null);
    if (!res?.ok) {
      setCargoPlan(before);
      setNotice("Kravu plānu neizdevās saglabāt. Mēģini vēlreiz.");
      return;
    }
    const body = (await res.json()) as {
      plan?: CargoPlanState;
      pickups?: CabinetPickup[];
      docCounts?: Record<string, { have: number; expected: number }>;
      templates?: CargoRouteTemplate[];
      pickupDocCarIds?: string[];
    };
    if (body.plan) setCargoPlan(body.plan);
    if (body.pickups) setCargoPickups(body.pickups);
    if (body.docCounts) setCargoDocs(body.docCounts);
    if (body.pickupDocCarIds) setPickupDocCarIds(body.pickupDocCarIds);
    if (body.templates) setCargoTemplates(body.templates);
  }

  /** Jaunākais plāns un pasūtījumi: aprēķina beigās pārbaudām, vai pa to laiku nekas nav mainījies. */
  const planRef = useRef(cargoPlan);
  planRef.current = cargoPlan;
  const ordersRef = useRef(orders);
  ordersRef.current = orders;
  const routeInflight = useRef<Record<"next" | "after", string>>({ next: "", after: "" });
  const routeFailedKey = useRef<Record<"next" | "after", string>>({ next: "", after: "" });

  /**
   * Maršruts mūsu kartē: Routes API līnija + km/laiks, saglabāti kravu plānā.
   * `auto`: dzīvais pārrēķins pēc izmaiņām (bez paziņojuma par trūkstošiem punktiem, karte nepārslēdzas).
   * Ja aprēķina laikā kravā kas mainījies, rezultātu neglabājam: nākamo aprēķinu palaiž efekts.
   */
  async function refreshCargoDirections(bucket: "next" | "after", base: CargoPlanState = planRef.current, opts: { auto?: boolean } = {}) {
    const points = cargoRoutePoints(base, bucket, ordersRef.current);
    if (points.length < 2) {
      if (!opts.auto) {
        setRouteUi((prev) => ({ ...prev, [bucket]: { busy: false, notice: "Maršrutam vajag vismaz 2 punktus ar adresi (sākums, auto, beigas)." } }));
      }
      return;
    }
    const key = cargoRoutePointsKey(points);
    routeInflight.current[bucket] = key;
    setRouteUi((prev) => ({ ...prev, [bucket]: { busy: true, notice: "" } }));
    if (!opts.auto) chooseMapFocus(bucket);
    const res = await fetch("/api/admin/iriss-logistics/directions", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points }),
    }).catch(() => null);
    const body = (res ? await res.json().catch(() => ({})) : {}) as {
      distanceKm?: number;
      durationMin?: number;
      path?: Array<{ lat: number; lng: number }>;
      notice?: string;
    };
    routeInflight.current[bucket] = "";
    if (body.distanceKm == null) {
      routeFailedKey.current[bucket] = key;
      setRouteUi((prev) => ({ ...prev, [bucket]: { busy: false, notice: body.notice || "Maršrutu neizdevās sastādīt." } }));
      return;
    }
    routeFailedKey.current[bucket] = "";
    setRouteUi((prev) => ({ ...prev, [bucket]: { busy: false, notice: "" } }));
    const latest = planRef.current;
    const latestKey = cargoRoutePointsKey(cargoRoutePoints(latest, bucket, ordersRef.current));
    if (latestKey !== key) return;
    const next: CargoPlanState = {
      ...latest,
      routes: {
        ...latest.routes,
        [bucket]: {
          ...latest.routes[bucket],
          distanceKm: body.distanceKm,
          durationMin: body.durationMin ?? null,
          path: normalizeCargoPath(body.path),
          pathKey: key,
        },
      },
    };
    await persistCargoPlan(next);
  }

  // Dzīvais maršruts: ja kravai ieslēgts "Maršruts" un mainās auto, secība, sākums vai beigas,
  // līnija pārrēķinās pati ~1,5 s pēc pēdējās izmaiņas (ātra vilkšana = viens aprēķins).
  useEffect(() => {
    const timers: number[] = [];
    for (const bucket of ["next", "after"] as const) {
      const route = cargoPlan.routes[bucket];
      if (!route.enabled) continue;
      const points = cargoRoutePoints(cargoPlan, bucket, orders);
      if (points.length < 2) continue;
      const key = cargoRoutePointsKey(points);
      if (key === route.pathKey || key === routeInflight.current[bucket] || key === routeFailedKey.current[bucket]) continue;
      timers.push(window.setTimeout(() => void refreshCargoDirections(bucket, planRef.current, { auto: true }), LIVE_ROUTE_DELAY_MS));
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tikai plāna/pasūtījumu izmaiņas palaiž pārrēķinu
  }, [cargoPlan, orders]);

  // "Rādīt nosaukumus" atceras katrs lietotājs savā pārlūkā.
  useEffect(() => {
    try {
      setShowLabels(window.localStorage.getItem(LABELS_PREF_KEY) === "1");
      setReadinessOn(window.localStorage.getItem(READINESS_PREF_KEY) !== "0");
    } catch {
      // privāts režīms: paliek noklusējums
    }
  }, []);

  useEffect(() => {
    try {
      const v = window.localStorage.getItem(FOCUS_PREF_KEY);
      if (v === "next" || v === "after") setMapFocus(v);
    } catch {
      // nav krātuves
    }
  }, []);

  function chooseMapFocus(next: MapFocus) {
    setMapFocus(next);
    try {
      window.localStorage.setItem(FOCUS_PREF_KEY, next);
    } catch {
      // nav krātuves
    }
  }

  function togglePrintDuplex() {
    setPrintDuplex((v) => {
      try {
        window.localStorage.setItem(PRINT_DUPLEX_PREF_KEY, v ? "0" : "1");
      } catch {
        // nav krātuves
      }
      return !v;
    });
  }

  function toggleReadiness() {
    setReadinessOn((v) => {
      try {
        window.localStorage.setItem(READINESS_PREF_KEY, v ? "0" : "1");
      } catch {
        // nav krātuves
      }
      return !v;
    });
  }

  function toggleLabels() {
    setShowLabels((v) => {
      try {
        window.localStorage.setItem(LABELS_PREF_KEY, v ? "0" : "1");
      } catch {
        // nav krātuves
      }
      return !v;
    });
  }

  /** Statuss ar vienu klikšķi: uzreiz redzams, ja serveris atsaka - atgriežas. */
  async function moveToAutopark(orderId: string) {
    const res = await fetch("/api/admin/iriss-logistics/autoparks", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromOrderId: orderId }),
    }).catch(() => null);
    if (!res?.ok) {
      setNotice("Neizdevās pārvietot uz Autoparku.");
      return;
    }
    const body = (await res.json()) as { order?: LogisticsOrder; car?: { id: string } };
    if (body.order) setOrders((prev) => prev.map((o) => (o.id === orderId ? body.order! : o)));
    setNotice(body.car ? "Auto ir Autoparkā." : "");
    if (body.car) setAutoparkLink(`/admin/iriss/autoparks?auto=${encodeURIComponent(body.car.id)}`);
  }

  async function reloadTemplates() {
    const res = await fetch("/api/admin/iriss-logistics/route-templates", { credentials: "include", cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const body = (await res.json()) as { templates?: CargoRouteTemplate[] };
    if (body.templates) setCargoTemplates(body.templates);
  }

  /** Citu klientu auto ar roku: uzreiz kartē un izvēlētajā kravā. */
  async function addManualCar(bucket: CargoBucket, input: ManualCarInput): Promise<boolean> {
    const res = await fetch("/api/admin/iriss-logistics/orders", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "manual",
        make: input.make,
        model: input.model,
        title: `${input.make} ${input.model}`.trim(),
        sellerContact: input.client,
        notes: input.client,
        pickupAddress: input.address,
        pickupLat: input.lat,
        pickupLng: input.lng,
        geocodeStatus: "ok",
        status: "organize_pickup",
      }),
    }).catch(() => null);
    if (!res?.ok) return false;
    const body = (await res.json()) as { order?: LogisticsOrder };
    const order = body.order;
    if (!order) return false;
    setOrders((prev) => [order, ...prev]);
    await persistCargoPlan(moveCargoCar(cargoPlan, order.id, bucket));
    return true;
  }

  async function deleteManualCar(id: string) {
    const res = await fetch(`/api/admin/iriss-logistics/orders/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" }).catch(() => null);
    if (!res?.ok) {
      setNotice("Neizdevās dzēst.");
      return;
    }
    setOrders((prev) => prev.filter((o) => o.id !== id));
    setCargoPlan((prev) => ({ ...prev, cars: prev.cars.filter((c) => c.carId !== id) }));
    setSelectedIds((prev) => prev.filter((x) => x !== id));
    if (popupId === id) setPopupId(null);
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

  const cargoByCarId = useMemo(() => {
    const m = new Map<string, CargoBucket>();
    for (const row of cargoPlan.cars) m.set(row.carId, row.bucket);
    return m;
  }, [cargoPlan]);
  const showOnMapIds = useMemo(() => new Set(cargoPlan.cars.filter((c) => c.showOnMap).map((c) => c.carId)), [cargoPlan]);
  const statusByCarId = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of cargoPickups) m.set(p.carId, CABINET_PICKUP_STAGE_LV[p.stage]);
    return m;
  }, [cargoPickups]);
  /** Rindas posma žetons visiem auto (bez pickup ieraksta - "Gaida", kā agrāk tabulā "Visi auto"). */
  const stageLabelByCarId = useMemo(() => {
    const stages = new Map(cargoPickups.map((p) => [p.carId, p.stage]));
    return Object.fromEntries(orders.map((o) => [o.id, CABINET_PICKUP_STAGE_LV[stages.get(o.id) ?? "waiting"]]));
  }, [orders, cargoPickups]);
  /** Gatavība tikai Nākošās kravas auto; pārējiem paliek viļņa krāsa. */
  const readinessByCarId = useMemo(() => {
    const m = new Map<string, ReadinessKind>();
    const docs = new Set(pickupDocCarIds);
    const codes = new Map(cargoPickups.map((p) => [p.carId, p.pickupCode]));
    const byId = new Map(orders.map((o) => [o.id, o]));
    for (const c of carsInCargoBucket(cargoPlan, "next")) {
      const order = byId.get(c.carId);
      if (!order) continue;
      m.set(c.carId, logisticsReadiness({ order, hasPickupDoc: docs.has(c.carId), pickupCode: codes.get(c.carId) }));
    }
    return m;
  }, [cargoPlan, orders, cargoPickups, pickupDocCarIds]);
  const pinColorByCarId = useMemo(
    () => readinessPinColors(readinessOn, readinessByCarId, cargoByCarId),
    [readinessByCarId, readinessOn, cargoByCarId],
  );
  const routeNumbers = useMemo(() => {
    const m = new Map<string, number>();
    for (const bucket of ["next", "after"] as const) {
      if (!cargoPlan.routes[bucket].enabled) continue;
      carsInCargoBucket(cargoPlan, bucket).forEach((c, i) => m.set(c.carId, i + 1));
    }
    return m;
  }, [cargoPlan]);
  /** Katras ieslēgtās kravas maršruts kartē savā krāsā. */
  /** Reisi, kurus kartē rādīt: viens izvēlētais vai visi ieslēgtie maršruti. */
  const focusBuckets = useMemo(
    () => (mapFocus === "all" ? (["next", "after"] as const).filter((b) => cargoPlan.routes[b].enabled) : [mapFocus]),
    [mapFocus, cargoPlan],
  );
  const routePaths = useMemo(
    () =>
      focusBuckets
        .filter((b) => cargoPlan.routes[b].enabled && cargoPlan.routes[b].path.length > 1)
        .map((b) => ({ path: cargoPlan.routes[b].path, color: ROUTE_LINE_COLOR[b], bucket: b, via: cargoPlan.routes[b].via })),
    [cargoPlan, focusBuckets],
  );
  const routeEnds = useMemo(() => {
    const ends: Array<{ lat: number; lng: number; kind: "start" | "end"; type?: string }> = [];
    for (const b of focusBuckets) {
      const r = cargoPlan.routes[b];
      if (!r.enabled) continue;
      if (r.start) ends.push({ lat: r.start.lat, lng: r.start.lng, kind: "start", type: r.start.type });
      if (r.end) ends.push({ lat: r.end.lat, lng: r.end.lng, kind: "end", type: r.end.type });
    }
    return ends;
  }, [cargoPlan, focusBuckets]);
  /** Kartes punkti: izvēlētajā reisā tikai tā kravas auto. */
  const mapOrders = useMemo(
    () => (mapFocus === "all" ? visibleOrders : visibleOrders.filter((o) => (cargoByCarId.get(o.id) ?? "none") === mapFocus)),
    [mapFocus, visibleOrders, cargoByCarId],
  );
  const bucketCounts = useMemo(() => {
    const out = { next: 0, after: 0 };
    for (const o of visibleOrders) {
      const b = cargoByCarId.get(o.id);
      if (b === "next" || b === "after") out[b] += 1;
    }
    return out;
  }, [visibleOrders, cargoByCarId]);
  const popupOrder = orders.find((o) => o.id === popupId) ?? null;
  const popupStage = (cargoPickups.find((p) => p.carId === popupId)?.stage ?? "waiting") as CabinetPickupStage;

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
  /** Drukā tieši ekrāna skatu: izvēlētais reiss (maršruta secībā) vai visi kartes auto pa kravām. */
  const printPlan = useMemo(() => {
    const routeOrder = (mapFocus === "all" ? (["next", "after", "none"] as const) : [mapFocus]).flatMap((b) =>
      carsInCargoBucket(cargoPlan, b).map((c) => c.carId),
    );
    const visible = mapOrders.filter((o) => showOnMapIds.has(o.id) || !cargoPlan.cars.some((c) => c.carId === o.id));
    return logisticsPrintPlan({
      mapOrders: visible,
      selectedIds: selectedSet,
      routeOrder,
      cargoLabelOf: (id) => CARGO_BUCKET_LV[cargoByCarId.get(id) ?? "none"],
    });
  }, [mapFocus, cargoPlan, mapOrders, showOnMapIds, selectedSet, cargoByCarId]);
  const printOrders = useMemo(() => {
    const ids = new Set(printPlan.rows.map((r) => r.id));
    return mapOrders.filter((o) => ids.has(o.id));
  }, [printPlan, mapOrders]);
  const printNumbers = printPlan.numbers;
  const printSheet = useMemo(() => {
    const t = logisticsPrintSheetTitle(new Date(), printPlan.rows.length);
    const trip = mapFocus === "all" ? "Visi auto" : CARGO_BUCKET_LV[mapFocus];
    const route = mapFocus === "all" ? null : cargoPlan.routes[mapFocus];
    const km = route?.enabled && route.distanceKm != null ? ` · ${formatCargoKm(route.distanceKm)}${route.durationMin != null ? `, ${formatCargoDuration(route.durationMin)}` : ""}` : "";
    return { heading: `IRISS Loģistika · ${trip}${km}`, meta: t.meta.replace("atzīmēti punkti", "auto") };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- laiks drukas brīdī
  }, [printPlan, mapFocus, cargoPlan, printing]);

  useEffect(() => {
    document.documentElement.classList.toggle(LOGISTICS_PRINT_HTML_CLASS, printing);
    let pageStyle: HTMLStyleElement | null = null;
    if (printing) {
      document.documentElement.classList.toggle("iriss-log-print-duplex", printDuplex);
      pageStyle = document.createElement("style");
      pageStyle.setAttribute("data-iriss-log-print-page", "1");
      pageStyle.textContent = LOGISTICS_PRINT_PAGE_CSS;
      document.head.appendChild(pageStyle);
    }
    return () => {
      document.documentElement.classList.remove(LOGISTICS_PRINT_HTML_CLASS);
      document.documentElement.classList.remove("iriss-log-print-duplex");
      pageStyle?.remove();
    };
  }, [printing, printDuplex]);

  useEffect(() => {
    function endPrint() {
      restorePrintRef.current?.();
      restorePrintRef.current = null;
      setPrinting(false);
      const view = viewBeforePrintRef.current;
      viewBeforePrintRef.current = null;
      if (view) {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            mapHandleRef.current?.notifyResize();
            mapHandleRef.current?.applyView(view);
          }),
        );
      }
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
    const stopWait = scheduleWhenElementHasBox(
      () => mapHandleRef.current?.hostEl() ?? mapFsCardRef.current,
      () => {
        mapFsCardRef.current?.focus();
        mapHandleRef.current?.notifyResize();
        mapHandleRef.current?.fitVisible();
      },
    );
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      stopWait();
    };
  }, [mapFullscreen]);

  function openMapFullscreen() {
    cameraBeforeFs.current = mapHandleRef.current?.snapshotView() ?? null;
    setMapFullscreen(true);
  }

  function closeMapFullscreen() {
    setMapFullscreen(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        mapHandleRef.current?.notifyResize();
        if (cameraBeforeFs.current) mapHandleRef.current?.applyView(cameraBeforeFs.current);
      });
    });
  }

  async function printCurrentMap() {
    if (printing) return;
    const handle = mapHandleRef.current;
    const view = handle?.snapshotView() ?? null;
    flushSync(() => setPrinting(true));
    if (printRootRef.current) restorePrintRef.current = isolateElementForPrint(printRootRef.current);
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    handle?.notifyResize();
    // Drukā karte ir divreiz lielāka un samazināta uz pusi: tas pats laukums, bet zoom +1 = divreiz asāka.
    viewBeforePrintRef.current = view;
    if (view) handle?.applyView({ ...view, zoom: view.zoom + 1 });
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
    // Nils 27.10 (makets A): datorā (≥1024 px) Auto cilnē karte ir visas lapas fons, viss pārējais peld virs tās (CSS .iriss-log-desk).
    <div className={`iriss-log-screen px-3 pb-28 pt-3 max-md:px-0 md:px-4 md:pb-8 ${pageTab === "orders" && !mapFullscreen ? "iriss-log-desk" : ""}`}>
      <div className="iriss-log-no-print md:hidden">
        <AdminMobileTopBar
          title="Loģistika"
          trailing={
            <>
              {canCreateOffer ? <AdminMobileRoundBtn name="pdf" label="Jauns piedāvājums" href={irissCreateOfferHref()} /> : null}
              <AdminMobileRoundBtn name="pievienot" primary label="Nopirkts" onClick={() => setPurchaseOpen(true)} />
            </>
          }
        >
          <AdminMobileSearchField
            value={pageTab === "points" ? pointQuery : query}
            onChange={pageTab === "points" ? setPointQuery : setQuery}
            placeholder={pageTab === "points" ? "Meklēt punktu, pilsētu" : "VIN, nosaukums, pickup"}
          />
          <AdminMobileChips
            value={pageTab}
            onChange={(id) => setPageTab(id as PageTab)}
            items={[
              { id: "orders", label: "Auto", count: counts.active },
              { id: "points", label: "Vietas", count: points.length },
              { id: "settings", label: "Iestatījumi" },
            ]}
          />
        </AdminMobileTopBar>
        {pageTab === "orders" ? (
          <div className="mt-2 px-4">
            <StatusFilterChipRow layout="scroll" label="Loģistikas filtri">
              {/* Nils 27.10: «Visi auto» un «Termiņš»; Arhīvs ikdienā nav vajadzīgs - tas ir Iestatījumos. */}
              {(view === "archive" ? (["active", "due", "archive"] as const) : (["active", "due"] as const)).map((key) => (
                <StatusFilterChip
                  key={key}
                  label={LOGISTICS_LIST_VIEW_LV[key]}
                  count={counts[key]}
                  pressed={view === key}
                  tone={key === "archive" ? "inactive" : key === "due" ? "searching" : "active"}
                  onClick={() => setView(key)}
                />
              ))}
            </StatusFilterChipRow>
          </div>
        ) : null}
      </div>
      {notice ? (
        <div className="iriss-log-no-print mx-3 mt-2 flex items-center gap-2 rounded-[12px] bg-white px-3 py-2 text-[13px] shadow-sm max-md:mx-4" role="status">
          <span className="min-w-0 flex-1">{notice}</span>
          {autoparkLink ? (
            <a href={autoparkLink} className="font-semibold text-[var(--iriss-log-focus)]">
              Atvērt Autoparkā
            </a>
          ) : null}
          <button type="button" aria-label="Aizvērt" className="px-1 text-[var(--iriss-ink-2)]" onClick={() => { setNotice(""); setAutoparkLink(null); }}>
            ✕
          </button>
        </div>
      ) : null}
      <header className="iriss-log-no-print hidden md:static md:block iriss-log-head">
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-[22px] font-semibold tracking-tight md:text-[20px]">Loģistika</h1>
              <IrissProjectIndicator />
            </div>
            <p className="mt-0.5 text-[12px] text-[var(--ink2)]">
              {counts.active} aktīvi{counts.archive ? ` · ${counts.archive} arhīvā` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[12px]">
              <button type="button" onClick={() => setPageTab("orders")} className={`rounded-full px-2.5 py-1 ${pageTab === "orders" ? "bg-white font-semibold shadow-sm" : "text-[var(--ink2)]"}`}>
                Auto {counts.active}
              </button>
              <button type="button" onClick={() => setPageTab("points")} className={`rounded-full px-2.5 py-1 ${pageTab === "points" ? "bg-white font-semibold shadow-sm" : "text-[var(--ink2)]"}`}>
                Savākšanas vietas {points.length}
              </button>
              <button type="button" onClick={() => setPageTab("settings")} className={`rounded-full px-2.5 py-1 ${pageTab === "settings" ? "bg-white font-semibold shadow-sm" : "text-[var(--ink2)]"}`}>
                Iestatījumi
              </button>
              {showAutoparksLink ? (
                <Link href="/admin/iriss/autoparks-v2" className="rounded-full px-2.5 py-1 font-semibold text-[var(--iriss-ink)] hover:bg-white">
                  Autoparks →
                </Link>
              ) : null}
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
            {/* Viena galvenā poga (dizains v0.3): piedāvājumu veido no auto kartītes, ne no galvenes. */}
            <button type="button" onClick={() => setPurchaseOpen(true)} className="inline-flex h-9 items-center rounded-full bg-[var(--iriss-brand)] px-3.5 text-[13px] font-bold text-white hover:bg-[#d9541a]">
              + Nopirkts
            </button>
          </div>
        </div>
        {pageTab === "orders" ? (
          <div className="mt-3 max-md:px-4">
            <StatusFilterChipRow layout="scroll" label="Loģistikas filtri">
              {/* Nils 27.10: «Visi auto» un «Termiņš»; Arhīvs ikdienā nav vajadzīgs - tas ir Iestatījumos. */}
              {(view === "archive" ? (["active", "due", "archive"] as const) : (["active", "due"] as const)).map((key) => (
                <StatusFilterChip
                  key={key}
                  label={LOGISTICS_LIST_VIEW_LV[key]}
                  count={counts[key]}
                  pressed={view === key}
                  tone={key === "archive" ? "inactive" : key === "due" ? "searching" : "active"}
                  onClick={() => setView(key)}
                />
              ))}
            </StatusFilterChipRow>
          </div>
        ) : null}
      </header>

      {pageTab === "settings" ? (
        <div className="mt-3 max-w-3xl space-y-3 max-md:px-4">
          {/* Arhīvs (atvestie un noņemtie) ikdienā nav vajadzīgs - pieejams šeit (Nils 27.10). */}
          <button
            type="button"
            onClick={() => {
              setPageTab("orders");
              setView("archive");
            }}
            className="flex min-h-11 w-full items-center justify-between rounded-2xl bg-white px-4 text-left text-[14px] font-medium text-[var(--iriss-ink)] shadow-sm"
          >
            <span>Arhīvs <span className="text-[var(--iriss-ink-3)]">{counts.archive}</span></span>
            <span aria-hidden className="text-[var(--iriss-ink-3)]">›</span>
          </button>
          <IrissLogistikaAuctionSourcesPanel initialSources={initialSources} />
          <IrissLogistikaRouteTemplatesPanel />
          {canEnableTotp ? <IrissLogistikaStaffTotp viewerName={viewerName ?? ""} /> : null}
        </div>
      ) : pageTab === "points" ? (
        <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-3 max-md:px-4 lg:grid-cols-[minmax(16rem,22rem)_1fr]">
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
                      className={`flex min-h-11 w-full items-start gap-2 border-b border-[#f3f4f6] px-3 py-2.5 text-left last:border-0 ${p.id === selectedPoint?.id ? "bg-[var(--acc-soft)]" : ""}`}
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
                    className="inline-flex h-8 items-center rounded-full border border-[var(--iriss-line)] px-3 text-[12px] font-semibold"
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
        <div className="iriss-log-desk-grid mt-3 grid grid-cols-[minmax(0,1fr)] items-start gap-3 max-md:px-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(22rem,1fr)]">
          <div className="iriss-log-desk-map min-w-0">
            {selectedIds.length > 0 ? (
              <div className="iriss-log-no-print iriss-log-desk-selbar mb-2 hidden items-center gap-2 rounded-2xl bg-white px-3 py-2 text-[12.5px] shadow-sm md:flex">
                <span className="font-semibold">Atzīmētas {selectedIds.length}</span>
                <button type="button" className="text-[var(--ink2)]" onClick={() => setSelectedIds([])}>
                  Notīrīt
                </button>
                <button type="button" className="ml-auto rounded-full border border-[var(--iriss-line)] px-3 py-1 font-semibold" onClick={() => void printCurrentMap()}>
                  Drukāt karti
                </button>
                {dirUrl ? (
                  <a href={dirUrl} target="_blank" rel="noreferrer" className="rounded-full bg-[var(--ink,#111827)] px-3 py-1 font-semibold text-white">
                    Sastādīt maršrutu
                  </a>
                ) : null}
              </div>
            ) : null}
            <div
              className={mapFullscreen ? "iriss-log-map-fs" : "iriss-log-desk-mapwrap"}
              onClick={mapFullscreen ? () => closeMapFullscreen() : undefined}
              role={mapFullscreen ? "presentation" : undefined}
            >
            <div
              ref={mapFsCardRef}
              tabIndex={mapFullscreen ? -1 : undefined}
              role={mapFullscreen ? "dialog" : undefined}
              aria-modal={mapFullscreen ? true : undefined}
              aria-label={mapFullscreen ? "Karte" : undefined}
              className={mapFullscreen ? "iriss-log-map-fs-card" : "iriss-log-desk-mapcard overflow-hidden rounded-2xl bg-white shadow-sm"}
              onClick={mapFullscreen ? (e) => e.stopPropagation() : undefined}
            >
              <div className="iriss-log-no-print iriss-log-map-toolbar flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink3)]">
                  Karte
                  {mapFullscreen ? (
                    <span className="ml-2 font-medium normal-case tracking-normal text-[var(--ink2)]">
                      {counts.active} aktīvi auto · {selectedIds.length} atzīmēti
                    </span>
                  ) : null}
                </p>
                <div className="iriss-log-trip-seg" role="radiogroup" aria-label="Kartē rādīt">
                  {(["all", "next", "after"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      role="radio"
                      aria-checked={mapFocus === f}
                      className={mapFocus === f ? "on" : ""}
                      onClick={() => chooseMapFocus(f)}
                    >
                      {f === "all" ? (
                        "Visi"
                      ) : (
                        <>
                          <i style={{ background: CARGO_COLOR_FALLBACK[f] }} />
                          {f === "next" ? "Nākošā" : "Aiznākošā"}
                          <b>{bucketCounts[f]}</b>
                        </>
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <label className="mr-1 inline-flex cursor-pointer items-center gap-2 text-[12px] font-semibold">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={showLabels}
                      className={`iriss-log-switch sm ${showLabels ? "on" : ""}`}
                      onClick={() => toggleLabels()}
                    />
                    Rādīt nosaukumus
                  </label>
                  <label className="mr-1 inline-flex cursor-pointer items-center gap-2 text-[12px] font-semibold" title="Divpusējai drukai: 2. lapa tiek apgriezta, lai pēc lapas apgriešanas tā nav otrādi">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={printDuplex}
                      className={`iriss-log-switch sm ${printDuplex ? "on" : ""}`}
                      onClick={() => togglePrintDuplex()}
                    />
                    Abām pusēm
                  </label>
                  <button
                    type="button"
                    onClick={() => void printCurrentMap()}
                    className="rounded-full border border-[var(--iriss-line)] px-2.5 py-1 text-[12px] font-semibold"
                  >
                    Drukāt
                  </button>
                  {mapFullscreen ? (
                    <button type="button" aria-label="Aizvērt" onClick={() => closeMapFullscreen()} className="rounded-full border border-[var(--iriss-line)] px-2 py-1 text-[12px] font-semibold">
                      X
                    </button>
                  ) : (
                    <button type="button" onClick={() => openMapFullscreen()} className="iriss-log-fs-btn rounded-full border border-[var(--iriss-line)] px-2.5 py-1 text-[12px] font-semibold">
                      Pilnekrāns
                    </button>
                  )}
                </div>
              </div>
              <div ref={printRootRef} className="iriss-log-print-root">
                <div className="iriss-log-map-hero">
                  <div className="iriss-log-print-chrome pointer-events-none absolute left-2 right-2 top-2 z-[3] flex items-end justify-between gap-2 text-[11px] text-[#334155]">
                    <p className="font-semibold">{printSheet.heading}</p>
                    <p>{printSheet.meta}</p>
                  </div>
                  <IrissLogistikaMap
                    ref={mapHandleRef}
                    fill
                    height={420}
                    mode="cars"
                    orders={printing ? printOrders : mapOrders}
                    previous={previous}
                    selectedIds={selectedSet}
                    focus={printing ? null : preview}
                    lockView={printing}
                    printNumbers={printing ? printNumbers : undefined}
                    pinVariant="cargo"
                    showLabels={showLabels}
                    cargoByCarId={cargoByCarId}
                    showOnMapIds={showOnMapIds}
                    bounceCarId={bounceId}
                    hoverCarId={hoverId}
                    statusByCarId={statusByCarId}
                    routeNumbers={routeNumbers}
                    pinColorByCarId={pinColorByCarId}
                    routeEnds={routeEnds}
                    routePaths={routePaths}
                    onRouteVia={(bucket, a) => {
                      const next =
                        a.type === "add"
                          ? addCargoVia(cargoPlan, bucket, a.p)
                          : a.type === "move"
                            ? moveCargoVia(cargoPlan, bucket, a.index, a.p)
                            : removeCargoVia(cargoPlan, bucket, a.index);
                      if (next !== cargoPlan) void persistCargoPlan(next);
                    }}
                    onHoverCar={setHoverId}
                    onSelect={(id) => {
                      toggleSelect(id);
                      pulseBounce(id);
                      setPopupId(id);
                    }}
                  />
                </div>
                <IrissLogistikaPrintList heading={printSheet.heading} meta={printSheet.meta} rows={printPlan.rows} />
              </div>
            </div>
            </div>
          </div>
          {cabinetOpen && active ? (
            <div ref={cabinetRef} className="iriss-log-cab-overlay scroll-mt-3 lg:col-start-2 lg:row-start-1">
              <button type="button" className="iriss-log-btn-sec mb-2 h-8 px-2.5 text-[12px]" onClick={() => setCabinetOpen(false)}>
                Aizvērt kabinetu
              </button>
              <IrissLogistikaCabinet
                order={active}
                groupedPoints={groupedPoints}
                onAssignPoint={(orderId, pickupPointId) => void assignPoint(orderId, pickupPointId)}
                onPatchOrder={(id, action) => void patchOrder(id, action)}
                onOrderUpdated={(next) => setOrders((prev) => prev.map((o) => (o.id === next.id ? next : o)))}
                canCreateOffer={canCreateOffer}
                onPickupChanged={(next) =>
                  setCargoPickups((prev) => (prev.some((p) => p.carId === next.carId) ? prev.map((p) => (p.carId === next.carId ? next : p)) : [...prev, next]))
                }
                endAction={
                  <>
                    {/* Telefonā kravas rindā slēdža un «Kartīte» nav (makets C1) - tie ir šeit. */}
                    <CabinetPhoneMapAndCard
                      showOnMap={cargoPlan.cars.find((c) => c.carId === active.id)?.showOnMap ?? true}
                      inPlan={cargoPlan.cars.some((c) => c.carId === active.id)}
                      onToggleMap={(next) => void persistCargoPlan(setCargoShowOnMap(cargoPlan, active.id, next))}
                      cardHref={autoparksByOrder[active.id] ? autoparksSaitesHref(autoparksByOrder[active.id]!) : undefined}
                    />
                    <LogisticsCarEndAction
                      order={active}
                      stage={(cargoPickups.find((p) => p.carId === active.id)?.stage ?? "waiting") as CabinetPickupStage}
                      onMoveToAutopark={(id) => void moveToAutopark(id)}
                      onDeleteManual={(id) => void deleteManualCar(id)}
                    />
                  </>
                }
              />
            </div>
          ) : (
            <div className="iriss-log-cargo-col space-y-3 lg:col-start-2 lg:row-start-1">
              <IrissLogistikaCargoPlan
                orders={visibleOrders}
                plan={cargoPlan}
                templates={cargoTemplates}
                bounceId={bounceId}
                hoverId={hoverId}
                onPlanChange={(next) => void persistCargoPlan(next)}
                onRowClick={pulseBounce}
                onRowHover={setHoverId}
                onRefreshDirections={(bucket, base) => void refreshCargoDirections(bucket, base)}
                routeUi={routeUi}
                onTemplatesChanged={() => void reloadTemplates()}
                onAddManual={addManualCar}
                readinessOn={readinessOn}
                onToggleReadiness={toggleReadiness}
                readinessByCarId={readinessByCarId}
                cardHrefByCarId={autoparksByOrder}
                stageLabelByCarId={stageLabelByCarId}
                onOpenCabinet={(id) => {
                  setActiveId(id);
                  setCabinetOpen(true);
                }}
              />
              {popupOrder ? (
                <IrissLogistikaCarPopup
                  order={popupOrder}
                  plan={cargoPlan}
                  stage={popupStage}
                  onClose={() => setPopupId(null)}
                  onPlanChange={(next) => void persistCargoPlan(next)}
                />
              ) : null}
            </div>
          )}
          {/* Datorā tabula aizņem abu kolonnu platumu zem kartes un kravu plāna. Telefonā: karte, kravas, auto. */}
          <div className="iriss-log-desk-legacy min-w-0 lg:col-span-2 lg:row-start-2">
            {/* "Visi auto" tabula noņemta (makets 26.10): posms rindā, statuss/dokumenti/Uz Autoparku - auto kabinetā. */}
            <ul className="iriss-log-legacy-orders hidden iriss-log-no-print mt-3 overflow-hidden rounded-2xl bg-white shadow-sm">
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
                        className="shrink-0 rounded-full border border-[var(--iriss-line)] px-2.5 py-1 text-[12px] font-semibold"
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
        </div>
      )}

      {selectedIds.length > 0 && pageTab === "orders" ? (
        <div className="iriss-log-no-print fixed inset-x-0 bottom-[calc(62px+max(8px,calc(env(safe-area-inset-bottom,0px)-20px))+8px)] z-20 flex items-center gap-2 bg-[var(--s1,#fff)] px-3 py-2 md:hidden">
          <span className="text-[13px] font-semibold">{selectedIds.length} atzīmētas</span>
          <button type="button" className="ml-auto inline-flex min-h-11 items-center px-2 text-[13px] font-semibold" onClick={() => void printCurrentMap()}>
            Drukāt
          </button>
          {dirUrl ? (
            <a href={dirUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-full bg-[var(--ink,#111827)] px-3 text-[13px] font-semibold text-white">
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
            className="h-10 w-full rounded-xl border border-[var(--iriss-line)] px-3 text-[16px]"
            placeholder="6 ciparu kods"
            inputMode="numeric"
          />
          <button
            type="button"
            className="h-9 rounded-full bg-[var(--ink,#111827)] px-3 text-[12.5px] font-semibold text-white"
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
          className="mt-3 h-9 rounded-full border border-[var(--iriss-line)] px-3 text-[12.5px] font-semibold"
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
