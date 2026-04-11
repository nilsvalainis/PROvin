/**
 * Tikai 911 „flyline” — viena līnija, z-1, zem satura.
 */
export function AutoWireframeBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1] overflow-hidden opacity-10 [mask-image:linear-gradient(to_bottom,transparent_0%,transparent_38vh,black_52vh)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,transparent_38vh,black_52vh)]"
    >
      <div className="flex h-full w-full items-center justify-center px-4 sm:px-6">
        <svg
          className="h-auto w-full max-w-[min(96vw,1100px)] text-[#c4c8d0]"
          viewBox="0 0 1200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid meet"
        >
          <path
            fill="none"
            vectorEffect="non-scaling-stroke"
            stroke="currentColor"
            strokeWidth={0.45}
            strokeLinecap="round"
            d="M 120 128 C 260 72 420 62 600 88 C 780 114 920 108 1080 78"
          />
        </svg>
      </div>
    </div>
  );
}
