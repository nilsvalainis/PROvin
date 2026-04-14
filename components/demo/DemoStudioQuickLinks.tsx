import { Link } from "@/i18n/navigation";

const pill =
  "rounded-full border border-white/12 px-4 py-2 transition hover:border-[#0066ff]/35 hover:text-white/80 text-[11px] font-medium uppercase tracking-[0.12em] text-white/45";

const pillHome =
  "inline-flex items-center gap-1.5 rounded-full border border-[#0066ff]/35 bg-[#0066ff]/12 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[#7eb6ff] transition hover:bg-[#0066ff]/20 hover:text-white";

/** Tās pašas „demo studijas” saites kā `/demo` ievadā — lietojamas arī citās demo lapās un adminā. */
export function DemoStudioQuickLinks({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      <Link href="/demo/hero-variants" className={pill}>
        Tikai hero varianti
      </Link>
      <Link href="/demo/marketing-hero-concepts" className={pill}>
        5 mārketinga hero (copy + layout)
      </Link>
      <Link href="/demo/hero-radial-hub" className={pill}>
        Hero radialais tīkls (10)
      </Link>
      <Link href="/demo/orbital-hero-full" className={pill}>
        Orbital hero — pilns saturs (10)
      </Link>
      <Link href="/demo/design-direction" className={pill}>
        Tikai layout demo
      </Link>
      <Link href="/demo/lens-variants#lens-demo-2d" className={pill}>
        Palielināmā stikla · 2D silueti
      </Link>
      <Link href="/demo/provin-engineering-heroes" className={pill}>
        Engineering hero — 30 (motion)
      </Link>
      <Link href="/demo/hero-fresh-concepts" className={pill}>
        Jauni hero koncepti (60)
      </Link>
      <Link href="/demo/motion-concepts" className={pill}>
        Koncepti bez lēcas
      </Link>
      <Link href="/demo/lupa-variants" className={pill}>
        10 lupas stili
      </Link>
      <Link href="/demo/static-concepts" className={pill}>
        Statiskie HTML koncepti (30)
      </Link>
      <Link href="/demo/scandinavian-full" className={pill}>
        Scandinavian full demo
      </Link>
      <Link href="/" className={pillHome}>
        Uz sākumlapu
      </Link>
    </div>
  );
}

type CrossNavProps = { sticky?: boolean };

/** Lipīga (noklusējumā) josla ar tām pašām pill saitēm kā `/demo` ievadā. */
export function DemoCrossDemoNav({ sticky = true }: CrossNavProps) {
  const position = sticky
    ? "sticky z-[35] bg-[#030304]/95 backdrop-blur-md supports-[backdrop-filter]:bg-[#030304]/88"
    : "relative z-[1] bg-[#030304]";
  return (
    <div
      className={`${position} border-b border-white/[0.08] py-3`}
      style={sticky ? { top: "max(0.35rem, env(safe-area-inset-top, 0px))" } : undefined}
    >
      <div className="mx-auto max-w-[min(72rem,calc(100vw-2rem))] px-4 sm:px-6">
        <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/35">Demo studija · Ātras saites</p>
        <DemoStudioQuickLinks />
      </div>
    </div>
  );
}

/** Otrā josla zem lapas iekšējās navigācijas (lēca / lupa utt.), bez otras lipīgās slāņa. */
export function DemoStudioQuickLinksFollowUp() {
  return (
    <div className="border-b border-white/[0.07] bg-[#030304] px-4 py-3 sm:px-6">
      <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/35">Citas demo lapas</p>
      <DemoStudioQuickLinks />
    </div>
  );
}
