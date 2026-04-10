"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useMemo } from "react";

/**
 * Fiksēts „auto šasijas / datu režģa” wireframe — scroll morfēšana + paralakse krustiem.
 */
export function AutoWireframeEngine() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();

  const rotate = useTransform(scrollYProgress, [0, 0.5, 1], reduce ? [0, 0, 0] : [0, 4, -3]);
  const scale = useTransform(scrollYProgress, [0, 0.45, 1], reduce ? [1, 1, 1] : [1, 1.04, 0.98]);
  const driftX = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, -18]);
  const parallaxY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, 32]);

  const grid = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const w = 100;
    const h = 100;
    for (let i = 0; i <= 10; i++) {
      const t = (i / 10) * w;
      lines.push({ x1: t, y1: 0, x2: t, y2: h });
      lines.push({ x1: 0, y1: (i / 10) * h, x2: w, y2: (i / 10) * h });
    }
    lines.push({ x1: 0, y1: 70, x2: 45, y2: 30 });
    lines.push({ x1: 55, y1: 28, x2: 100, y2: 62 });
    lines.push({ x1: 20, y1: 100, x2: 78, y2: 0 });
    return lines;
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <motion.div
        className="absolute inset-[-12%] will-change-transform transform-gpu"
        style={{ rotate, scale, x: driftX }}
      >
        <svg
          className="h-full w-full opacity-[0.22]"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <linearGradient id="wire-silver" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#b8bcc4" stopOpacity="0.35" />
              <stop offset="50%" stopColor="#e8eaef" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#b8bcc4" stopOpacity="0.3" />
            </linearGradient>
          </defs>
          {grid.map((l, i) => (
            <line
              key={`g-${i}`}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              stroke="url(#wire-silver)"
              strokeWidth={0.5}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      </motion.div>

      <motion.div
        className="absolute inset-0 will-change-transform transform-gpu"
        style={{ y: parallaxY }}
      >
        <svg className="h-full w-full opacity-[0.14]" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
          <g fill="none" stroke="#b8bcc4" strokeWidth={0.35} opacity={0.7}>
            <path d="M12 18h6v-6h-6z" />
            <path d="M82 74h6v-6h-6z" />
            <path d="M48 52h5v-5h-5z" />
          </g>
          <text x="14" y="34" fill="#b8bcc4" fontSize="3.2" opacity={0.45} className="font-mono">
            REF: PV-79
          </text>
          <text x="68" y="22" fill="#b8bcc4" fontSize="2.8" opacity={0.38} className="font-mono">
            REF: AX-12
          </text>
        </svg>
      </motion.div>
    </div>
  );
}
