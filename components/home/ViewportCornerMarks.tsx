/**
 * Stūru + atzīmes — zīmols #0066ff (CAD akcents).
 */
export function ViewportCornerMarks() {
  const cross = (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden className="text-[#0066ff]/85">
      <path
        d="M9 0.5V17.5M0.5 9H17.5"
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
