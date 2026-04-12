import type { Metadata } from "next";
import { Fragment } from "react";
import { setRequestLocale } from "next-intl/server";
import { MarketingHero } from "@/components/home/MarketingHero";
import {
  HERO_DEMO_SPEEDOMETER_VARIANTS,
  HERO_SILVER_BLACK_SUBVARIANTS,
  type HeroSilverBlackSubvariant,
  type HeroVisualDemoVariant,
} from "@/lib/hero-orbit-j-presets";
import { routing } from "@/i18n/routing";
import { OrbitRingsExplainer } from "./OrbitRingsExplainer";
import "./orbit-presets.css";

const REFERENCE_VARIANTS = ["i", "j10"] as const satisfies readonly HeroVisualDemoVariant[];

const SILVER_META: Record<HeroSilverBlackSubvariant, { title: string; desc: string }> = {
  s1: { title: "Melns · smalki sudraba gredzeni", desc: "Tīrs melns; plānas sudraba līnijas; vidējs temps." },
  s2: { title: "Sudraba migla augšā", desc: "Gaisma no augšas; kontrasta gredzeni." },
  s3: { title: "Charcoal slīnis", desc: "Lineārs gradients; mazāks iekšējais gredzens." },
  s4: { title: "Sudrabs apakšā", desc: "Ātrs griešanās ritms; spīdīgāka ārējā mala." },
  s5: { title: "Pelēks highlights", desc: "Lēns; zema ārējā gredzena caurspīdība." },
  s6: { title: "Konisks pelēks", desc: "Conic fons; dinamisks ātrums." },
  s7: { title: "Plats ārējais lauks", desc: "Liels ārējais, šaurs iekšējais." },
  s8: { title: "Augsta kontrasta gredzeni", desc: "Spēcīgākas robežas; līdzsvars ārējais/iekšējais." },
  s9: { title: "Pelēks centrs", desc: "Viegls highlights centrā; „elpojošs” fons." },
  s10: { title: "Vertikālais gradients", desc: "Pelēka josla vidū; sudraba ārējās līnijas." },
  s11: { title: "Sudrabs no kreisās", desc: "Asimetrisks radials; alternējošs spin temps." },
  s12: { title: "Apakšas aura", desc: "Gaisma no apakšas; gaišākas iekšējās līnijas." },
  s13: { title: "Augšas panelis", desc: "Šaurāks lauks; ātrāka rotācija." },
  s14: { title: "Plats iekšējais", desc: "Liels iekšējais gredzens; lēns ārējais." },
  s15: { title: "Dziļš pelēks", desc: "Vignette; centrēts orbitālais punkts." },
  s16: { title: "Diskrēts highlights", desc: "Augšējā kreisā „lāsa”; smalki gredzeni." },
  s17: { title: "Zems kontrasts", desc: "Ļoti pelēks; gandrīz statisks iespaids." },
  s18: { title: "Horizontāla sudraba josla", desc: "Gaisma no augšas kā josla." },
  s19: { title: "Sānu sudrabs", desc: "Asimetrisks fons; vidējs ritms." },
  s20: {
    title: "Sudraba slīnis · pilna orbitālā rotācija",
    desc: "Līdzīgs S19, bet cits fona slīnis; abi centrālie gredzeni griežas ap savu asi (::before / ::after).",
  },
};

const VARIANT_META: Record<HeroVisualDemoVariant, { title: string; desc: string }> = {
  i: {
    title: "Orbital halos (atsauce)",
    desc: "Oriģinālais zilais orbitālais virziens — salīdzinājumam ar melnu/sudrabu sēriju.",
  },
  j10: {
    title: "Pelēks · augšas gaisma (atsauce)",
    desc: "Atskaites variants; fons un gredzeni tikai melni / sudraba toņi.",
  },
  ...SILVER_META,
};

const DEMO_ORDER: HeroVisualDemoVariant[] = [...REFERENCE_VARIANTS, ...HERO_SILVER_BLACK_SUBVARIANTS];

const SPEEDO_SET = new Set<string>(HERO_DEMO_SPEEDOMETER_VARIANTS);

export const metadata: Metadata = {
  title: "Hero orbit — melns / sudrabs (demo)",
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

function DemoSlab({ variant }: { variant: HeroVisualDemoVariant }) {
  const m = VARIANT_META[variant];
  const label = variant.toUpperCase();
  const speedo = SPEEDO_SET.has(variant);

  return (
    <div className="flex w-full items-stretch border-b border-white/[0.09]">
      <div className="min-h-[100dvh] min-h-[100svh] min-w-0 flex-1">
        <MarketingHero
          demoVariant={variant}
          sectionDomId={`demo-hero-${variant}`}
          demoSpeedometer={speedo}
          demoOrbitRings="spin"
        />
      </div>
      <aside
        className="sticky top-0 flex min-h-[100dvh] min-h-[100svh] w-10 shrink-0 flex-col items-center justify-center gap-2 border-l border-white/15 bg-gradient-to-b from-[#07142c] via-[#030308] to-[#050510] py-6 shadow-[inset_1px_0_0_rgba(255,255,255,0.04)] sm:w-[3.25rem] sm:py-8"
        aria-label={`Variants ${label}: ${m.title}. ${m.desc}`}
      >
        <span className="select-none text-[1.25rem] font-black leading-none tracking-tight text-[#4b9dff] sm:text-[1.55rem]">
          {label}
        </span>
        <span className="hidden max-w-[9rem] px-1 text-center text-[8px] font-medium uppercase leading-tight tracking-[0.12em] text-white/40 sm:block">
          {m.title}
        </span>
        {speedo ? (
          <span className="hidden text-[7px] font-semibold uppercase tracking-widest text-amber-200/80 sm:block" title="Ar spidometra šautru">
            RPM
          </span>
        ) : null}
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
        <h1 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/90">Hero — orbit demo</h1>
        <p className="mt-1 max-w-[60rem] text-[13px] leading-relaxed text-white/55">
          Atsauce: <strong className="text-white/80">I</strong> (Orbital halos) un <strong className="text-white/80">J10</strong> (Pelēks · augšas gaisma). Tad{' '}
          <strong className="text-white/80">S1–S20</strong> — tikai melni un sudraba toņi fona gradientos. S1–S6 ar dekoratīvu spidometra šautru. Visos orbitālajos
          blokos, tostarp <strong className="text-white/80">S19</strong> un <strong className="text-white/80">S20</strong>, centrālie gredzeni pilnībā rotē ap savu
          asi; statiskais salīdzinājums — tikai lapas apakšā, mazajā demonstrācijā.
        </p>
        <p className="mt-2 text-[11px] text-white/40">
          Ceļš: <span className="font-mono text-white/55">/demo/hero-variants</span>
        </p>
        <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.12em] text-white/35">Tiešā saite uz rotējošajiem gredzeniem ·</p>
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
          <a
            href="#demo-hero-s19"
            className="text-[11px] text-sky-400/90 underline decoration-sky-500/30 underline-offset-2 hover:text-sky-300"
          >
            S19 — Sānu sudrabs
          </a>
          <span className="text-white/20" aria-hidden>
            ·
          </span>
          <a
            href="#demo-hero-s20"
            className="text-[11px] text-sky-400/90 underline decoration-sky-500/30 underline-offset-2 hover:text-sky-300"
          >
            S20 — pilna rotācija
          </a>
          <span className="text-white/20" aria-hidden>
            ·
          </span>
          <a
            href="#demo-silver-series"
            className="text-[11px] text-white/45 underline decoration-white/20 underline-offset-2 hover:text-white/70"
          >
            S1–S20 josla
          </a>
        </p>
      </header>

      <section aria-label="Orbitālie demo varianti">
        <h2 className="sr-only">I, J10, S1–S20</h2>
        {DEMO_ORDER.map((v, idx) => (
          <Fragment key={v}>
            {idx === REFERENCE_VARIANTS.length ? (
              <div
                id="demo-silver-series"
                className="scroll-mt-28 border-y border-white/10 bg-white/[0.04] px-4 py-2.5 text-center sm:px-6"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50">S1 — S20 · melns / sudrabs</p>
                <p className="mt-0.5 text-[11px] text-white/38">Seši ar spidometru; S19–S20 — pilna gredzenu rotācija.</p>
              </div>
            ) : null}
            <DemoSlab variant={v} />
          </Fragment>
        ))}
      </section>

      <OrbitRingsExplainer />
    </div>
  );
}
