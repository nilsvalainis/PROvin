import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { DemoStudioNav } from "@/components/demo/DemoStudioNav";
import { DemoStaticLandingExamples } from "@/components/demo/DemoStaticLandingExamples";
import { DemoStudioQuickLinks } from "@/components/demo/DemoStudioQuickLinks";
import { DesignDirectionLayoutDemo } from "@/components/demo/DesignDirectionLayoutDemo";
import { HeroVariantsStudioSection } from "@/components/demo/HeroVariantsStudioSection";
import { Link } from "@/i18n/navigation";
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
          <div className="mt-6">
            <DemoStudioQuickLinks />
          </div>
          <div className="mt-6 rounded-2xl border border-[#0066ff]/35 bg-[#0066ff]/10 p-4 sm:p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9cc7ff]">Jauns pilnais demo</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-white/95 sm:text-xl">Scandinavian clean · Full landing</h2>
            <p className="mt-2 max-w-[46rem] text-[13px] leading-relaxed text-white/70">
              Gatavs A-Z piemērs ar esošo PROVIN saturu, noformēts `concept-29` stilā.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link
                href="/demo/scandinavian-full"
                className="rounded-full border border-[#0066ff]/45 bg-[#0066ff]/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-[#0066ff]/30"
              >
                Atvērt demo panelī
              </Link>
              <a
                href="/concept-demos/concept-29/"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-white/20 bg-white/[0.04] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/80 transition hover:bg-white/[0.08] hover:text-white"
              >
                Atvērt originālo concept-29
              </a>
            </div>
          </div>
          <DemoStaticLandingExamples />
        </div>
      </section>

      <HeroVariantsStudioSection layout="embedded" />
      <DesignDirectionLayoutDemo embedded />
    </div>
  );
}
