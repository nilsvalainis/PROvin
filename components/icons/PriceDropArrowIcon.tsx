"use client";

/** Sarkanā brīdinājuma trijstūņa (#FF4D4D) krāsa; izmērs +30% pret 13px brīdinājuma ikonu (~17px). */
const PRICE_DROP_ARROW_STROKE = "#FF4D4D";
export const PRICE_DROP_ARROW_PX = 17;

/**
 * Minimāla bultiņa uz leju — „Cenas kritums” lauka prefikss (saskan ar PDF).
 */
export function PriceDropArrowIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`shrink-0 ${className}`.trim()}
      width={PRICE_DROP_ARROW_PX}
      height={PRICE_DROP_ARROW_PX}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M12 5v14"
        stroke={PRICE_DROP_ARROW_STROKE}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m19 12-7 7-7-7"
        stroke={PRICE_DROP_ARROW_STROKE}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
