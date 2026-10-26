"use client";

import "@/components/iriss-piedavajumi/piedavajumi.css";
import { useState } from "react";
import {
  IRISS_PD_PAINT_ZONE_LV,
  IRISS_PD_REPAINT_UM,
  type IrissPdAuto1Blocks,
  type IrissPdPaintZoneId,
} from "@/lib/iriss-piedavajumi-auto1";

type Pt = [number, number];

/** Zonas nosaukuma un mērījumu vietas kartē (% no laukuma). */
const LABEL_AT: Record<IrissPdPaintZoneId, Pt> = {
  right: [50, 7],
  front: [24, 44],
  roof: [56, 44],
  rear: [84, 44],
  left: [50, 94],
};
const SLOTS: Record<IrissPdPaintZoneId, Pt[]> = {
  right: [[22, 22], [41, 22], [60, 22], [79, 22]],
  front: [[24, 57], [24, 69]],
  roof: [[56, 57], [56, 69]],
  rear: [[84, 57], [84, 69]],
  left: [[22, 79], [41, 79], [60, 79], [79, 79]],
};

const ZONE_PATH: Record<IrissPdPaintZoneId, string> = {
  right: "M18 15 Q30 8 45 14 L80 14 Q90 12 92 22 L92 30 L18 30Z",
  left: "M18 70 L80 70 L92 70 Q90 86 80 86 L45 86 Q30 92 18 85Z",
  roof: "M44 34 L68 34 Q72 50 68 66 L44 66 Q40 50 44 34Z",
  front: "M20 33 L44 36 Q41 50 44 64 L20 67 Q16 50 20 33Z M6 34h12v32H6z",
  rear: "M68 35 L84 33 L84 67 L68 65Z M84 34h10v32h-10z",
};

function um(n: number): string {
  return `${n >= IRISS_PD_REPAINT_UM ? "◐ " : ""}${n} µm`;
}

/** Ārpuses krāsas karte (Auto1 «Exterior»): µm katrai zonai, ▲ - zonā atrasti bojājumi. */
export function PdPaintMap({ paint, compact = false }: { paint: NonNullable<IrissPdAuto1Blocks["paint"]>; compact?: boolean }) {
  const first = paint.zones.find((z) => z.warning)?.id ?? null;
  const [sel, setSel] = useState<IrissPdPaintZoneId | null>(first);
  const extra = paint.zones.flatMap((z) => z.readings.slice(SLOTS[z.id].length).map((n) => `${IRISS_PD_PAINT_ZONE_LV[z.id]} ${um(n)}`));
  return (
    <div>
      {!compact ? <p className="pd-mu" style={{ fontSize: 11.5, margin: "0 0 6px" }}>Izvēlies zonu, lai uzzinātu vairāk par stāvokli:</p> : null}
      <div className="pd-pm" style={compact ? { height: 160 } : undefined}>
        <span className="ttl">Ārpuse</span>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <g fill="none" stroke="#d1d4da" strokeWidth={0.5}>
            {(Object.keys(ZONE_PATH) as IrissPdPaintZoneId[]).map((z) => (
              <path
                key={z}
                d={ZONE_PATH[z]}
                fill={sel === z ? "#e8f1fb" : "none"}
                stroke={sel === z ? "#1f6fc4" : "#d1d4da"}
                strokeWidth={sel === z ? 0.7 : 0.5}
              />
            ))}
            <circle cx="30" cy="18" r="5" />
            <circle cx="72" cy="18" r="5" />
            <circle cx="30" cy="84" r="5" />
            <circle cx="72" cy="84" r="5" />
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
                onClick={() => setSel(z.id)}
                aria-pressed={sel === z.id}
              >
                {IRISS_PD_PAINT_ZONE_LV[z.id]}
                {z.warning ? <span className="pd-wa"> ▲</span> : null}
              </button>
              {z.readings.slice(0, slots.length).map((n, i) => (
                <span
                  key={i}
                  className={`pd-lv${sel === z.id ? " sel" : ""}`}
                  style={{ left: `${slots[i]![0]}%`, top: `${slots[i]![1]}%`, fontSize: compact ? 9 : undefined }}
                >
                  {um(n)}
                </span>
              ))}
            </span>
          );
        })}
      </div>
      <div className="pd-pm-cap">
        Krāsas biezums µm · ◐ pārkrāsots (≥{IRISS_PD_REPAINT_UM} µm) · <span className="pd-wa">▲</span> zonā atrasti bojājumi
        {sel ? ` · atlasīta: ${IRISS_PD_PAINT_ZONE_LV[sel]}` : ""}
        {extra.length ? <div>Vēl: {extra.join(", ")}</div> : null}
        {paint.unassigned.length ? <div>Mērījumi: {paint.unassigned.map(um).join(", ")}</div> : null}
      </div>
    </div>
  );
}
