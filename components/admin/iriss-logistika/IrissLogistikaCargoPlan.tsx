"use client";

import { useEffect, useMemo, useState } from "react";
import { IrissAuctionLogo } from "@/components/admin/iriss-logistika/IrissAuctionLogo";
import {
  CARGO_BUCKET_ADD_LV,
  CARGO_BUCKET_LV,
  CARGO_BUCKETS,
  carsInCargoBucket,
  endpointFromTemplate,
  formatCargoDuration,
  formatCargoKm,
  formatCargoRouteCopy,
  formatLogisticsPostal,
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
  onRefreshDirections: (bucket: "next" | "after") => void;
};

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
}: Props) {
  const byId = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropBucket, setDropBucket] = useState<CargoBucket | null>(null);
  const [colorFor, setColorFor] = useState<string | null>(null);
  const [addressFor, setAddressFor] = useState<{ bucket: "next" | "after"; end: "start" | "end" } | null>(null);

  // Vilkšanas stāvoklis vienmēr notīrās, arī ja pele atlaista ārpus kartītes vai vilkšana atcelta.
  useEffect(() => {
    if (!dragId) return;
    const clear = () => {
      setDragId(null);
      setDropBucket(null);
    };
    window.addEventListener("dragend", clear);
    window.addEventListener("drop", clear);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("dragend", clear);
      window.removeEventListener("drop", clear);
      window.removeEventListener("blur", clear);
    };
  }, [dragId]);

  return (
    <aside className="iriss-log-cargo-card">
      <div className="flex items-center justify-between px-3.5 pb-1 pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6e6e73]">Kravu plāns</p>
        <p className="text-[12px] text-[#6e6e73]">{orders.length} auto</p>
      </div>
      {CARGO_BUCKETS.map((bucket) => {
        const rows = carsInCargoBucket(plan, bucket).filter((c) => byId.has(c.carId));
        const cargoBucket = bucket === "none" ? null : bucket;
        const route = cargoBucket ? plan.routes[cargoBucket] : null;
        const colorVar = `var(--iriss-log-cargo-${bucket})`;
        return (
          <section
            key={bucket}
            className={`border-t border-[var(--iriss-log-line)] first:border-t-0 ${dragId && dropBucket === bucket ? "iriss-log-cargo-drop-target" : ""}`}
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (dropBucket !== bucket) setDropBucket(bucket);
            }}
            onDrop={(e) => {
              if (!dragId) return;
              e.preventDefault();
              onPlanChange(moveCargoCar(plan, dragId, bucket));
              setDragId(null);
              setDropBucket(null);
            }}
          >
            <div className="iriss-log-cargo-head">
              <span className="iriss-log-cargo-dot" style={{ background: colorVar }} />
              <span className="text-[13px] font-semibold">{CARGO_BUCKET_LV[bucket]}</span>
              <span className="text-[12px] text-[#6e6e73]">{rows.length}</span>
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
                      onPlanChange(setCargoRouteEnabled(plan, cargoBucket, !route.enabled));
                      if (!route.enabled) onRefreshDirections(cargoBucket);
                    }}
                  />
                </label>
              ) : null}
            </div>

            {route?.enabled && cargoBucket ? (
              <RouteBlock
                bucket={cargoBucket}
                plan={plan}
                rows={rows}
                byId={byId}
                templates={templates}
                addressFor={addressFor}
                setAddressFor={setAddressFor}
                onPlanChange={onPlanChange}
                onRefreshDirections={() => onRefreshDirections(cargoBucket)}
                onRowClick={onRowClick}
                onRowHover={onRowHover}
                bounceId={bounceId}
                hoverId={hoverId}
              />
            ) : (
              <ul>
                {rows.map((car) => {
                  const order = byId.get(car.carId);
                  if (!order) return null;
                  return (
                    <li key={car.carId} className="relative">
                      <div
                        className={`iriss-log-cargo-row cursor-grab active:cursor-grabbing ${bounceId === car.carId || hoverId === car.carId ? "active" : ""} ${dragId === car.carId ? "dragging" : ""}`}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", car.carId);
                          onRowHover(null);
                          setDragId(car.carId);
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setDropBucket(null);
                        }}
                        onClick={() => onRowClick(car.carId)}
                        onMouseEnter={() => onRowHover(car.carId)}
                        onMouseLeave={() => onRowHover(null)}
                      >
                        <button
                          type="button"
                          role="switch"
                          aria-checked={car.showOnMap}
                          aria-label="Rādīt kartē"
                          title={car.showOnMap ? "Rāda kartē" : "Nerāda kartē"}
                          className={`iriss-log-switch sm ${car.showOnMap ? "on" : ""}`}
                          draggable={false}
                          onClick={(e) => {
                            e.stopPropagation();
                            onPlanChange(setCargoShowOnMap(plan, car.carId, !car.showOnMap));
                          }}
                        />
                        <span className="text-[12px] text-[#c7c7cc]" aria-hidden>
                          ⋮⋮
                        </span>
                        <button
                          type="button"
                          className="iriss-log-cargo-dot"
                          style={{ background: colorVar }}
                          aria-label="Kravas krāsa"
                          onClick={(e) => {
                            e.stopPropagation();
                            setColorFor((id) => (id === car.carId ? null : car.carId));
                          }}
                        />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{logisticsCarTitle(order)}</span>
                        <span className="iriss-log-cargo-logo">{order.auction ? <IrissAuctionLogo name={order.auction} /> : null}</span>
                        <span className="iriss-log-cargo-postal">{formatLogisticsPostal(order.pickupSnapshot)}</span>
                      </div>
                      {colorFor === car.carId ? (
                        <ColorMenu
                          onPick={(next) => {
                            onPlanChange(moveCargoCar(plan, car.carId, next));
                            setColorFor(null);
                          }}
                        />
                      ) : null}
                    </li>
                  );
                })}
                {dragId ? (
                  <li>
                    <div className="iriss-log-cargo-drop">
                      {CARGO_BUCKET_ADD_LV[bucket]}
                    </div>
                  </li>
                ) : null}
              </ul>
            )}
          </section>
        );
      })}
    </aside>
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
  onRowClick,
  onRowHover,
  bounceId,
  hoverId,
}: {
  bucket: "next" | "after";
  plan: CargoPlanState;
  rows: { carId: string }[];
  byId: Map<string, LogisticsOrder>;
  templates: CargoRouteTemplate[];
  addressFor: { bucket: "next" | "after"; end: "start" | "end" } | null;
  setAddressFor: (v: { bucket: "next" | "after"; end: "start" | "end" } | null) => void;
  onPlanChange: (plan: CargoPlanState) => void;
  onRefreshDirections: () => void;
  onRowClick: (id: string) => void;
  onRowHover: (id: string | null) => void;
  bounceId: string | null;
  hoverId: string | null;
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
          onPlanChange(setCargoRouteEndpoint(plan, bucket, "start", v));
          setAddressFor(null);
          onRefreshDirections();
        }}
      />
      <ol className="mt-1 space-y-0.5">
        {rows.map((car, i) => {
          const order = byId.get(car.carId);
          if (!order) return null;
          return (
            <li key={car.carId}>
              <button
                type="button"
                className={`iriss-log-cargo-row rounded-[10px] px-1 ${bounceId === car.carId || hoverId === car.carId ? "active" : ""}`}
                onClick={() => onRowClick(car.carId)}
                onMouseEnter={() => onRowHover(car.carId)}
                onMouseLeave={() => onRowHover(null)}
              >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--iriss-log-surface-2)] text-[11px] font-semibold">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{logisticsCarTitle(order)}</span>
                <span className="text-[12px] text-[#6e6e73]">
                  {order.pickupSnapshot?.city || formatLogisticsPostal(order.pickupSnapshot)}
                </span>
                {order.auction ? <IrissAuctionLogo name={order.auction} /> : null}
              </button>
            </li>
          );
        })}
      </ol>
      <EndpointRow
        label="Beigas"
        empty="+ Pievienot beigas"
        value={route.end}
        open={addressFor?.bucket === bucket && addressFor.end === "end"}
        templates={templates}
        onOpen={() => setAddressFor({ bucket, end: "end" })}
        onClose={() => setAddressFor(null)}
        onPick={(v) => {
          onPlanChange(setCargoRouteEndpoint(plan, bucket, "end", v));
          setAddressFor(null);
          onRefreshDirections();
        }}
      />
      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <p className="text-[22px] font-semibold tracking-tight">{formatCargoKm(route.distanceKm) || "- km"}</p>
          <p className="text-[12px] text-[#6e6e73]">{formatCargoDuration(route.durationMin) || "laiks pēc aprēķina"}</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {mapsUrl ? (
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="iriss-log-btn-dark">
            Atvērt Google Maps
          </a>
        ) : (
          <span className="iriss-log-btn-dark opacity-40">Atvērt Google Maps</span>
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
