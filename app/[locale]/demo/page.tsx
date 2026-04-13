import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DemoStudioNav } from "@/components/demo/DemoStudioNav";
import { DesignDirectionLayoutDemo } from "@/components/demo/DesignDirectionLayoutDemo";
import { HeroVariantsStudioSection } from "@/components/demo/HeroVariantsStudioSection";
import "@/components/home/hero-orbit-styles";
import { routing } from "@/i18n/routing";

export const metadata: Metadata = {
  title: "Demo studija — hero, layout, orbit",
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function DemoStudioPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-w-0 bg-black text-white">
      <DemoStudioNav />

      <section
        id="demo-studio-intro"
        className="scroll-mt-[max(0.35rem,env(safe-area-inset-top,0px)+2.75rem)] border-b border-white/[0.07] bg-[#040406] px-4 py-10 sm:px-6 sm:py-14 lg:scroll-mt-24"
      >
        <div className="mx-auto max-w-[min(72rem,calc(100vw-2rem))]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">PROVIN · vizuālā demo studija</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white/95 sm:text-3xl">Viss testu apkopojums vienā skatā</h1>
          <p className="mt-4 max-w-[44rem] text-[15px] leading-relaxed text-white/60">
            Šī lapa atdarina produkcijas karkasu: globālais headeris un kreisā sānu josla paliek kā uz sākumlapas. Zemāk secīgi — hero orbitu varianti
            (pilnekrāna bloki kā īstajā hero), layout paraugs un mazais orbit skaidrojums. Atsevišķas lapas saglabātas saitēm.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-[11px] font-medium uppercase tracking-[0.12em] text-white/45">
            <Link
              href="/demo/hero-variants"
              className="rounded-full border border-white/12 px-4 py-2 transition hover:border-[#0066ff]/35 hover:text-white/80"
            >
              Tikai hero varianti
            </Link>
            <Link
              href="/demo/hero-radial-hub"
              className="rounded-full border border-white/12 px-4 py-2 transition hover:border-[#0066ff]/35 hover:text-white/80"
            >
              Hero radialais tīkls (10)
            </Link>
            <Link
              href="/demo/orbital-hero-full"
              className="rounded-full border border-white/12 px-4 py-2 transition hover:border-[#0066ff]/35 hover:text-white/80"
            >
              Orbital hero — pilns saturs (10)
            </Link>
            <Link
              href="/demo/design-direction"
              className="rounded-full border border-white/12 px-4 py-2 transition hover:border-[#0066ff]/35 hover:text-white/80"
            >
              Tikai layout demo
            </Link>
            <Link
              href="/demo/lens-variants#lens-demo-2d"
              className="rounded-full border border-white/12 px-4 py-2 transition hover:border-[#0066ff]/35 hover:text-white/80"
            >
              Palielināmā stikla · 2D silueti
            </Link>
            <Link
              href="/demo/hero-fresh-concepts"
              className="rounded-full border border-white/12 px-4 py-2 transition hover:border-[#0066ff]/35 hover:text-white/80"
            >
              Jauni hero koncepti (10)
            </Link>
            <Link
              href="/demo/motion-concepts"
              className="rounded-full border border-white/12 px-4 py-2 transition hover:border-[#0066ff]/35 hover:text-white/80"
            >
              Koncepti bez lēcas
            </Link>
            <Link
              href="/demo/lupa-variants"
              className="rounded-full border border-white/12 px-4 py-2 transition hover:border-[#0066ff]/35 hover:text-white/80"
            >
              10 lupas stili
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#0066ff]/35 bg-[#0066ff]/12 px-4 py-2 text-[#7eb6ff] transition hover:bg-[#0066ff]/20 hover:text-white"
            >
              Uz sākumlapu
            </Link>
          </div>
        </div>
      </section>

      <HeroVariantsStudioSection layout="embedded" />
      <DesignDirectionLayoutDemo embedded />
    </div>
  );
}
