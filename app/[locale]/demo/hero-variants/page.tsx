import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { MarketingHero } from "@/components/home/MarketingHero";
import { routing } from "@/i18n/routing";
import "./variants.css";

const LABELS: Record<"a" | "b" | "c" | "d", string> = {
  a: "A — Editorial premium",
  b: "B — Glass cockpit",
  c: "C — Typographic sculpture",
  d: "D — Single light thread",
};

const DESCRIPTIONS: Record<"a" | "b" | "c" | "d", string> = {
  a: "Dziļāks fons, maigs „mist” aiz virsraksta, mazāks H1, vieglāka otrā rinda.",
  b: "Diskrēts stikla panelis ap parakstu + H1; pīlāri vieglā kastē; hover gaismas.",
  c: "Ikonas kreisajā pusē, virsraksti pa kreisi; „AUDITS” kā otrais tipogrāfijas slānis.",
  d: "Viegls radials + šauršķiedras pavediens zem skenēšanas līnijas; siltāki pelēkie pīlāri.",
};

export const metadata: Metadata = {
  title: "Hero vizuālie varianti",
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function HeroVariantsDemoPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-w-0 bg-black text-white">
      <header className="sticky top-0 z-[70] border-b border-white/10 bg-black/88 px-4 py-3 backdrop-blur-md sm:px-6">
        <h1 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/90">Hero — četri demo varianti</h1>
        <p className="mt-1 max-w-[56rem] text-[13px] leading-relaxed text-white/55">
          Atver to pašu URL pārlūkā; ritini, lai redzētu A–D pilnā augstumā. „APPROVED BY IRISS” ar animāciju un skenēšanas līnija ir visos. Izvēlies vienu un
          apstiprini — tad integrēsim tikai to mājas lapā.
        </p>
        <p className="mt-2 text-[11px] text-white/40">
          Ceļš: <span className="font-mono text-white/55">/demo/hero-variants</span> (vai <span className="font-mono text-white/55">/lv/demo/hero-variants</span>, atkarībā no prefiksa).
        </p>
      </header>

      {(["a", "b", "c", "d"] as const).map((v) => (
        <div key={v} className="relative border-b border-white/[0.07]">
          <div className="pointer-events-none absolute right-3 top-16 z-[60] max-w-[min(100%,14rem)] rounded-md border border-white/12 bg-black/80 px-2.5 py-1.5 text-right shadow-lg sm:right-4 sm:top-[4.5rem] sm:max-w-[18rem]">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#6ea8ff]">{LABELS[v]}</p>
            <p className="mt-0.5 text-[9px] leading-snug text-white/50">{DESCRIPTIONS[v]}</p>
          </div>
          <MarketingHero demoVariant={v} sectionDomId={`demo-hero-${v}`} />
        </div>
      ))}
    </div>
  );
}
