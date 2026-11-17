"use client";

import "@/components/iriss-piedavajumi/piedavajumi.css";
import { useState, type CSSProperties } from "react";
import {
  IRISS_PD_PAINT_ZONE_LV,
  IRISS_PD_REPAINT_UM,
  type IrissPdAuto1Blocks,
  type IrissPdPaintZoneId,
} from "@/lib/iriss-piedavajumi-auto1";

/**
 * Auto1 «Exterior» kompozīcija (Nils 17.11: "identisks noformējums"):
 * centrā auto no augšas (priekša pa kreisi), malās priekšas un aizmugures skats,
 * labās puses profils uzklāts virs augšējās malas (riteņi uz āru), kreisās puses - virs apakšējās.
 * Katram mērījumam punkts + etiķete. viewBox 600×400; karte tur to pašu proporciju (aspect-ratio).
 */
const VIEW_W = 600;
const VIEW_H = 400;
/** Redzamais laukums (y 14-394): bez tukšas joslas virs labās puses profila. */
const VIEW_Y0 = 14;
const VIEW_SHOWN_H = 380;

/** Auto no augšas (y 124-276). Stikli nav zona. */
const TOP_FRONT = "M112 130 Q92 136 90 164 L90 236 Q92 264 112 270 L212 276 Q200 200 212 124 Z";
const TOP_ROOF = "M252 138 L378 138 Q386 200 378 262 L252 262 Q244 200 252 138 Z";
const TOP_REAR = "M416 124 L488 130 Q508 136 510 164 L510 236 Q508 264 488 270 L416 276 Q426 200 416 124 Z";
const TOP_GLASS =
  "M212 124 L252 138 Q244 200 252 262 L212 276 Q200 200 212 124 Z M378 138 L416 124 Q426 200 416 276 L378 262 Q386 200 378 138 Z";
const TOP_LINES = "M104 160 Q150 152 204 146 M104 240 Q150 248 204 254 M426 150 Q470 152 500 160 M426 250 Q470 248 500 240";

/** Priekšas un aizmugures skats (vertikāli, malās) - daļa no attiecīgās zonas. */
const END_FRONT = "M32 136 H52 Q62 136 62 146 V254 Q62 264 52 264 H32 Q22 264 22 254 V146 Q22 136 32 136 Z M22 150 H14 V172 H22 M22 228 H14 V250 H22";
const END_FRONT_LINES = "M42 150 V250 M30 182 H54 M30 218 H54";
const END_REAR = "M548 136 H568 Q578 136 578 146 V254 Q578 264 568 264 H548 Q538 264 538 254 V146 Q538 136 548 136 Z M578 150 H586 V172 H578 M578 228 H586 V250 H578";
const END_REAR_LINES = "M558 150 V250 M546 182 H570 M546 218 H570";

/** Sāna profils (kreisā puse, priekša pa kreisi, y 256-374). Labā puse = tas pats, apgriezts ap y=200. */
const SIDE_BODY =
  "M112 352 L110 334 Q112 322 130 318 L196 306 Q236 270 288 258 L370 256 Q404 258 440 288 L476 296 Q492 300 492 318 L492 350 L472 352 A26 26 0 0 0 420 352 L190 352 A26 26 0 0 0 138 352 Z";
const SIDE_WINDOWS = "M214 306 Q246 276 288 266 L326 265 L326 306 Z M334 265 L368 264 Q394 268 420 300 L334 306 Z";
const SIDE_LINES = "M330 265 V350 M210 308 V348 M430 300 V348 M136 322 Q150 318 166 318";
const WHEELS: Array<[number, number]> = [
  [164, 352],
  [446, 352],
];
const FLIP = `matrix(1 0 0 -1 0 ${VIEW_H})`;

/** Zonu nosaukumi (viewBox koordinātēs). */
const LABEL_AT: Record<IrissPdPaintZoneId, [number, number]> = {
  right: [300, 30],
  front: [150, 176],
  roof: [315, 176],
  rear: [462, 176],
  left: [300, 378],
};

/**
 * Mērījumu punkti: [x datorā, punkta y, etiķetes y, x telefonā?]. Sānos telefonā tikai 2 (pārējie tabulā).
 * Sānos etiķete virs punkta, augšskatā zem punkta (kā Auto1).
 */
type Slot = [number, number, number, number?];
const SLOTS: Record<IrissPdPaintZoneId, Slot[]> = {
  right: [[200, 82, 64, 200], [275, 82, 64, 355], [355, 82, 64], [430, 82, 64]],
  front: [[150, 194, 216], [150, 216, 238]],
  roof: [[315, 194, 216], [315, 216, 238]],
  rear: [[462, 194, 216], [462, 216, 238]],
  left: [[200, 320, 302, 200], [275, 320, 302, 355], [355, 320, 302], [430, 320, 302]],
};
const PHONE_SIDE_LIMIT = 2;

const ZONE_ORDER: IrissPdPaintZoneId[] = ["front", "roof", "rear", "left", "right"];

const pctX = (x: number) => `${(x / VIEW_W) * 100}%`;
const pctY = (y: number) => `${((y - VIEW_Y0) / VIEW_SHOWN_H) * 100}%`;

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
  const fill = (id: IrissPdPaintZoneId) => {
    if (sel === id) return "#e8f2fc";
    return zoneById.get(id)?.readings.some(isRepaint) ? "#fff4e5" : "#ffffff";
  };
  const stroke = (id: IrissPdPaintZoneId) => (sel === id ? "#1f6fc4" : "#d1d1d6");
  const sw = (id: IrissPdPaintZoneId) => (sel === id ? 1.6 : 1.2);
  const detail = (id: IrissPdPaintZoneId) => (sel === id ? "#7baaf7" : "#d1d1d6");
  const pick = (id: IrissPdPaintZoneId) => setSel((cur) => (cur === id ? null : id));
  const tableZones = ZONE_ORDER.map((id) => zoneById.get(id)).filter((z): z is NonNullable<typeof z> => Boolean(z));

  const side = (id: "left" | "right") => (
    <g transform={id === "right" ? FLIP : undefined}>
      <path d={SIDE_BODY} fill={fill(id)} stroke={stroke(id)} strokeWidth={sw(id)} />
      <path d={SIDE_WINDOWS} fill="none" stroke={detail(id)} strokeWidth={1} />
      <path d={SIDE_LINES} fill="none" stroke={detail(id)} strokeWidth={1} />
      {WHEELS.map(([cx, cy]) => (
        <g key={cx}>
          <circle cx={cx} cy={cy} r={22} fill="#ffffff" stroke={stroke(id)} strokeWidth={sw(id)} />
          <circle cx={cx} cy={cy} r={14} fill="none" stroke={detail(id)} strokeWidth={1} />
        </g>
      ))}
    </g>
  );

  return (
    <div>
      {!compact ? <p className="pd-mu" style={{ fontSize: 11.5, margin: "0 0 6px" }}>Izvēlies zonu, lai uzzinātu vairāk par stāvokli:</p> : null}
      <div className="pd-pm pd-pm-a1" style={{ height: "auto", aspectRatio: `${VIEW_W} / ${VIEW_SHOWN_H}` }}>
        <span className="ttl pd-lv-wide">Ārpuse</span>
        <svg viewBox={`0 ${VIEW_Y0} ${VIEW_W} ${VIEW_SHOWN_H}`} aria-hidden="true">
          <g strokeLinejoin="round" strokeLinecap="round">
            {/* Augšskats un malu skati (zem sānu profiliem) */}
            <path d={END_FRONT} fill={fill("front")} stroke={stroke("front")} strokeWidth={sw("front")} />
            <path d={END_FRONT_LINES} fill="none" stroke={detail("front")} strokeWidth={1} />
            <path d={END_REAR} fill={fill("rear")} stroke={stroke("rear")} strokeWidth={sw("rear")} />
            <path d={END_REAR_LINES} fill="none" stroke={detail("rear")} strokeWidth={1} />
            <path d={TOP_FRONT} fill={fill("front")} stroke={stroke("front")} strokeWidth={sw("front")} />
            <path d={TOP_ROOF} fill={fill("roof")} stroke={stroke("roof")} strokeWidth={sw("roof")} />
            <path d={TOP_REAR} fill={fill("rear")} stroke={stroke("rear")} strokeWidth={sw("rear")} />
            <path d={TOP_GLASS} fill="#ffffff" stroke="#d1d1d6" strokeWidth={1.2} />
            <path d={TOP_LINES} fill="none" stroke="#e5e5ea" strokeWidth={1} />
            {/* Sānu profili virs augšskata malām; izvēlētais zīmēts pēdējais */}
            {sel === "right" ? side("left") : side("right")}
            {sel === "right" ? side("right") : side("left")}
          </g>
        </svg>
        {paint.zones.map((z) => {
          const [lx, ly] = LABEL_AT[z.id];
          const slots = SLOTS[z.id];
          const isSide = z.id === "left" || z.id === "right";
          return (
            <span key={z.id}>
              <button
                type="button"
                className={`pd-lv pd-lv-zone${sel === z.id ? " sel" : ""}`}
                style={{ left: pctX(lx), top: pctY(ly) }}
                onClick={() => pick(z.id)}
                aria-pressed={sel === z.id}
              >
                {IRISS_PD_PAINT_ZONE_LV[z.id]}
                {z.warning ? <span className="pd-wa"> ▲</span> : null}
              </button>
              {z.readings.slice(0, slots.length).map((n, i) => {
                const [x, dotY, chipY, xPhone] = slots[i]!;
                // Telefonā: sānos 2, augšskatā 1 mērījums (citādi pārklājas); visi ir tabulā.
                const wide = i >= (isSide ? PHONE_SIDE_LIMIT : 1) ? " pd-lv-wide" : "";
                const pos = { "--x": pctX(x), "--x-sm": pctX(xPhone ?? x) } as CSSProperties;
                // Augšskatā punkts tikai pirmajam mērījumam (otrais ir zem tā kā saraksts).
                const dot = isSide || i === 0;
                return (
                  <span key={i}>
                    {dot ? <i className={`pd-pm-dot pd-lv-slot${wide}`} style={{ ...pos, top: pctY(dotY) }} aria-hidden="true" /> : null}
                    <span
                      className={`pd-lv pd-lv-slot${wide}${sel === z.id ? " sel" : ""}`}
                      style={{ ...pos, top: pctY(chipY), fontSize: compact ? 9 : undefined, fontWeight: isRepaint(n) ? 700 : undefined }}
                    >
                      {um(n)}
                    </span>
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
      {/* Visi mērījumi tabulā: kartē ietilpst tikai daļa. */}
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
