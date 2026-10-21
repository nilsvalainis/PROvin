"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IrissAuctionLogo } from "@/components/admin/iriss-logistika/IrissAuctionLogo";
import {
  CARGO_BUCKET_ADD_LV,
  CARGO_BUCKET_LV,
  CARGO_BUCKETS,
  cargoRoutePoints,
  cargoRoutePointsKey,
  carsInCargoBucket,
  endpointFromTemplate,
  formatCargoDuration,
  formatCargoKm,
  formatCargoRouteCopy,
  formatLogisticsPostal,
  isCargoBucket,
  logisticsCarTitle,
  moveCargoCar,
  setCargoRouteEnabled,
  setCargoRouteEndpoint,
  setCargoShowOnMap,
  type CargoBucket,
  type CargoPlanState,
  type CargoRouteEndpoint,
  type CargoRouteTemplate,
} from "@/lib/iriss-logistics-cargo-plan";
import { logisticsGoogleMapsDirUrl } from "@/lib/iriss-logistics-maps-dir";
import type { LogisticsOrder } from "@/lib/iriss-logistics-types";

type Props = {
  orders: LogisticsOrder[];
  plan: CargoPlanState;
  templates: CargoRouteTemplate[];
  bounceId: string | null;
  hoverId: string | null;
  onPlanChange: (plan: CargoPlanState) => void;
  onRowClick: (id: string) => void;
  onRowHover: (id: string | null) => void;
  /** `base`: tikko mainītais plāns, ko aprēķins izmanto (nevis veco stāvokli). */
  onRefreshDirections: (bucket: "next" | "after", base?: CargoPlanState) => void;
  /** Citu klientu auto ar roku: marka, modelis, adrese no ģeokodētāja. */
  onAddManual?: (bucket: CargoBucket, input: ManualCarInput) => Promise<boolean>;
};

export type ManualCarInput = {
  make: string;
  model: string;
  client: string;
  address: string;
  lat: number;
  lng: number;
};

type BucketLists = Record<CargoBucket, string[]>;

function bucketListsFromPlan(plan: CargoPlanState, byId: Map<string, LogisticsOrder>): BucketLists {
  return {
    next: carsInCargoBucket(plan, "next").filter((c) => byId.has(c.carId)).map((c) => c.carId),
    after: carsInCargoBucket(plan, "after").filter((c) => byId.has(c.carId)).map((c) => c.carId),
    none: carsInCargoBucket(plan, "none").filter((c) => byId.has(c.carId)).map((c) => c.carId),
  };
}

function bucketOfId(lists: BucketLists, id: string): CargoBucket | null {
  if (id.startsWith("bucket:")) {
    const b = id.slice("bucket:".length);
    return isCargoBucket(b) ? b : null;
  }
  for (const bucket of CARGO_BUCKETS) if (lists[bucket].includes(id)) return bucket;
  return null;
}

export function IrissLogistikaCargoPlan({
  orders,
  plan,
  templates,
  bounceId,
  hoverId,
  onPlanChange,
  onRowClick,
  onRowHover,
  onRefreshDirections,
  onAddManual,
}: Props) {
  const byId = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders]);
  const planLists = useMemo(() => bucketListsFromPlan(plan, byId), [plan, byId]);
  /** Vilkšanas laikā saraksti mainās lokāli, plānu saglabā tikai pēc nomešanas. */
  const [dragLists, setDragLists] = useState<BucketLists | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [colorFor, setColorFor] = useState<string | null>(null);
  const [addressFor, setAddressFor] = useState<{ bucket: "next" | "after"; end: "start" | "end" } | null>(null);
  const lists = dragLists ?? planLists;
  const carState = useMemo(() => new Map(plan.cars.map((c) => [c.carId, c])), [plan]);

  // Pele: vilkšana sākas pēc 5 px (klikšķis paliek klikšķis). Telefons: piespied un turi, tad velc.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragStart(e: DragStartEvent) {
    setDragId(String(e.active.id));
    setDragLists(planLists);
    setColorFor(null);
    onRowHover(null);
  }

  function onDragOver(e: DragOverEvent) {
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;
    const activeId = String(e.active.id);
    setDragLists((prev) => {
      const cur = prev ?? planLists;
      const from = bucketOfId(cur, activeId);
      const to = bucketOfId(cur, overId);
      if (!from || !to || from === to) return cur;
      const fromList = cur[from].filter((id) => id !== activeId);
      const toList = [...cur[to]];
      const overIndex = toList.indexOf(overId);
      const below =
        e.over && e.active.rect.current.translated
          ? e.active.rect.current.translated.top > e.over.rect.top + e.over.rect.height / 2
          : false;
      const at = overIndex < 0 ? toList.length : overIndex + (below ? 1 : 0);
      toList.splice(at, 0, activeId);
      return { ...cur, [from]: fromList, [to]: toList };
    });
  }

  function finishDrag(e: DragEndEvent | null) {
    const activeId = dragId;
    const cur = dragLists ?? planLists;
    setDragId(null);
    setDragLists(null);
    if (!e || !activeId || !e.over) return;
    const overId = String(e.over.id);
    const bucket = bucketOfId(cur, activeId);
    if (!bucket) return;
    let list = cur[bucket];
    const from = list.indexOf(activeId);
    const to = list.indexOf(overId);
    if (to >= 0 && from !== to) list = arrayMove(list, from, to);
    const index = list.indexOf(activeId);
    const before = planLists[bucket].indexOf(activeId);
    if (bucketOfId(planLists, activeId) === bucket && before === index) return;
    onPlanChange(moveCargoCar(plan, activeId, bucket, index));
  }

  const dragOrder = dragId ? byId.get(dragId) : null;
  const dragBucket = dragId ? bucketOfId(lists, dragId) : null;

  return (
    <aside className="iriss-log-cargo-card">
      <div className="flex items-center justify-between px-3.5 pb-1 pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6e6e73]">Kravu plāns</p>
        <p className="text-[12px] text-[#6e6e73]">{orders.length} auto · velc kartīti uz citu kravu</p>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={finishDrag}
        onDragCancel={() => finishDrag(null)}
      >
        {CARGO_BUCKETS.map((bucket) => {
          const ids = lists[bucket];
          const cargoBucket = bucket === "none" ? null : bucket;
          const route = cargoBucket ? plan.routes[cargoBucket] : null;
          const colorVar = `var(--iriss-log-cargo-${bucket})`;
          const rows = (
            <>
            <BucketList
              bucket={bucket}
              ids={ids}
              dragging={Boolean(dragId)}
              numbered={Boolean(route?.enabled)}
              renderRow={(id, i) => {
                const order = byId.get(id);
                if (!order) return null;
                const car = carState.get(id);
                return (
                  <SortableCargoRow
                    key={id}
                    id={id}
                    order={order}
                    number={route?.enabled ? i + 1 : undefined}
                    colorVar={colorVar}
                    showOnMap={car?.showOnMap ?? true}
                    active={bounceId === id || hoverId === id}
                    colorOpen={colorFor === id}
                    onClick={() => onRowClick(id)}
                    onHover={onRowHover}
                    onToggleMap={() => onPlanChange(setCargoShowOnMap(plan, id, !(car?.showOnMap ?? true)))}
                    onToggleColor={() => setColorFor((cur) => (cur === id ? null : id))}
                    onPickColor={(next) => {
                      onPlanChange(moveCargoCar(plan, id, next));
                      setColorFor(null);
                    }}
                  />
                );
              }}
            />
            {onAddManual && !dragId ? <ManualCarAdd bucket={bucket} onAdd={onAddManual} /> : null}
            </>
          );
          return (
            <section key={bucket} className="border-t border-[var(--iriss-log-line)] first:border-t-0">
              <div className="iriss-log-cargo-head">
                <span className="iriss-log-cargo-dot" style={{ background: colorVar }} />
                <span className="text-[13px] font-semibold">{CARGO_BUCKET_LV[bucket]}</span>
                <span className="text-[12px] text-[#6e6e73]">{ids.length}</span>
                {route ? (
                  <label className="ml-auto flex items-center gap-2 text-[12px] font-medium">
                    Maršruts
                    <button
                      type="button"
                      aria-pressed={route.enabled}
                      className={`iriss-log-switch ${route.enabled ? "on" : ""}`}
                      style={route.enabled ? { background: colorVar } : undefined}
                      onClick={() => {
                        if (!cargoBucket) return;
                        const next = setCargoRouteEnabled(plan, cargoBucket, !route.enabled);
                        onPlanChange(next);
                        // Līniju rēķinām uzreiz tikai, ja jau ir ko savienot un tā nav aktuāla.
                        const pts = cargoRoutePoints(next, cargoBucket, orders);
                        if (!route.enabled && pts.length >= 2 && route.pathKey !== cargoRoutePointsKey(pts)) {
                          onRefreshDirections(cargoBucket, next);
                        }
                      }}
                    />
                  </label>
                ) : null}
              </div>
              {route?.enabled && cargoBucket ? (
                <RouteBlock
                  bucket={cargoBucket}
                  plan={plan}
                  rows={ids.map((carId) => ({ carId }))}
                  byId={byId}
                  templates={templates}
                  addressFor={addressFor}
                  setAddressFor={setAddressFor}
                  onPlanChange={onPlanChange}
                  onRefreshDirections={(base) => onRefreshDirections(cargoBucket, base)}
                >
                  {rows}
                </RouteBlock>
              ) : (
                rows
              )}
            </section>
          );
        })}
        <DragOverlay dropAnimation={null}>
          {dragOrder && dragBucket ? (
            <div className="iriss-log-cargo-row overlay">
              <span className="iriss-log-cargo-dot" style={{ background: `var(--iriss-log-cargo-${dragBucket})` }} />
              <CargoRowText order={dragOrder} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </aside>
  );
}

function BucketList({
  bucket,
  ids,
  dragging,
  numbered,
  renderRow,
}: {
  bucket: CargoBucket;
  ids: string[];
  dragging: boolean;
  numbered: boolean;
  renderRow: (id: string, index: number) => ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `bucket:${bucket}` });
  return (
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      <ul ref={setNodeRef} className={`iriss-log-cargo-list ${numbered ? "numbered" : ""} ${dragging && isOver ? "over" : ""}`}>
        {ids.map((id, i) => renderRow(id, i))}
        {ids.length === 0 ? (
          <li className={`iriss-log-cargo-drop ${dragging ? "live" : ""}`}>
            {dragging ? CARGO_BUCKET_ADD_LV[bucket] : "Ievelc auto šeit"}
          </li>
        ) : null}
      </ul>
    </SortableContext>
  );
}

function CargoRowText({ order }: { order: LogisticsOrder }) {
  const place = [formatLogisticsPostal(order.pickupSnapshot), order.pickupSnapshot?.city].filter(Boolean).join(" ") || order.pickupAddress;
  return (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold leading-tight">{logisticsCarTitle(order)}</span>
        <span className="mt-0.5 block truncate text-[12px] leading-tight text-[#6e6e73]">{place || "Pickup vieta nav norādīta"}</span>
      </span>
      <span className="iriss-log-cargo-logo">
        {order.source === "manual" ? <span className="iriss-log-manual-chip">Cits klients</span> : order.auction ? <IrissAuctionLogo name={order.auction} /> : null}
      </span>
    </>
  );
}

/** Iekšējās pogas nesāk vilkšanu (pele, pieskāriens, tastatūra). */
const stopDragStart = {
  onMouseDown: (e: { stopPropagation: () => void }) => e.stopPropagation(),
  onTouchStart: (e: { stopPropagation: () => void }) => e.stopPropagation(),
  onKeyDown: (e: { stopPropagation: () => void }) => e.stopPropagation(),
};

function SortableCargoRow({
  id,
  order,
  number,
  colorVar,
  showOnMap,
  active,
  colorOpen,
  onClick,
  onHover,
  onToggleMap,
  onToggleColor,
  onPickColor,
}: {
  id: string;
  order: LogisticsOrder;
  number?: number;
  colorVar: string;
  showOnMap: boolean;
  active: boolean;
  colorOpen: boolean;
  onClick: () => void;
  onHover: (id: string | null) => void;
  onToggleMap: () => void;
  onToggleColor: () => void;
  onPickColor: (bucket: CargoBucket) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      className="relative"
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div
        className={`iriss-log-cargo-row ${active ? "active" : ""} ${isDragging ? "dragging" : ""}`}
        {...attributes}
        {...listeners}
        aria-roledescription="velkama kartīte"
        onClick={onClick}
        onMouseEnter={() => onHover(id)}
        onMouseLeave={() => onHover(null)}
      >
        {number != null ? <span className="iriss-log-cargo-num">{number}</span> : null}
        <button
          type="button"
          className="iriss-log-cargo-dot-btn"
          aria-label="Mainīt kravu"
          {...stopDragStart}
          onClick={(e) => {
            e.stopPropagation();
            onToggleColor();
          }}
        >
          <span className="iriss-log-cargo-dot" style={{ background: colorVar }} />
        </button>
        <CargoRowText order={order} />
        <button
          type="button"
          role="switch"
          aria-checked={showOnMap}
          aria-label="Rādīt kartē"
          title={showOnMap ? "Rāda kartē" : "Nerāda kartē"}
          className={`iriss-log-switch sm ${showOnMap ? "on" : ""}`}
          {...stopDragStart}
          onClick={(e) => {
            e.stopPropagation();
            onToggleMap();
          }}
        />
      </div>
      {colorOpen ? <ColorMenu onPick={onPickColor} /> : null}
    </li>
  );
}

function ManualCarAdd({ bucket, onAdd }: { bucket: CargoBucket; onAdd: (bucket: CargoBucket, input: ManualCarInput) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [client, setClient] = useState("");
  const [q, setQ] = useState("");
  const [choices, setChoices] = useState<Array<{ formatted: string; lat: number; lng: number }>>([]);
  const [picked, setPicked] = useState<{ formatted: string; lat: number; lng: number } | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() {
    setOpen(false);
    setMake("");
    setModel("");
    setClient("");
    setQ("");
    setChoices([]);
    setPicked(null);
    setNotice("");
  }

  async function search() {
    const address = q.trim();
    if (address.length < 4) {
      setNotice("Ieraksti pilnāku adresi.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/admin/iriss-logistics/geocode", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, choices: true }),
    }).catch(() => null);
    setBusy(false);
    const body = res?.ok ? ((await res.json()) as { choices?: Array<{ formatted: string; lat: number; lng: number }>; notice?: string }) : {};
    setChoices(body.choices ?? []);
    setPicked(null);
    setNotice(body.notice ?? (body.choices?.length ? "Izvēlies precīzo adresi:" : "Adrese nav atrasta."));
  }

  async function save() {
    if (!make.trim()) return setNotice("Ieraksti marku.");
    if (!picked) return setNotice("Atrodi un izvēlies adresi, lai auto ir kartē.");
    setBusy(true);
    const ok = await onAdd(bucket, { make: make.trim(), model: model.trim(), client: client.trim(), address: picked.formatted, lat: picked.lat, lng: picked.lng });
    setBusy(false);
    if (ok) reset();
    else setNotice("Neizdevās saglabāt.");
  }

  if (!open) {
    return (
      <button type="button" className="iriss-log-manual-add" onClick={() => setOpen(true)}>
        + Cits auto ar roku
      </button>
    );
  }
  return (
    <div className="iriss-log-manual-form">
      <p className="text-[13px] font-semibold">Cita klienta auto</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <input className="iriss-log-manual-input" value={make} onChange={(e) => setMake(e.target.value)} placeholder="Marka" autoFocus />
        <input className="iriss-log-manual-input" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Modelis" />
      </div>
      <input className="iriss-log-manual-input mt-2 w-full" value={client} onChange={(e) => setClient(e.target.value)} placeholder="Klients vai piezīme (nav obligāti)" />
      <div className="mt-2 flex gap-2">
        <input
          className="iriss-log-manual-input min-w-0 flex-1"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void search();
            }
          }}
          placeholder="Adrese: iela, pasta indekss, pilsēta"
        />
        <button type="button" className="iriss-log-btn-sec h-9 min-h-9 px-3 text-[12.5px]" disabled={busy} onClick={() => void search()}>
          Atrast
        </button>
      </div>
      {notice ? <p className="mt-1.5 text-[12px] text-[#6e6e73]">{notice}</p> : null}
      {choices.length > 0 ? (
        <ul className="mt-1 space-y-1">
          {choices.map((c) => (
            <li key={`${c.lat},${c.lng}`}>
              <button
                type="button"
                className={`iriss-log-manual-choice ${picked?.formatted === c.formatted ? "on" : ""}`}
                onClick={() => {
                  setPicked(c);
                  setNotice("");
                }}
              >
                {c.formatted}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-2.5 flex justify-end gap-2">
        <button type="button" className="iriss-log-btn-sec h-9 min-h-9 px-3 text-[12.5px]" onClick={reset}>
          Atcelt
        </button>
        <button type="button" className="iriss-log-btn-dark h-9 min-h-9 px-3 text-[12.5px]" disabled={busy || !picked || !make.trim()} onClick={() => void save()}>
          Pievienot kravai
        </button>
      </div>
    </div>
  );
}

function ColorMenu({ onPick }: { onPick: (bucket: CargoBucket) => void }) {
  return (
    <div className="iriss-log-cargo-menu left-10 top-9">
      {CARGO_BUCKETS.map((bucket) => (
        <button
          key={bucket}
          type="button"
          className="flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-[13px]"
          onClick={() => onPick(bucket)}
        >
          <span className="iriss-log-cargo-dot" style={{ background: `var(--iriss-log-cargo-${bucket})` }} />
          {CARGO_BUCKET_LV[bucket]}
        </button>
      ))}
    </div>
  );
}

function RouteBlock({
  bucket,
  plan,
  rows,
  byId,
  templates,
  addressFor,
  setAddressFor,
  onPlanChange,
  onRefreshDirections,
  children,
}: {
  bucket: "next" | "after";
  plan: CargoPlanState;
  rows: { carId: string }[];
  byId: Map<string, LogisticsOrder>;
  templates: CargoRouteTemplate[];
  addressFor: { bucket: "next" | "after"; end: "start" | "end" } | null;
  setAddressFor: (v: { bucket: "next" | "after"; end: "start" | "end" } | null) => void;
  onPlanChange: (plan: CargoPlanState) => void;
  onRefreshDirections: (base?: CargoPlanState) => void;
  children: ReactNode;
}) {
  const route = plan.routes[bucket];
  const points = [
    route.start ? { lat: route.start.lat, lng: route.start.lng } : null,
    ...rows.flatMap((r) => {
      const o = byId.get(r.carId);
      return o?.pickupLat != null && o.pickupLng != null ? [{ lat: o.pickupLat, lng: o.pickupLng }] : [];
    }),
    route.end ? { lat: route.end.lat, lng: route.end.lng } : null,
  ].filter((p): p is { lat: number; lng: number } => Boolean(p));
  const mapsUrl = logisticsGoogleMapsDirUrl(points);
  const hasLine = route.path.length > 1;
  const stale = hasLine && route.pathKey !== cargoRoutePointsKey(points);
  const copyText = formatCargoRouteCopy({
    start: route.start,
    stops: rows.flatMap((r) => {
      const o = byId.get(r.carId);
      return o ? [{ title: logisticsCarTitle(o), address: o.pickupSnapshot?.city }] : [];
    }),
    end: route.end,
  });

  return (
    <div className="px-3.5 pb-3">
      <EndpointRow
        label="Sākums"
        empty="+ Pievienot sākumu"
        value={route.start}
        open={addressFor?.bucket === bucket && addressFor.end === "start"}
        templates={templates}
        onOpen={() => setAddressFor({ bucket, end: "start" })}
        onClose={() => setAddressFor(null)}
        onPick={(v) => {
          const next = setCargoRouteEndpoint(plan, bucket, "start", v);
          onPlanChange(next);
          setAddressFor(null);
          if (cargoRoutePoints(next, bucket, [...byId.values()]).length >= 2) onRefreshDirections(next);
        }}
      />
      <div className="-mx-3.5">{children}</div>
      <EndpointRow
        label="Beigas"
        empty="+ Pievienot beigas"
        value={route.end}
        open={addressFor?.bucket === bucket && addressFor.end === "end"}
        templates={templates}
        onOpen={() => setAddressFor({ bucket, end: "end" })}
        onClose={() => setAddressFor(null)}
        onPick={(v) => {
          const next = setCargoRouteEndpoint(plan, bucket, "end", v);
          onPlanChange(next);
          setAddressFor(null);
          if (cargoRoutePoints(next, bucket, [...byId.values()]).length >= 2) onRefreshDirections(next);
        }}
      />
      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <p className="text-[22px] font-semibold tracking-tight">{formatCargoKm(route.distanceKm) || "- km"}</p>
          <p className="text-[12px] text-[#6e6e73]">{formatCargoDuration(route.durationMin) || "laiks pēc aprēķina"}</p>
        </div>
        {hasLine && !stale ? <p className="text-[12px] font-medium text-[#15803d]">Maršruts ir kartē</p> : null}
      </div>
      {stale ? (
        <p className="mt-2 rounded-[10px] bg-[#fffbeb] px-2.5 py-2 text-[12.5px] text-[#92400e]">
          Kravā mainījās auto vai secība. Pārrēķini, lai līnija kartē atbilst.
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="iriss-log-btn-dark"
          disabled={points.length < 2}
          title={points.length < 2 ? "Vajag vismaz 2 punktus ar adresi" : undefined}
          onClick={() => onRefreshDirections()}
        >
          {!hasLine ? "Sastādīt maršrutu kartē" : stale ? "Pārrēķināt maršrutu" : "Pārrēķināt"}
        </button>
        {mapsUrl ? (
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="iriss-log-btn-sec">
            Atvērt Google Maps
          </a>
        ) : (
          <span className="iriss-log-btn-sec opacity-40">Atvērt Google Maps</span>
        )}
        <button
          type="button"
          className="iriss-log-btn-sec"
          onClick={() => {
            if (copyText) void navigator.clipboard.writeText(copyText);
          }}
        >
          Kopēt maršrutu
        </button>
      </div>
    </div>
  );
}

function EndpointRow({
  empty,
  value,
  open,
  templates,
  onOpen,
  onClose,
  onPick,
}: {
  label: string;
  empty: string;
  value: CargoRouteEndpoint | null;
  open: boolean;
  templates: CargoRouteTemplate[];
  onOpen: () => void;
  onClose: () => void;
  onPick: (v: CargoRouteEndpoint | null) => void;
}) {
  const [q, setQ] = useState("");
  const [choices, setChoices] = useState<Array<{ formatted: string; lat: number; lng: number }>>([]);
  const [saveTpl, setSaveTpl] = useState(false);
  const [notice, setNotice] = useState("");

  async function search() {
    const address = q.trim();
    if (address.length < 4) return;
    const res = await fetch("/api/admin/iriss-logistics/geocode", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, choices: true }),
    });
    const body = (await res.json()) as { choices?: Array<{ formatted: string; lat: number; lng: number }>; notice?: string };
    setChoices(body.choices ?? []);
    setNotice(body.notice ?? (body.choices?.length ? "" : "Adrese nav atrasta."));
  }

  async function pickChoice(choice: { formatted: string; lat: number; lng: number }) {
    const point: CargoRouteEndpoint = {
      label: choice.formatted,
      address: choice.formatted,
      lat: choice.lat,
      lng: choice.lng,
      type: "other",
      templateId: "",
    };
    if (saveTpl) {
      await fetch("/api/admin/iriss-logistics/route-templates", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: q.trim() || choice.formatted, address: choice.formatted, lat: choice.lat, lng: choice.lng, type: "other" }),
      });
    }
    onPick(point);
  }

  if (!value && !open) {
    return (
      <button type="button" className="mt-1 w-full rounded-[10px] px-1 py-2 text-left text-[13px] font-medium text-[#6e6e73]" onClick={onOpen}>
        {empty}
      </button>
    );
  }
  if (value && !open) {
    return (
      <div className="mt-1 flex items-center gap-2 px-1 py-1.5 text-[13px]">
        <span className="min-w-0 flex-1 truncate font-medium">{value.label || value.address}</span>
        <button type="button" className="text-[12px] text-[#6e6e73]" onClick={() => onPick(null)} aria-label="Notīrīt">
          ✕
        </button>
      </div>
    );
  }
  return (
    <div className="mt-1 rounded-[14px] bg-[var(--iriss-log-surface-2)] p-2">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-[#6e6e73]">Šabloni</p>
      <ul>
        {templates.map((tpl) => (
          <li key={tpl.id}>
            <button type="button" className="w-full rounded-[10px] px-2 py-1.5 text-left text-[13px]" onClick={() => onPick(endpointFromTemplate(tpl))}>
              {tpl.name}
            </button>
          </li>
        ))}
      </ul>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void search();
        }}
        placeholder="Meklēt adresi"
        className="mt-1 h-9 w-full rounded-[10px] border border-[var(--iriss-log-line)] bg-white px-2 text-[13px]"
      />
      {choices.map((c) => (
        <button key={`${c.lat},${c.lng}`} type="button" className="mt-1 block w-full rounded-[10px] px-2 py-1.5 text-left text-[12.5px]" onClick={() => void pickChoice(c)}>
          {c.formatted}
        </button>
      ))}
      {notice ? <p className="px-1 pt-1 text-[12px] text-[#6e6e73]">{notice}</p> : null}
      <label className="mt-2 flex items-center gap-2 px-1 text-[12px]">
        <input type="checkbox" checked={saveTpl} onChange={(e) => setSaveTpl(e.target.checked)} />
        Saglabāt kā šablonu
      </label>
      <a href="#iriss-log-route-templates" className="mt-1 block px-1 text-[12px] font-medium text-[var(--iriss-log-focus)]" onClick={onClose}>
        Pārvaldīt šablonus
      </a>
    </div>
  );
}
