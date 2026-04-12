import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { MarketingHero, HERO_ORBIT_SUBVARIANTS, type HeroVisualDemoVariant } from "@/components/home/MarketingHero";
import type { HeroOrbitSubvariant } from "@/lib/hero-orbit-j-presets";
import { routing } from "@/i18n/routing";
import "./orbit-presets.css";
import "./variants.css";

const J_ORBIT_THEMES: { title: string; desc: string }[] = [
  { title: "Melns · cyan gredzeni", desc: "Pilnīgi melns, spilgti zili gredzeni; H1 šaurāks tracking; ikonas mazākas, zilgana." },
  { title: "Melns · dubultzils", desc: "Tumšs gradients; ātrāka rotācija; pīlāru teksts mazāks; zilajiem vārdiem spīdums." },
  { title: "Melns · balta aura", desc: "Pelēks starojums; nepāra ikonas cyan, pāra — lavanda; kontrasts." },
  { title: "Melns · conic", desc: "Konisks fona tonis; lielāks ārējais gredzens; H1 nedaudz mazāks clamp." },
  { title: "Tumši · zila jūra", desc: "Zila „jūra” lejā; iekšējais gredzens tirkīza; drop-shadow uz ikonām." },
  { title: "Pelēks · sudrabs", desc: "Charcoal fons; sudraba gredzeni; otrā H1 rinda pelēcīgāka; pīlāru teksts auksti pelēks." },
  { title: "Pelēks · šaurie gredzeni", desc: "Augsts panels; mazāks iekšējais gredzens; zilie vārdi gaišāki; ikonas sudrabzilas." },
  { title: "Pelēks · offset", desc: "Pelēks radials sānis; gredzeni lēnāki; pīlāru tracking platāks, micro teksts." },
  { title: "Pelēks · kompakts", desc: "Šaurāki gredzeni; baltāka ārējā līnija; ikonas nedaudz lielākas." },
  { title: "Pelēks · augšas gaisma", desc: "Gaisma no augšas; otrā rinda ar plašu tracking; orbitālais ritms vidējs." },
  { title: "Zils · dziļš neons", desc: "Spēcīgs zils apakšā; neona gredzeni; zilās atslēgvārdi gaišāki; ikonas tirkīza." },
  { title: "Zils · liels lauks", desc: "Milzīgs ārējais gredzens; četras ikonas dažādās zilās niansēs." },
  { title: "Zils · ātrs", desc: "Ātra rotācija; zils stars no apakšas; kompaktāks iekšējais gredzens." },
  { title: "Zils · lēns epics", desc: "Ļoti lēna rotācija; spēcīgs zils spīdums ap H1; gaišas iekšējās līnijas." },
  { title: "Zils · conic jūra", desc: "Konisks zils tonis; pīlāru teksts gaiši zils; orbitālā elpa." },
  { title: "Violetzils", desc: "Violeti-zils gradients fons; violeti ārējais, zils iekšējais gredzens; H1 zilie vārdi lavanda." },
  { title: "Melns · apgriezti gredzeni", desc: "Liels iekšējais, mazāks ārējais — otra secība vizuāli; lēna rotācija." },
  { title: "Zils · ikonas lielākas", desc: "Zils highlights; ikonas scale + biezāks stroke; orbitālais ritms dinamisks." },
  { title: "Pelēks · H1 vieglāks", desc: "Pelēks radials; otrā rinda ļoti vieglas svara; gredzeni lēni." },
  { title: "Zils · max drama", desc: "Milzīgs ārējais gredzens, mazs iekšējais; spēcīgs zils stars; kontrasta virsotne." },
];

const J_ORBIT_META: Record<HeroOrbitSubvariant, { title: string; desc: string }> = Object.fromEntries(
  HERO_ORBIT_SUBVARIANTS.map((id, i) => {
    const t = J_ORBIT_THEMES[i];
    if (!t) throw new Error(`Missing orbit theme for ${id}`);
    return [id, t] as const;
  }),
) as Record<HeroOrbitSubvariant, { title: string; desc: string }>;

const VARIANT_META: Record<HeroVisualDemoVariant, { title: string; desc: string }> = {
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
    title: "Orbital halos (oriģināls)",
    desc: "Divi rotējoši gredzeni — bāzes izskats; J1–J20 ir šīs pašas loģikas variācijas.",
  },
  ...J_ORBIT_META,
};

const ROW_FIRST: HeroVisualDemoVariant[] = ["a", "b", "c", "d"];
const ROW_SECOND: HeroVisualDemoVariant[] = ["e", "f", "g", "h", "i"];
const ROW_ORBIT_J: HeroVisualDemoVariant[] = [...HERO_ORBIT_SUBVARIANTS];

export const metadata: Metadata = {
  title: "Hero vizuālie varianti (A–I + J1–J20)",
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
        <span className="select-none text-[1.45rem] font-black leading-none tracking-tight text-[#4b9dff] sm:text-[1.85rem]">{letter}</span>
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
        <h1 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/90">Hero — demo A–I + J1–J20</h1>
        <p className="mt-1 max-w-[60rem] text-[13px] leading-relaxed text-white/55">
          <strong className="text-white/75">A–D</strong> un <strong className="text-white/75">E–I</strong> kā iepriekš. Zemāk{' '}
          <strong className="text-white/75">J1–J20</strong> — tā pati orbitalā gredženu ideja kā <strong className="text-white/75">I</strong>, bet ar atšķirīgiem
          foniem (melns / pelēks / zils), gredženu ātrumu, izmēru un tipogrāfiju / ikonu niansēm. Katram blokam labajā malā apzīmējums (piem.{' '}
          <span className="font-semibold text-[#6ea8ff]">J7</span>). „APPROVED BY IRISS” + animācija un skenēšanas līnija visur.
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
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7ab8ff]">E — I</p>
        <p className="mt-1 text-[12px] text-white/45">Iepriekšējie „grandiozākie” virzieni.</p>
      </div>

      <section aria-label="Varianti E līdz I">
        <h2 className="sr-only">E–I</h2>
        {ROW_SECOND.map((v) => (
          <DemoSlab key={v} variant={v} />
        ))}
      </section>

      <div className="border-y border-white/10 bg-gradient-to-r from-white/[0.06] via-transparent to-white/[0.06] px-4 py-3 text-center sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">J1 — J20 · orbitalās variācijas (pēc I)</p>
        <p className="mt-1 text-[12px] text-white/45">Tā pati divu gredženu loģika; mainās fons, krāsas, ātrums, izmēri, H1 un pīlāru stils.</p>
      </div>

      <section aria-label="Orbital apakšvarianti J1 līdz J20">
        <h2 className="sr-only">J1–J20</h2>
        {ROW_ORBIT_J.map((v) => (
          <DemoSlab key={v} variant={v} />
        ))}
      </section>
    </div>
  );
}
