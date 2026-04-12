/**
 * Īss skaidrojums — hero orbitālie gredzeni pašlaik statiski (bez animācijas).
 */
export function OrbitRingsExplainer() {
  return (
    <div className="demo-orbit-mini-lab border-t border-white/10 px-4 py-6 sm:px-6">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">Orbitālie gredzeni</h2>
      <p className="mt-2 max-w-[42rem] text-[12px] leading-relaxed text-white/45">
        <strong className="font-medium text-white/60">Pilnekrāna hero</strong> — divi{' '}
        <code className="rounded bg-white/[0.06] px-1 font-mono text-[11px] text-white/60">span</code> ar klasēm{' '}
        <code className="font-mono text-[11px] text-white/60">marketing-hero-orbit-ring-outer</code> /{' '}
        <code className="font-mono text-[11px] text-white/60">inner</code>, centrēti ar{' '}
        <code className="font-mono text-[11px] text-white/60">left: 50%</code> / <code className="font-mono text-[11px] text-white/60">top: 50%</code> un{' '}
        <code className="font-mono text-[11px] text-white/60">translate(-50%, -50%)</code> (abi vienā ģeometriskā centrā).{' '}
        <strong className="font-medium text-white/60">Animācija pagaidām izslēgta</strong> — vēlāk var atgriezt rotāciju. Šeit — tā pati ģeometrija
        kā mazajā paraugā (<code className="font-mono text-[11px] text-white/60">::before</code> /{' '}
        <code className="font-mono text-[11px] text-white/60">::after</code>).
      </p>
      <div className="mt-4">
        <div className="demo-orbit-mini" aria-hidden />
      </div>
    </div>
  );
}
