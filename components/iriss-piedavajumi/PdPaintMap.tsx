"use client";

import "@/components/iriss-piedavajumi/piedavajumi.css";
import { useState } from "react";
import {
  IRISS_PD_PAINT_ZONE_LV,
  IRISS_PD_REPAINT_UM,
  type IrissPdAuto1Blocks,
  type IrissPdPaintZoneId,
} from "@/lib/iriss-piedavajumi-auto1";
import {
  PAINT_MAP_CAR_SRC as CAR_SRC,
  PAINT_MAP_H as H,
  PAINT_MAP_IMG_H as IMG_H,
  PAINT_MAP_IMG_TOP as IMG_TOP,
  PAINT_MAP_SIDE as SIDE,
  PAINT_MAP_SIDE_X as SIDE_X,
  PAINT_MAP_TOP_CHIP_Y as TOP_CHIP_Y,
  PAINT_MAP_TOP_DOT_Y as TOP_DOT_Y,
  PAINT_MAP_W as W,
  PAINT_MAP_ZONE_ORDER as ZONE_ORDER,
  PAINT_MAP_ZONES as ZONES,
} from "@/lib/paint-map-geometry";

/** Krāsas karte (makets apstiprināts 17.11). Ģeometrija kopīga ar izsoles PDF lakas shēmu (`lib/paint-map-geometry.ts`). */
const px = (x: number) => `${(x / W) * 100}%`;
const py = (y: number) => `${(y / H) * 100}%`;

function isRepaint(n: number): boolean {
  return n >= IRISS_PD_REPAINT_UM;
}

function um(n: number): string {
  return `${isRepaint(n) ? "◐ " : ""}${n} µm`;
}

/** Ārpuses krāsas karte (Auto1 «Exterior»): µm katrai zonai, ▲ - zonā atrasti bojājumi. */
export function PdPaintMap({ paint, compact = false }: { paint: NonNullable<IrissPdAuto1Blocks["paint"]>; compact?: boolean }) {
  const first = paint.zones.find((z) => z.warning)?.id ?? null;
  const [sel, setSel] = useState<IrissPdPaintZoneId | null>(first);
  const pick = (id: IrissPdPaintZoneId) => setSel((cur) => (cur === id ? null : id));
  const zoneById = new Map(paint.zones.map((z) => [z.id, z]));
  // Tabulā tikai zonas ar mērījumu, bojājumu vai «nav mērāms».
  const tableZones = ZONE_ORDER.map((id) => zoneById.get(id)).filter(
    (z): z is NonNullable<typeof z> => Boolean(z) && (z!.readings.length > 0 || z!.warning || Boolean(z!.notMeasurable)),
  );

  return (
    <div>
      {!compact ? <p className="pd-mu" style={{ fontSize: 11.5, margin: "0 0 6px" }}>Izvēlies zonu, lai uzzinātu vairāk par stāvokli:</p> : null}
      <div className={`pd-pm pd-pm-car${compact ? " compact" : ""}`} style={{ height: "auto", aspectRatio: `${W} / ${H}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- tā pati bilde kā audita atskaitē, bez optimizācijas */}
        <img src={CAR_SRC} alt="" aria-hidden="true" className="pd-pm-img" style={{ top: py(IMG_TOP), height: py(IMG_H) }} />
        {ZONE_ORDER.map((id) => {
          const [x1, y1, x2, y2] = ZONES[id].area;
          return (
            <span
              key={`a-${id}`}
              className={`pd-pm-area${sel === id ? " sel" : ""}`}
              style={{ left: px(x1), top: py(y1), width: px(x2 - x1), height: py(y2 - y1) }}
              aria-hidden="true"
            />
          );
        })}
        {paint.zones.map((z) => {
          const [lx, ly] = ZONES[z.id].label;
          const on = sel === z.id;
          const isSide = z.id === "left" || z.id === "right";
          const points = isSide
            ? z.readings.slice(0, SIDE_X.length).map((n, i) => ({ n, x: SIDE_X[i]!, dot: SIDE[z.id as "left" | "right"].dot, chip: SIDE[z.id as "left" | "right"].chip }))
            : z.readings.slice(0, 1).map((n) => ({ n, x: lx, dot: TOP_DOT_Y, chip: TOP_CHIP_Y }));
          return (
            <span key={z.id}>
              <button
                type="button"
                className={`pd-lv pd-lv-zone${on ? " sel" : ""}`}
                style={{ left: px(lx), top: py(ly) }}
                onClick={() => pick(z.id)}
                aria-pressed={on}
              >
                {IRISS_PD_PAINT_ZONE_LV[z.id]}
                {z.warning ? <span className="pd-wa"> ▲</span> : null}
              </button>
              {points.map((p, i) => (
                <span key={i}>
                  <i className="pd-pm-dot" style={{ left: px(p.x), top: py(p.dot) }} aria-hidden="true" />
                  <span className={`pd-lv${on ? " sel" : ""}`} style={{ left: px(p.x), top: py(p.chip), fontWeight: isRepaint(p.n) ? 700 : undefined }}>
                    {um(p.n)}
                  </span>
                </span>
              ))}
              {!isSide && z.readings.length === 0 && z.notMeasurable ? (
                <span>
                  <i className="pd-pm-dot" style={{ left: px(lx), top: py(TOP_DOT_Y) }} aria-hidden="true" />
                  <span className={`pd-lv pd-lv-na${on ? " sel" : ""}`} style={{ left: px(lx), top: py(TOP_CHIP_Y) }}>
                    nav mērāms
                  </span>
                </span>
              ) : null}
            </span>
          );
        })}
      </div>
      <div className="pd-pm-cap">
        Krāsas biezums µm · ◐ pārkrāsots (≥{IRISS_PD_REPAINT_UM} µm) · <span className="pd-wa">▲</span> zonā atrasti bojājumi (buktes, skrāpējumi u.c.)
      </div>
      {/* Visi mērījumi tabulā: kartē sānos ietilpst 4, augšskatā 1. */}
      <table className="mt-2.5 w-full border-collapse text-left text-[12.5px] leading-snug" data-paint-table="">
        <thead>
          <tr className="text-[10.5px] uppercase tracking-[0.06em] text-[#6e6e73]">
            <th className="border-b border-[#e4e4e7] py-1.5 pr-2 font-semibold">Zona</th>
            <th className="border-b border-[#e4e4e7] py-1.5 pr-2 font-semibold">Mērījumi</th>
            <th className="border-b border-[#e4e4e7] py-1.5 text-right font-semibold">Bojājumi</th>
          </tr>
        </thead>
        <tbody>
          {tableZones.map((z) => (
            <tr key={z.id} className={`cursor-pointer align-top ${sel === z.id ? "bg-[#eef3fd]" : ""}`} onClick={() => pick(z.id)}>
              <td className="border-b border-[#f3f4f6] py-1.5 pr-2 font-semibold text-[#111827]">{IRISS_PD_PAINT_ZONE_LV[z.id]}</td>
              <td className="border-b border-[#f3f4f6] py-1.5 pr-2 tabular-nums text-[#111827]">
                {z.readings.length ? (
                  <span className="flex flex-wrap gap-x-2.5 gap-y-0.5">
                    {z.readings.map((n, i) => (
                      <span key={i} className={isRepaint(n) ? "font-bold text-[#b45309]" : undefined}>
                        {um(n)}
                      </span>
                    ))}
                  </span>
                ) : z.notMeasurable ? (
                  <span className="text-[#6e6e73]">nav mērāms (materiāls)</span>
                ) : (
                  <span className="text-[#a1a1aa]">-</span>
                )}
              </td>
              <td className="border-b border-[#f3f4f6] py-1.5 text-right">
                {z.warning ? <span className="pd-wa font-semibold">▲ ir</span> : <span className="text-[#a1a1aa]">-</span>}
              </td>
            </tr>
          ))}
          {paint.unassigned.length ? (
            <tr className="align-top">
              <td className="py-1.5 pr-2 font-semibold text-[#111827]">Bez zonas</td>
              <td className="py-1.5 pr-2 tabular-nums text-[#111827]" colSpan={2}>
                <span className="flex flex-wrap gap-x-2.5 gap-y-0.5">
                  {paint.unassigned.map((n, i) => (
                    <span key={i} className={isRepaint(n) ? "font-bold text-[#b45309]" : undefined}>
                      {um(n)}
                    </span>
                  ))}
                </span>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
