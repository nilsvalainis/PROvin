/**
 * Īss skaidrojums — hero orbitālie gredzeni kā 3D diski (`rotateX` + `rotateY` uz pleciem).
 */
function DemoOrbitMini({ isStatic = false }: { isStatic?: boolean }) {
  return (
    <div className={`demo-orbit-mini${isStatic ? " demo-orbit-mini--static" : ""}`} aria-hidden>
      <div className="demo-orbit-mini-stage">
        <div className="demo-orbit-mini-arm demo-orbit-mini-arm--outer">
          <span className="demo-orbit-mini-disk demo-orbit-mini-disk--outer" />
        </div>
        <div className="demo-orbit-mini-arm demo-orbit-mini-arm--inner">
          <span className="demo-orbit-mini-disk demo-orbit-mini-disk--inner" />
        </div>
      </div>
    </div>
  );
}

export function OrbitRingsExplainer() {
  return (
    <div className="demo-orbit-mini-lab border-t border-white/10 px-4 py-6 sm:px-6">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">Gredzenu animācija</h2>
      <p className="mt-2 max-w-[42rem] text-[12px] leading-relaxed text-white/45">
        <strong className="font-medium text-white/60">3D skatuve</strong> —{' '}
        <code className="rounded bg-white/[0.06] px-1 font-mono text-[11px] text-white/60">perspective</code> +{' '}
        <code className="rounded bg-white/[0.06] px-1 font-mono text-[11px] text-white/60">preserve-3d</code>; katram gredzenam plecs ar{' '}
        <code className="font-mono text-[11px] text-white/60">rotateY</code>: ārējais{' '}
        <code className="rounded bg-white/[0.06] px-1 font-mono text-[11px] text-white/60">hero-orbit-arm-spin-a</code> (0→360°), iekšējais{' '}
        <code className="rounded bg-white/[0.06] px-1 font-mono text-[11px] text-white/60">hero-orbit-arm-spin-b</code> (0→−360°); diski ar{' '}
        <code className="font-mono text-[11px] text-white/60">rotateX</code> (slīpums) un iekšējam viegls{' '}
        <code className="font-mono text-[11px] text-white/60">rotateZ</code>, lai plaknes krustojas un dziļums mainās. Pilnekrāna{' '}
        <span className="text-white/70">S19</span> / <span className="text-white/70">S20</span>; labajā pusē —{' '}
        <code className="font-mono text-[11px] text-white/60">animation: none</code> salīdzinājumam.
      </p>
      <div className="mt-4 flex flex-wrap items-start gap-8">
        <div className="flex flex-col items-center gap-2">
          <DemoOrbitMini />
          <span className="text-center text-[10px] font-medium uppercase tracking-wider text-white/40">Ar animāciju</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <DemoOrbitMini isStatic />
          <span className="text-center text-[10px] font-medium uppercase tracking-wider text-white/40">Bez animācijas</span>
        </div>
      </div>
    </div>
  );
}
