import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { MarketingHero, type HeroVisualDemoVariant } from "@/components/home/MarketingHero";
import { routing } from "@/i18n/routing";
import "./variants.css";

const VARIANT_META: Record<
  HeroVisualDemoVariant,
  {
    title: string;
    desc: string;
  }
> = {
  a: {
    title: "Editorial + mist",
    desc: "Dziļāks fons, spēcīgāka „migla” aiz virsraksta, smalkāks H1.",
  },
  b: {
    title: "Glass cockpit",
    desc: "Spēcīgāks stikls, zila kontūra, pīlāru kaste ar dziļumu.",
  },
  c: {
    title: "Typographic sculpture",
    desc: "Ikonas kreisajā, teksts pa kreisi; „AUDITS” kā otrais slānis.",
  },
  d: {
    title: "Cinematic thread",
    desc: "Zilā kinematogrāfiskā aura + spēcīgāks pavediens zem skenēšanas.",
  },
  e: {
    title: "Aurora drift",
    desc: "Daudzslāņu zils/violeti/teal aurora + lēna „elpa” virs fona.",
  },
  f: {
    title: "Blueprint mesh",
    desc: "Perspektīvs režģis + dziļš vignette — „diagnostikas telpa”.",
  },
  g: {
    title: "Spotlight + gradient H1",
    desc: "Augšējais spotlight; VIN/SLUDINĀJUMA ar gradienta metāla zilumu.",
  },
  h: {
    title: "Silver horizon",
    desc: "Horizontāla sudraba josla ar ļoti lēnu pulsāciju centrā.",
  },
  i: {
    title: "Orbital halos",
    desc: "Divi rotējoši gredzeni aiz satura — orbitāla dziļuma sajūta.",
  },
};

const ROW_FIRST: HeroVisualDemoVariant[] = ["a", "b", "c", "d"];
const ROW_SECOND: HeroVisualDemoVariant[] = ["e", "f", "g", "h", "i"];

export const metadata: Metadata = {
  title: "Hero vizuālie varianti (A–I)",
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

function DemoSlab({ variant }: { variant: HeroVisualDemoVariant }) {
  const m = VARIANT_META[variant];
  const letter = variant.toUpperCase();

  return (
    <div className="flex w-full items-stretch border-b border-white/[0.09]">
      <div className="min-h-[100dvh] min-h-[100svh] min-w-0 flex-1">
        <MarketingHero demoVariant={variant} sectionDomId={`demo-hero-${variant}`} />
      </div>
      <aside
        className="sticky top-0 flex min-h-[100dvh] min-h-[100svh] w-10 shrink-0 flex-col items-center justify-center gap-2 border-l border-white/15 bg-gradient-to-b from-[#07142c] via-[#030308] to-[#050510] py-6 shadow-[inset_1px_0_0_rgba(255,255,255,0.04)] sm:w-[3.25rem] sm:py-8"
        aria-label={`Variants ${letter}: ${m.title}. ${m.desc}`}
      >
        <span className="select-none text-[1.65rem] font-black leading-none tracking-tight text-[#4b9dff] sm:text-[2rem]">{letter}</span>
        <span className="hidden max-w-[9rem] px-1 text-center text-[8px] font-medium uppercase leading-tight tracking-[0.12em] text-white/40 sm:block">
          {m.title}
        </span>
      </aside>
    </div>
  );
}

export default async function HeroVariantsDemoPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-w-0 bg-black text-white">
      <header className="sticky top-0 z-[70] border-b border-white/10 bg-black/90 px-4 py-3 backdrop-blur-md sm:px-6">
        <h1 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/90">Hero — demo A–I</h1>
        <p className="mt-1 max-w-[58rem] text-[13px] leading-relaxed text-white/55">
          Augšā <strong className="text-white/75">A–D</strong> (uzlaboti iepriekšējie), zemāk <strong className="text-white/75">E–I</strong> — izteiktāki foni un
          kustība (ar <code className="rounded bg-white/10 px-1 text-[11px]">prefers-reduced-motion</code> atbalstu). Katram blokam labajā malā ir{' '}
          <strong className="text-white/75">burts</strong>, lai vari rakstīt piem. „Ņemam <span className="font-semibold text-[#6ea8ff]">G</span>”. „APPROVED BY IRISS” +
          animācija un skenēšanas līnija visur.
        </p>
        <p className="mt-2 text-[11px] text-white/40">
          URL: <span className="font-mono text-white/55">/demo/hero-variants</span>
        </p>
      </header>

      <section aria-label="Varianti A līdz D">
        <h2 className="sr-only">A–D</h2>
        {ROW_FIRST.map((v) => (
          <DemoSlab key={v} variant={v} />
        ))}
      </section>

      <div className="border-y border-[#0066ff]/25 bg-gradient-to-r from-[#0066ff]/10 via-transparent to-[#0066ff]/10 px-4 py-3 text-center sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7ab8ff]">E — I · jaunie, „grandiozāki”</p>
        <p className="mt-1 text-[12px] text-white/45">Foni, gaismas un diskrētas animācijas — joprojām minimālistiski, bet iespaidīgāki.</p>
      </div>

      <section aria-label="Varianti E līdz I">
        <h2 className="sr-only">E–I</h2>
        {ROW_SECOND.map((v) => (
          <DemoSlab key={v} variant={v} />
        ))}
      </section>
    </div>
  );
}
