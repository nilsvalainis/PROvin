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
  return `@keyframes eu-pk-${n}{${steps}}.eu-map .eu-pk-${n}{animation-name:eu-pk-${n}}`;
}).join("");

const RUN_PATH = euMapRuns()
  .map((r) => `M${r.x.toFixed(1)} ${r.y.toFixed(1)}h${(r.length + 0.01).toFixed(2)}`)
  .join("");

/**
 * Dekoratīva Eiropas punktu karte ar datu plūsmu uz Rīgu (Partneriem hero, sākumlapa).
 * Punkti ir viens `path` ar `stroke-dasharray` - HTML paliek mazs.
 */
export function EuropeDotMap({ className = "", packets = true }: { className?: string; packets?: boolean }) {
  return (
    <svg className={`eu-map ${className}`.trim()} viewBox={EU_MAP_VIEWBOX} aria-hidden focusable="false">
      {packets ? <style>{PACKET_KEYFRAMES}</style> : null}
      <path
        d={RUN_PATH}
        fill="none"
        stroke="rgba(185,200,230,.34)"
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={`0 ${EU_MAP_STEP}`}
      />
      {packets
        ? EU_MAP_PACKETS.map((p, n) => (
            <circle key={n} className={`eu-pk eu-pk-${n}`} r={4.5} cx={0} cy={0} style={{ animationDelay: `${p.delay}s` }} />
          ))
        : null}
      <circle className="eu-rg2" cx={EU_MAP_RIGA.x} cy={EU_MAP_RIGA.y} r={13} />
      <circle className="eu-rg1" cx={EU_MAP_RIGA.x} cy={EU_MAP_RIGA.y} r={12} />
    </svg>
  );
}
