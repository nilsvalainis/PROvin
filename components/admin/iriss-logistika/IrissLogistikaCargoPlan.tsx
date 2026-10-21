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
import { IrissAddressAutocomplete, type PickedAddress } from "@/components/admin/iriss-logistika/IrissAddressAutocomplete";
import { IrissAuctionLogo } from "@/components/admin/iriss-logistika/IrissAuctionLogo";
import {
  CARGO_BUCKET_ADD_LV,
  CARGO_BUCKET_LV,
  CARGO_BUCKETS,
  cargoRoutePointsKey,
  carsInCargoBucket,
  endpointFromTemplate,
  formatCargoDuration,
  formatCargoKm,
  formatLogisticsPostal,
  isCargoBucket,
  logisticsCarTitle,
  moveCargoCar,
  ROUTE_TEMPLATE_TYPE_LV,
  ROUTE_TEMPLATE_TYPES,
  setCargoRouteEnabled,
  setCargoRouteEndpoint,
  setCargoShowOnMap,
  type CargoBucket,
  type CargoPlanState,
  type CargoRouteEndpoint,
  type CargoRouteTemplate,
  type RouteTemplateType,
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
  routeUi?: Record<"next" | "after", { busy: boolean; notice: string }>;
  /** Pēc šablona pievienošanas, labošanas vai dzēšanas pārlādē sarakstu. */
  onTemplatesChanged?: () => void;
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
  routeUi,
  onTemplatesChanged,
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
                        // Līniju pārrēķina Loģistikas dzīvais maršruts, kad ir ko savienot.
                        onPlanChange(setCargoRouteEnabled(plan, cargoBucket, !route.enabled));
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
                  busy={routeUi?.[cargoBucket].busy ?? false}
                  onTemplatesChanged={onTemplatesChanged ?? (() => undefined)}
                  error={routeUi?.[cargoBucket].notice ?? ""}
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
  const [picked, setPicked] = useState<PickedAddress | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() {
    setOpen(false);
    setMake("");
    setModel("");
    setClient("");
    setPicked(null);
    setNotice("");
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
      <div className="mt-2">
        <IrissAddressAutocomplete
          placeholder="Adrese: sāc rakstīt iela, pilsēta vai indekss"
          onPick={(a) => {
            setPicked(a);
            setNotice("");
          }}
        />
        {picked ? <p className="mt-1 truncate text-[12px] text-[#15803d]">Kartē: {picked.formatted}</p> : null}
      </div>
      {notice ? <p className="mt-1.5 text-[12px] text-[#6e6e73]">{notice}</p> : null}
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
  busy,
  error,
  onTemplatesChanged,
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
  busy: boolean;
  error: string;
  onTemplatesChanged: () => void;
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
        onTemplatesChanged={onTemplatesChanged}
        onPick={(v) => {
          onPlanChange(setCargoRouteEndpoint(plan, bucket, "start", v));
          setAddressFor(null);
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
        onTemplatesChanged={onTemplatesChanged}
        onPick={(v) => {
          onPlanChange(setCargoRouteEndpoint(plan, bucket, "end", v));
          setAddressFor(null);
        }}
      />
      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <p className="text-[22px] font-semibold tracking-tight">{formatCargoKm(route.distanceKm) || "- km"}</p>
          <p className="text-[12px] text-[#6e6e73]">{formatCargoDuration(route.durationMin) || "laiks pēc aprēķina"}</p>
        </div>
        {hasLine && !stale ? <p className="text-[12px] font-medium text-[#15803d]">Maršruts ir kartē</p> : null}
      </div>
      {error ? (
        <p className="mt-2 rounded-[10px] bg-[#fdecea] px-2.5 py-2 text-[12.5px] text-[#9b1c13]" role="alert">
          {error}
        </p>
      ) : null}
      {stale ? (
        <p className="mt-2 rounded-[10px] bg-[#fffbeb] px-2.5 py-2 text-[12.5px] text-[#92400e]">
          Kravā mainījās auto vai secība. Pārrēķini, lai līnija kartē atbilst.
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="iriss-log-btn-dark"
          disabled={points.length < 2 || busy}
          title={points.length < 2 ? "Vajag vismaz 2 punktus ar adresi" : undefined}
          onClick={() => onRefreshDirections()}
        >
          {busy ? "Sastāda…" : !hasLine ? "Sastādīt maršrutu kartē" : stale ? "Pārrēķināt maršrutu" : "Pārrēķināt"}
        </button>
        {mapsUrl ? (
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="iriss-log-btn-sec">
            Atvērt Google Maps
          </a>
        ) : (
          <span className="iriss-log-btn-sec opacity-40">Atvērt Google Maps</span>
        )}
      </div>
    </div>
  );
}

function TemplateIcon({ type }: { type: RouteTemplateType }) {
  if (type === "port") {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="5" r="2" />
        <path d="M12 7v14M5 12H3a9 9 0 0 0 18 0h-2M8 10h8" />
      </svg>
    );
  }
  if (type === "border") {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

function TemplateEditor({
  tpl,
  onDone,
  onTemplatesChanged,
}: {
  tpl: CargoRouteTemplate;
  onDone: () => void;
  onTemplatesChanged: () => void;
}) {
  const [name, setName] = useState(tpl.name);
  const [type, setType] = useState<RouteTemplateType>(tpl.type);
  const [picked, setPicked] = useState<PickedAddress | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const url = `/api/admin/iriss-logistics/route-templates/${encodeURIComponent(tpl.id)}`;

  async function save() {
    if (!name.trim()) return setError("Ieraksti nosaukumu.");
    setBusy(true);
    const res = await fetch(url, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), type, ...(picked ? { address: picked.formatted, lat: picked.lat, lng: picked.lng } : {}) }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError("Neizdevās saglabāt.");
    onTemplatesChanged();
    onDone();
  }

  async function remove() {
    if (!window.confirm(`Dzēst šablonu "${tpl.name}"?`)) return;
    setBusy(true);
    const res = await fetch(url, { method: "DELETE", credentials: "include" }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError("Neizdevās dzēst.");
    onTemplatesChanged();
    onDone();
  }

  return (
    <div className="iriss-log-tpl-edit">
      <div className="flex gap-2">
        <input className="iriss-log-manual-input min-w-0 flex-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nosaukums" autoFocus />
        <select className="iriss-log-manual-input" value={type} onChange={(e) => setType(e.target.value as RouteTemplateType)} aria-label="Veids">
          {ROUTE_TEMPLATE_TYPES.map((t) => (
            <option key={t} value={t}>
              {ROUTE_TEMPLATE_TYPE_LV[t]}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-2">
        <IrissAddressAutocomplete defaultValue={tpl.address} placeholder="Adrese" onPick={setPicked} />
        {picked ? <p className="mt-1 text-[12px] text-[#15803d]">Jaunā adrese: {picked.formatted}</p> : null}
      </div>
      {error ? <p className="mt-1.5 text-[12px] text-[#c2362b]">{error}</p> : null}
      <div className="mt-2 flex items-center gap-2">
        <button type="button" className="text-[12.5px] font-medium text-[#c2362b]" disabled={busy} onClick={() => void remove()}>
          Dzēst
        </button>
        <span className="flex-1" />
        <button type="button" className="iriss-log-btn-sec h-9 min-h-9 px-3 text-[12.5px]" onClick={onDone}>
          Atcelt
        </button>
        <button type="button" className="iriss-log-btn-dark h-9 min-h-9 px-3 text-[12.5px]" disabled={busy} onClick={() => void save()}>
          Saglabāt
        </button>
      </div>
    </div>
  );
}

function EndpointRow({
  label,
  empty,
  value,
  open,
  templates,
  onOpen,
  onClose,
  onPick,
  onTemplatesChanged,
}: {
  label: string;
  empty: string;
  value: CargoRouteEndpoint | null;
  open: boolean;
  templates: CargoRouteTemplate[];
  onOpen: () => void;
  onClose: () => void;
  onPick: (v: CargoRouteEndpoint | null) => void;
  onTemplatesChanged: () => void;
}) {
  const [saveTpl, setSaveTpl] = useState(false);
  const [tplName, setTplName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);

  async function pickAddress(addr: PickedAddress) {
    const point: CargoRouteEndpoint = {
      label: addr.name || addr.formatted,
      address: addr.formatted,
      lat: addr.lat,
      lng: addr.lng,
      type: "other",
      templateId: "",
    };
    if (saveTpl) {
      const res = await fetch("/api/admin/iriss-logistics/route-templates", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tplName.trim() || addr.name || addr.formatted, address: addr.formatted, lat: addr.lat, lng: addr.lng, type: "other" }),
      }).catch(() => null);
      const body = (res?.ok ? await res.json().catch(() => ({})) : {}) as { template?: CargoRouteTemplate };
      if (body.template) point.templateId = body.template.id;
      if (body.template) point.label = body.template.name;
      onTemplatesChanged();
    }
    onPick(point);
  }

  if (!value && !open) {
    return (
      <button type="button" className="iriss-log-endpoint-add" onClick={onOpen}>
        {empty}
      </button>
    );
  }
  if (value && !open) {
    return (
      <div className="iriss-log-endpoint">
        <span className="iriss-log-tpl-icon">
          <TemplateIcon type={value.type} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-[#8e8e93]">{label}</span>
          <span className="block truncate text-[14px] font-semibold">{value.label || value.address}</span>
        </span>
        <button type="button" className="text-[12.5px] font-medium text-[var(--iriss-log-focus)]" onClick={onOpen}>
          Mainīt
        </button>
        <button type="button" className="px-1 text-[13px] text-[#6e6e73]" onClick={() => onPick(null)} aria-label="Noņemt">
          ✕
        </button>
      </div>
    );
  }
  return (
    <div className="iriss-log-endpoint-picker">
      <div className="flex items-center justify-between px-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6e6e73]">{label}: šabloni</p>
        <button type="button" className="text-[12.5px] font-medium text-[#6e6e73]" onClick={onClose}>
          Aizvērt
        </button>
      </div>
      <ul className="mt-1.5 space-y-1.5">
        {templates.map((tpl) =>
          editId === tpl.id ? (
            <li key={tpl.id}>
              <TemplateEditor tpl={tpl} onDone={() => setEditId(null)} onTemplatesChanged={onTemplatesChanged} />
            </li>
          ) : (
            <li key={tpl.id} className="iriss-log-tpl">
              <button type="button" className="iriss-log-tpl-pick" onClick={() => onPick(endpointFromTemplate(tpl))}>
                <span className="iriss-log-tpl-icon">
                  <TemplateIcon type={tpl.type} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{tpl.name}</span>
                  <span className="block truncate text-[12px] text-[#6e6e73]">{tpl.address}</span>
                </span>
              </button>
              <button type="button" className="iriss-log-tpl-edit-btn" aria-label={`Labot ${tpl.name}`} title="Labot" onClick={() => setEditId(tpl.id)}>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" />
                </svg>
              </button>
            </li>
          ),
        )}
      </ul>
      <p className="mt-3 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#6e6e73]">Cita adrese</p>
      <div className="mt-1.5">
        <IrissAddressAutocomplete placeholder="Sāc rakstīt adresi vai vietu" onPick={(a) => void pickAddress(a)} />
      </div>
      <label className="mt-2 flex items-center gap-2 px-0.5 text-[12.5px]">
        <input type="checkbox" className="h-4 w-4 accent-[#1d1d1f]" checked={saveTpl} onChange={(e) => setSaveTpl(e.target.checked)} />
        Saglabāt kā šablonu
      </label>
      {saveTpl ? (
        <input className="iriss-log-manual-input mt-1.5 w-full" value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="Šablona nosaukums, piem. Rostoka" />
      ) : null}
    </div>
  );
}
