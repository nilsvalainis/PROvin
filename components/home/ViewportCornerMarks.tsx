/**
 * Fixed viewport corner cues — minimal + marks (very faint on silver paper).
 */
export function ViewportCornerMarks() {
  const cross = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="text-white/[0.06]">
      <path
        d="M8 0.5V15.5M0.5 8H15.5"
        stroke="currentColor"
        strokeWidth={0.5}
        vectorEffect="non-scaling-stroke"
        strokeLinecap="square"
      />
    </svg>
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-[6]" aria-hidden>
      <div className="absolute left-[max(1rem,env(safe-area-inset-left,0px))] top-[max(1rem,env(safe-area-inset-top,0px))]">
        {cross}
      </div>
      <div className="absolute right-[max(1rem,env(safe-area-inset-right,0px))] top-[max(1rem,env(safe-area-inset-top,0px))]">
        {cross}
      </div>
      <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom,0px))] left-[max(1rem,env(safe-area-inset-left,0px))]">
        {cross}
      </div>
      <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom,0px))] right-[max(1rem,env(safe-area-inset-right,0px))]">
        {cross}
      </div>
    </div>
  );
}
