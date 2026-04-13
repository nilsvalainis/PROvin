import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { DemoStudioNav } from "@/components/demo/DemoStudioNav";
import { DemoStudioQuickLinks } from "@/components/demo/DemoStudioQuickLinks";
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
          <div className="mt-6">
            <DemoStudioQuickLinks />
          </div>
        </div>
      </section>

      <HeroVariantsStudioSection layout="embedded" />
      <DesignDirectionLayoutDemo embedded />
    </div>
  );
}
