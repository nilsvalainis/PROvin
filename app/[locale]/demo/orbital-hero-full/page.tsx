import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { OrbitalHeroFullDemos } from "@/components/demo/OrbitalHeroFullDemos";
import { routing } from "@/i18n/routing";

export const metadata: Metadata = {
  title: "Orbital hero — pilns saturs, 10 demo",
  description:
    "Jauns hero ietvars pēc orbitāla tīkla un tēmekļa principa: tas pats saturs kā MarketingHero, desmit vizuāli atšķirīgi foni un līnijas.",
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function OrbitalHeroFullDemoPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-w-0 bg-[#020203] text-white">
      <header className="mx-auto max-w-[min(52rem,calc(100vw-2rem))] border-b border-white/[0.08] px-4 py-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">Demo · jauns hero ietvars</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-white/95 sm:text-2xl">
          Orbitālais / tēmekļa princips + pilns šī brīža hero saturs
        </h1>
        <p className="mt-3 max-w-[46rem] text-[13px] leading-relaxed text-white/55">
          Zemāk desmit pilnīgi atšķirīgi vizuālie apvalki (punktu globuss, luksusa tēmeklis, telemetrija, sudraba gredzeni, shēma,
          odometrs, stikls, grafiku zari, termiskā plūsma, sinhroni impulsi). Saturs: APPROVED BY IRISS, virsraksts, apakšvirsraksts,
          četri pīlāri kā uz mājas lapas, Pasūtīt un saite uz sākumlapas saturu.
        </p>
      </header>
      <OrbitalHeroFullDemos />
    </div>
  );
}
