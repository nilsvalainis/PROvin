"use client";

import "@/components/iriss-piedavajumi/piedavajumi.css";
import { useState, type CSSProperties } from "react";
import {
  IRISS_PD_PAINT_ZONE_LV,
  IRISS_PD_REPAINT_UM,
  type IrissPdAuto1Blocks,
  type IrissPdPaintZoneId,
} from "@/lib/iriss-piedavajumi-auto1";

type Pt = [number, number];

/**
 * Auto1 «Exterior» shēma: centrā auto no augšas (priekša pa kreisi), virs tā labā puse, zem tā kreisā puse.
 * viewBox 600×360; karte tur tādu pašu proporciju (aspect-ratio), tāpēc etiķešu % sakrīt ar zīmējumu.
 */
const VIEW_W = 600;
const VIEW_H = 440;

/** Sāna profils (kreisā puse, priekša pa kreisi). Labā puse = tas pats, apgriezts vertikāli. */
const SIDE_BODY =
  "M60 388 L60 362 Q62 348 82 344 L192 334 Q224 306 268 300 L396 298 Q428 302 456 330 L520 336 Q540 340 540 360 L540 388 L490 388 A30 30 0 0 0 430 388 L184 388 A30 30 0 0 0 124 388 Z";
const SIDE_WINDOWS = "M206 336 Q234 312 268 306 L322 305 L322 336 Z M330 305 L394 304 Q420 308 444 332 L330 336 Z";
const SIDE_LINES = "M326 305 L326 388 M204 338 L204 386 M448 334 L448 386";
const WHEELS: Pt[] = [
  [154, 388],
  [460, 388],
];

/** Auto no augšas (centrā, y 160-280). */
const TOP_GLASS =
  "M200 168 L246 178 Q240 220 246 262 L200 272 Q196 220 200 168 Z M392 178 L432 168 Q437 220 432 272 L392 262 Q398 220 392 178 Z";
const TOP_LINES = "M90 190 Q140 184 196 180 M90 250 Q140 256 196 260";

const ZONE_PATH: Record<IrissPdPaintZoneId, string> = {
  front: "M98 164 Q70 168 66 192 L66 248 Q70 272 98 276 L200 272 Q196 220 200 168 Z",
  roof: "M246 178 L392 178 Q398 220 392 262 L246 262 Q240 220 246 178 Z",
  rear: "M432 168 L470 162 Q530 166 536 194 L536 246 Q530 274 470 278 L432 272 Q437 220 432 168 Z",
  left: SIDE_BODY,
  right: SIDE_BODY,
};

/** Labā puse: sāna profils apgriezts ap auto centru (riteņi uz āru, jumts pret auto centru). */
const FLIP = `matrix(1 0 0 -1 0 ${VIEW_H})`;

/** Zonas nosaukums un mērījumu vietas (% no laukuma). Visi mērījumi ir arī tabulā zem kartes. */
const LABEL_AT: Record<IrissPdPaintZoneId, Pt> = {
  right: [50, 3],
  front: [22, 40.5],
  roof: [53, 40.5],
  rear: [80.5, 40.5],
  left: [50, 97],
};
/** Mērījumu vietas: [x datorā, y, x telefonā]. Telefonā sānos tikai 2 (pārējie tabulā), citādi pārklājas. */
type Slot = [number, number, number?];
const SLOTS: Record<IrissPdPaintZoneId, Slot[]> = {
  right: [[32, 17.7, 37], [43, 17.7, 63], [54, 17.7], [65, 17.7]],
  front: [[22, 50.5], [22, 59.5]],
  roof: [[53, 50.5], [53, 59.5]],
  rear: [[80.5, 50.5], [80.5, 59.5]],
  left: [[32, 82.3, 37], [43, 82.3, 63], [54, 82.3], [65, 82.3]],
};
/** Sānos 3. un 4. mērījums telefonā kartē nav redzams (tabulā ir). */
const PHONE_SIDE_LIMIT = 2;

const ZONE_ORDER: IrissPdPaintZoneId[] = ["front", "roof", "rear", "left", "right"];

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
  const zoneById = new Map(paint.zones.map((z) => [z.id, z]));
  const zoneFill = (id: IrissPdPaintZoneId) => {
    if (sel === id) return "#e8f1fb";
    return zoneById.get(id)?.readings.some(isRepaint) ? "#fff4e5" : "#ffffff";
  };
  const zoneStroke = (id: IrissPdPaintZoneId) => (sel === id ? "#1f6fc4" : "#c7c7cc");
  const pick = (id: IrissPdPaintZoneId) => setSel((cur) => (cur === id ? null : id));
  const tableZones = ZONE_ORDER.map((id) => zoneById.get(id)).filter((z): z is NonNullable<typeof z> => Boolean(z));

  return (
    <div>
      {!compact ? <p className="pd-mu" style={{ fontSize: 11.5, margin: "0 0 6px" }}>Izvēlies zonu, lai uzzinātu vairāk par stāvokli:</p> : null}
      <div className="pd-pm" style={{ height: "auto", aspectRatio: `${VIEW_W} / ${VIEW_H}` }}>
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} aria-hidden="true">
          <g strokeLinejoin="round" strokeLinecap="round">
            {/* Labā puse (augšā, apgriezta) */}
            <g transform={FLIP}>
              <path d={ZONE_PATH.right} fill={zoneFill("right")} stroke={zoneStroke("right")} strokeWidth={sel === "right" ? 2 : 1.4} />
              <path d={SIDE_WINDOWS} fill="#eef1f4" stroke="#d1d4da" strokeWidth={1} />
              <path d={SIDE_LINES} fill="none" stroke="#d1d4da" strokeWidth={1} />
              {WHEELS.map(([cx, cy]) => (
                <g key={cx}>
                  <circle cx={cx} cy={cy} r={21} fill="#ffffff" stroke="#9aa1ad" strokeWidth={1.4} />
                  <circle cx={cx} cy={cy} r={9} fill="none" stroke="#d1d4da" strokeWidth={1} />
                </g>
              ))}
            </g>
            {/* Auto no augšas */}
            {(["front", "roof", "rear"] as const).map((id) => (
              <path key={id} d={ZONE_PATH[id]} fill={zoneFill(id)} stroke={zoneStroke(id)} strokeWidth={sel === id ? 2 : 1.4} />
            ))}
            <path d={TOP_GLASS} fill="#eef1f4" stroke="#c7c7cc" strokeWidth={1.2} />
            <path d={TOP_LINES} fill="none" stroke="#dfe3ea" strokeWidth={1} />
            {/* Kreisā puse (apakšā) */}
            <path d={ZONE_PATH.left} fill={zoneFill("left")} stroke={zoneStroke("left")} strokeWidth={sel === "left" ? 2 : 1.4} />
            <path d={SIDE_WINDOWS} fill="#eef1f4" stroke="#d1d4da" strokeWidth={1} />
            <path d={SIDE_LINES} fill="none" stroke="#d1d4da" strokeWidth={1} />
            {WHEELS.map(([cx, cy]) => (
              <g key={cx}>
                <circle cx={cx} cy={cy} r={21} fill="#ffffff" stroke="#9aa1ad" strokeWidth={1.4} />
                <circle cx={cx} cy={cy} r={9} fill="none" stroke="#d1d4da" strokeWidth={1} />
              </g>
            ))}
          </g>
        </svg>
        {paint.zones.map((z) => {
          const [x, y] = LABEL_AT[z.id];
          const slots = SLOTS[z.id];
          return (
            <span key={z.id}>
              <button
                type="button"
                className={`pd-lv${sel === z.id ? " sel" : ""}`}
                style={{ left: `${x}%`, top: `${y}%` }}
                onClick={() => pick(z.id)}
                aria-pressed={sel === z.id}
              >
                {IRISS_PD_PAINT_ZONE_LV[z.id]}
                {z.warning ? <span className="pd-wa"> ▲</span> : null}
              </button>
              {z.readings.slice(0, slots.length).map((n, i) => {
                const [x, y, xPhone] = slots[i]!;
                const side = z.id === "left" || z.id === "right";
                return (
                <span
                  key={i}
                  className={`pd-lv pd-lv-slot${sel === z.id ? " sel" : ""}${side && i >= PHONE_SIDE_LIMIT ? " pd-lv-wide" : ""}`}
                  style={
                    {
                      "--x": `${x}%`,
                      "--x-sm": `${xPhone ?? x}%`,
                      top: `${y}%`,
                      fontSize: compact ? 9 : undefined,
                      fontWeight: isRepaint(n) ? 700 : undefined,
                    } as CSSProperties
                  }
                >
                  {um(n)}
                </span>
                );
              })}
            </span>
          );
        })}
      </div>
      <div className="pd-pm-cap">
        Krāsas biezums µm · ◐ pārkrāsots (≥{IRISS_PD_REPAINT_UM} µm) · <span className="pd-wa">▲</span> zonā atrasti bojājumi (buktes, skrāpējumi u.c.)
      </div>
      {/* Visi mērījumi tabulā: kartē ietilpst tikai daļa, pārējie agrāk bija tikai rindā «Vēl». */}
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
            <tr
              key={z.id}
              className={`cursor-pointer align-top ${sel === z.id ? "bg-[#eef3fd]" : ""}`}
              onClick={() => pick(z.id)}
            >
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
