/**
 * Īss skaidrojums, kā orbitālajos hero gredzeni griežas (`::before` / `::after` + keyframes).
 */
export function OrbitRingsExplainer() {
  return (
    <div className="demo-orbit-mini-lab border-t border-white/10 px-4 py-6 sm:px-6">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">Gredzenu animācija</h2>
      <p className="mt-2 max-w-[42rem] text-[12px] leading-relaxed text-white/45">
        <strong className="font-medium text-white/60">Centrālie riņķi</strong> — divi pilni apļi sekcijas{' '}
        <code className="rounded bg-white/[0.06] px-1 font-mono text-[11px] text-white/60">::before</code> un{' '}
        <code className="rounded bg-white/[0.06] px-1 font-mono text-[11px] text-white/60">::after</code>; abi centrēti vienā punktā (
        <code className="font-mono text-[11px] text-white/60">left: 50%</code>, <code className="font-mono text-[11px] text-white/60">top: var(--orbit-y)</code>
        ), tad <code className="font-mono text-[11px] text-white/60">transform: translate(-50%, -50%) rotate(…)</code> — tātad{' '}
        <strong className="font-medium text-white/60">griešanās ap savu asi</strong> (punktu sekcijas centrā). Animācijas:{' '}
        <code className="rounded bg-white/[0.06] px-1 font-mono text-[11px] text-white/60">hero-orbit-spin-a</code> un{' '}
        <code className="rounded bg-white/[0.06] px-1 font-mono text-[11px] text-white/60">hero-orbit-spin-b</code> ar pretējiem virzieniem. Pilnekrāna{' '}
        <span className="text-white/70">S19</span> un <span className="text-white/70">S20</span> vienmēr ar šo rotāciju; šeit labajā pusē —{' '}
        <code className="font-mono text-[11px] text-white/60">animation: none</code> salīdzinājumam.
      </p>
      <div className="mt-4 flex flex-wrap items-start gap-8">
        <div className="flex flex-col items-center gap-2">
          <div className="demo-orbit-mini" aria-hidden />
          <span className="text-center text-[10px] font-medium uppercase tracking-wider text-white/40">Ar animāciju</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="demo-orbit-mini demo-orbit-mini--static" aria-hidden />
          <span className="text-center text-[10px] font-medium uppercase tracking-wider text-white/40">Bez animācijas</span>
        </div>
      </div>
    </div>
  );
}
