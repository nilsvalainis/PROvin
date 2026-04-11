export function AutoWireframeBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[2] flex justify-center overflow-visible"
    >
      <svg
        className="w-[min(280vw,3400px)] max-w-none shrink-0 -translate-y-[4%] sm:-translate-y-[6%]"
        viewBox="0 0 1100 360"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMax meet"
      >
        <path
          fill="none"
          vectorEffect="non-scaling-stroke"
          stroke="#ffffff"
          strokeOpacity={0.02}
          strokeWidth={0.55}
          strokeLinecap="round"
          d="M 200 250 C 400 150, 700 150, 900 250"
        />
      </svg>
    </div>
  );
}
