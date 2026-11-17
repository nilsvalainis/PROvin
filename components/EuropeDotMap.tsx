"use client";

import { useEffect, useRef } from "react";
import { EU_MAP_PACKETS, EU_MAP_RIGA, EU_MAP_STEP, EU_MAP_VIEWBOX, euMapRuns } from "@/lib/europe-dot-map";

/** Paketes kustības keyframes - ģenerēti vienreiz moduļa līmenī. */
const PACKET_KEYFRAMES = EU_MAP_PACKETS.map(({ path }, n) => {
  const last = path.length - 1;
  const steps = path
    .map(([x, y], i) => {
      const pct = ((i / last) * 100).toFixed(2);
      const opacity = i === 0 || i === last ? 0 : 1;
      return `${pct}%{transform:translate(${x}px,${y}px);opacity:${opacity}}`;
    })
    .join("");
  return `@keyframes eu-pk-${n}{${steps}}.eu-map-fx .eu-pk-${n}{animation-name:eu-pk-${n}}`;
}).join("");

const RUN_PATH = euMapRuns()
  .map((r) => `M${r.x.toFixed(1)} ${r.y.toFixed(1)}h${(r.length + 0.01).toFixed(2)}`)
  .join("");

/**
 * Dekoratīva Eiropas punktu karte ar datu plūsmu uz Rīgu (Partneriem hero, sākumlapa).
 * Ātrumam: punkti ir statisks slānis (viens `path`, savs kompozīcijas slānis, netiek pārzīmēts),
 * kustīgās paketes - atsevišķs mazs SVG bez filtriem; ārpus ekrāna animācijas apstājas.
 */
export function EuropeDotMap({ className = "", packets = true }: { className?: string; packets?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => {
      el.toggleAttribute("data-paused", !entry?.isIntersecting);
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`eu-map ${className}`.trim()} aria-hidden>
      <svg className="eu-map-dots" viewBox={EU_MAP_VIEWBOX} focusable="false">
        <path
          d={RUN_PATH}
          fill="none"
          stroke="rgba(185,200,230,.34)"
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={`0 ${EU_MAP_STEP}`}
        />
      </svg>
      <svg className="eu-map-fx" viewBox={EU_MAP_VIEWBOX} focusable="false">
        {packets ? <style>{PACKET_KEYFRAMES}</style> : null}
        {packets
          ? EU_MAP_PACKETS.map((p, n) => (
              <g key={n} className={`eu-pk eu-pk-${n}`} style={{ animationDelay: `${p.delay}s` }}>
                <circle r={9} cx={0} cy={0} className="eu-pk-glow" />
                <circle r={3.6} cx={0} cy={0} className="eu-pk-dot" />
              </g>
            ))
          : null}
        <circle className="eu-rg-glow" cx={EU_MAP_RIGA.x} cy={EU_MAP_RIGA.y} r={26} />
        <circle className="eu-rg2" cx={EU_MAP_RIGA.x} cy={EU_MAP_RIGA.y} r={13} />
        <circle className="eu-rg1" cx={EU_MAP_RIGA.x} cy={EU_MAP_RIGA.y} r={12} />
      </svg>
    </div>
  );
}
