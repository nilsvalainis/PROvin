"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import {
  buildGaugeTicks,
  GAUGE_SPEED_MAX,
  MAJOR_SPEEDS,
  polar,
  speedToAngleRad,
} from "@/lib/home-speedometer";

const CX = 500;
const CY = 546;
const NEEDLE_LEN = 382;
const LABEL_R = 348;
const ODO_X = 444;
const ODO_Y = 398;
const DIGIT_W = 15.5;
const DIGIT_H = 19;
const SILVER = "#c8ccd4";
const INK = "#1a1c20";
const BLUE = "#0066ff";

function scrollProgress01(): number {
  if (typeof window === "undefined" || typeof document === "undefined") return 0;
  const el = document.documentElement;
  const max = Math.max(1, el.scrollHeight - window.innerHeight);
  const y = window.scrollY || window.pageYOffset || 0;
  return Math.min(1, Math.max(0, y / max));
}

function digitScrollY(raw: number, pow: number): number {
  const local = (raw / pow) % 10;
  const norm = local < 0 ? local + 10 : local;
  return -norm * DIGIT_H;
}

export function HomeSpeedometerBackground() {
  const filterId = useId().replace(/:/g, "");
  const ticks = useMemo(() => buildGaugeTicks(), []);

  const needleLineRef = useRef<SVGLineElement | null>(null);
  const digitStripRefs = useRef<(SVGGElement | null)[]>(Array.from({ length: 7 }, () => null));
  const smoothSpeedRef = useRef(0);
  const smoothOdoRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyFrame = () => {
      try {
        const p = scrollProgress01();
        const targetSpeed = p * GAUGE_SPEED_MAX;
        const targetOdo = p * 9_999_999;

        if (mq.matches) {
          smoothSpeedRef.current = targetSpeed;
          smoothOdoRef.current = targetOdo;
        } else {
          smoothSpeedRef.current += (targetSpeed - smoothSpeedRef.current) * 0.11;
          smoothOdoRef.current += (targetOdo - smoothOdoRef.current) * 0.14;
        }

        const s = smoothSpeedRef.current;
        const theta = speedToAngleRad(Number.isFinite(s) ? s : 0);
        const tip = polar(CX, CY, NEEDLE_LEN, theta);
        needleLineRef.current?.setAttribute("x2", String(tip.x));
        needleLineRef.current?.setAttribute("y2", String(tip.y));

        const raw = smoothOdoRef.current;
        for (let i = 0; i < 7; i++) {
          const pow = 10 ** (6 - i);
          const ty = digitScrollY(Number.isFinite(raw) ? raw : 0, pow);
          digitStripRefs.current[i]?.setAttribute("transform", `translate(0, ${Number.isFinite(ty) ? ty : 0})`);
        }

        const settle =
          mq.matches ||
          (Math.abs(targetSpeed - smoothSpeedRef.current) < 0.035 &&
            Math.abs(targetOdo - smoothOdoRef.current) < 1.5);

        if (!settle) {
          rafRef.current = requestAnimationFrame(applyFrame);
        } else {
          rafRef.current = null;
        }
      } catch {
        rafRef.current = null;
      }
    };

    const kick = () => {
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(applyFrame);
      }
    };

    kick();
    window.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", kick, { passive: true });
    document.addEventListener("visibilitychange", kick);

    return () => {
      window.removeEventListener("scroll", kick);
      window.removeEventListener("resize", kick);
      document.removeEventListener("visibilitychange", kick);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const mphPos = polar(CX, CY, LABEL_R - 4, speedToAngleRad(70));

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[3] opacity-[0.14] mix-blend-normal sm:opacity-[0.17] md:opacity-[0.2]"
      aria-hidden
    >
      <svg
        className="h-full w-full"
        viewBox="0 0 1000 640"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {Array.from({ length: 7 }).map((_, i) => (
            <clipPath id={`${filterId}-d${i}`} key={`clip-${filterId}-${i}`}>
              <rect x={ODO_X + i * DIGIT_W} y={ODO_Y} width={DIGIT_W - 0.5} height={DIGIT_H + 1} rx="0.5" />
            </clipPath>
          ))}
        </defs>

        {/* Zila „ēna” — dublētas nobīdītas līnijas (bez SVG filter — mazāk WebKit avāriju). */}
        <g stroke={BLUE} strokeOpacity={0.22} vectorEffect="non-scaling-stroke" pointerEvents="none">
          {ticks.map((tk) => {
            const th = speedToAngleRad(tk.value);
            const ox = 0.55;
            const oy = 0.55;
            const pOut = polar(CX, CY, tk.outerR, th);
            const pIn = polar(CX, CY, tk.innerR, th);
            const sw =
              tk.kind === "major" ? 0.62 : tk.kind === "medium" ? 0.48 : 0.38;
            return (
              <line
                key={`tb-${tk.value}-${tk.kind}`}
                x1={pIn.x + ox}
                y1={pIn.y + oy}
                x2={pOut.x + ox}
                y2={pOut.y + oy}
                strokeWidth={sw}
                strokeLinecap="butt"
              />
            );
          })}
        </g>
        <g stroke={SILVER} vectorEffect="non-scaling-stroke" pointerEvents="none">
          {ticks.map((tk) => {
            const th = speedToAngleRad(tk.value);
            const pOut = polar(CX, CY, tk.outerR, th);
            const pIn = polar(CX, CY, tk.innerR, th);
            const sw =
              tk.kind === "major" ? 0.55 : tk.kind === "medium" ? 0.42 : 0.32;
            return (
              <line
                key={`t-${tk.value}-${tk.kind}`}
                x1={pIn.x}
                y1={pIn.y}
                x2={pOut.x}
                y2={pOut.y}
                strokeWidth={sw}
                strokeLinecap="butt"
              />
            );
          })}
        </g>

        <g fill={SILVER} stroke="none" style={{ textRendering: "geometricPrecision" }}>
          {MAJOR_SPEEDS.map((v) => {
            const th = speedToAngleRad(v);
            const p = polar(CX, CY, LABEL_R, th);
            return (
              <text
                key={`n-${v}`}
                x={p.x}
                y={p.y}
                fontSize={26}
                fontWeight={600}
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {v}
              </text>
            );
          })}

          <text
            x={mphPos.x}
            y={mphPos.y + 26}
            fontSize={15}
            fontWeight={600}
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            letterSpacing="0.14em"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            MPH
          </text>
        </g>

        <rect
          x={ODO_X - 4}
          y={ODO_Y - 3}
          width={7 * DIGIT_W + 8}
          height={DIGIT_H + 8}
          rx="1.5"
          fill="#0a0a0c"
          stroke={SILVER}
          strokeWidth={0.35}
          vectorEffect="non-scaling-stroke"
          opacity={0.92}
        />

        {Array.from({ length: 7 }).map((_, i) => (
          <g key={`odo-col-${i}`} clipPath={`url(#${filterId}-d${i})`}>
            <g
              ref={(el) => {
                digitStripRefs.current[i] = el;
              }}
            >
              {Array.from({ length: 10 }).map((__, d) => (
                <text
                  key={`odo-${i}-${d}`}
                  x={ODO_X + i * DIGIT_W + DIGIT_W * 0.48}
                  y={ODO_Y + d * DIGIT_H + DIGIT_H * 0.72}
                  fill="#f2f4f8"
                  fontSize={17}
                  fontWeight={500}
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  textAnchor="middle"
                >
                  {d}
                </text>
              ))}
            </g>
          </g>
        ))}

        <line
          ref={needleLineRef}
          x1={CX}
          y1={CY}
          x2={CX}
          y2={CY - NEEDLE_LEN}
          stroke={INK}
          strokeWidth={0.65}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          opacity={0.88}
        />
        <circle
          cx={CX}
          cy={CY}
          r={7}
          fill={INK}
          stroke={SILVER}
          strokeWidth={0.35}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
