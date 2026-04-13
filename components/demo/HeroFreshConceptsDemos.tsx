"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import "./hero-fresh-concepts.css";

type ConceptMeta = { id: string; label: string; blurb: string };

const CONCEPTS: ConceptMeta[] = [
  { id: "veil", label: "1 · Gaismas plēve", blurb: "Lēna koniska aura aiz teksta — maigs, kinisks fons." },
  { id: "chroma", label: "2 · Hromatiskā nobīde", blurb: "RGB slāņi ar ļoti mazu nobīdi — digitāls „defekts”." },
  { id: "bento", label: "3 · Bento signāls", blurb: "Asimetrisks režģis; šūnu apmales un signāla punkts." },
  { id: "ribbon", label: "4 · Šķidruma līnija", blurb: "SVG līkne ar plūstošu gradienta masku." },
  { id: "typewave", label: "5 · Tipogrāfijas vilnis", blurb: "Apakšvirsraksta burti kustas kā fāžu fronte." },
  { id: "depth", label: "6 · Dziļuma slāņi", blurb: "Trīs neskaidri teksta slāņi + peles paralakse." },
  { id: "delta", label: "7 · Delta lauks", blurb: "Mainīgi skaitļi un horizontāla „sinhronizācijas” josla." },
  { id: "mist", label: "8 · Zilā migla", blurb: "Lieli miglas plankumi — abstrakta atmosfēra." },
  { id: "frame", label: "9 · Rāmja impulsi", blurb: "Stūru segmenti secīgi „elpo” ar zilu mirdzumu." },
  { id: "lattice", label: "10 · Režģa elpa", blurb: "Punktu režģis ar vilni caur blīvumu." },
];

function PillarsRow({ titles }: { titles: string[] }) {
  return (
    <div className="mt-10 flex w-full max-w-[56rem] flex-wrap justify-center gap-2 sm:gap-3">
      {titles.map((title, i) => (
        <div
          key={`${i}-${title.slice(0, 12)}`}
          className="min-h-[2.6rem] max-w-[11rem] whitespace-pre-line rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-center text-[8px] font-semibold uppercase leading-tight tracking-tight text-white/80 sm:max-w-[12rem] sm:text-[9px]"
        >
          {title}
        </div>
      ))}
    </div>
  );
}

function WaveHeading({ text, className }: { text: string; className?: string }) {
  const chars = useMemo(() => [...text], [text]);
  return (
    <h2 className={className}>
      {chars.map((ch, i) => (
        <span
          key={`${i}-${ch}`}
          className="inline-block"
          style={{
            animation: `hfc-letter-wave 2.4s ease-in-out ${i * 0.045}s infinite`,
          }}
        >
          {ch === " " ? "\u00a0" : ch}
        </span>
      ))}
    </h2>
  );
}

function ConceptVeil({ h1, h2, pillars }: { h1: React.ReactNode; h2: string; pillars: string[] }) {
  return (
    <div className="relative flex min-h-[min(78vh,52rem)] flex-col items-center justify-center overflow-hidden px-4 py-16 text-center">
      <div
        className="pointer-events-none absolute inset-[-40%] opacity-[0.22]"
        style={{
          background: `conic-gradient(from 120deg at 50% 45%, transparent 0deg, rgb(0 102 255 / 0.45) 60deg, transparent 120deg, rgb(80 140 255 / 0.2) 200deg, transparent 280deg)`,
          animation: "hfc-veil-spin 48s linear infinite",
          filter: "blur(38px)",
        }}
      />
      <div className="relative z-[1] max-w-[min(100%,48rem)]">{h1}</div>
      <WaveHeading
        text={h2}
        className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug tracking-tight text-white/65"
      />
      <div className="relative z-[1]">
        <PillarsRow titles={pillars} />
      </div>
    </div>
  );
}

function ConceptChroma({ h1, h2, pillars }: { h1: React.ReactNode; h2: string; pillars: string[] }) {
  return (
    <div className="relative flex min-h-[min(78vh,52rem)] flex-col items-center justify-center overflow-hidden bg-[#030304] px-4 py-16 text-center">
      <div className="hfc-chroma-wrap relative max-w-[min(100%,48rem)]">{h1}</div>
      <p className="mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug tracking-tight text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function ConceptBento({ h1, h2, pillars }: { h1: React.ReactNode; h2: string; pillars: string[] }) {
  return (
    <div className="flex min-h-[min(78vh,52rem)] flex-col items-center justify-center px-3 py-14 sm:px-6">
      <div className="grid w-full max-w-[52rem] grid-cols-6 gap-2 sm:gap-3">
        <div
          className="relative col-span-6 overflow-hidden rounded-2xl border border-white/[0.12] bg-white/[0.02] p-6 sm:p-8"
          style={{ animation: "hfc-bento-glow 5s ease-in-out infinite" }}
        >
          <div className="pointer-events-none absolute inset-0 opacity-40">
            <svg className="h-full w-full" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden>
              <path
                id="hfc-bento-path"
                d="M 0 60 Q 100 20 200 60 T 400 60"
                fill="none"
                stroke="rgb(0 102 255 / 0.25)"
                strokeWidth="1"
              />
              <circle r="3" fill="rgb(0 140 255)" opacity="0.9">
                <animateMotion dur="6s" repeatCount="indefinite" path="M 0 60 Q 100 20 200 60 T 400 60" />
              </circle>
            </svg>
          </div>
          <div className="relative text-center">{h1}</div>
        </div>
        <div className="col-span-6 rounded-xl border border-white/[0.08] bg-black/40 p-4 text-center sm:col-span-2 sm:col-start-2 sm:col-end-6">
          <p className="text-[clamp(0.9rem,2.5vw,1.05rem)] leading-snug text-white/60">{h2}</p>
        </div>
        {pillars.map((p, i) => (
          <div
            key={p}
            className="col-span-3 rounded-xl border border-white/[0.1] bg-white/[0.03] p-3 text-center sm:col-span-2"
            style={{
              animation: `hfc-bento-glow ${4.2 + i * 0.4}s ease-in-out infinite`,
              animationDelay: `${i * 0.35}s`,
            }}
          >
            <p className="whitespace-pre-line text-[8px] font-semibold uppercase leading-tight text-white/75 sm:text-[9px]">
              {p}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConceptRibbon({ h1, h2, pillars }: { h1: React.ReactNode; h2: string; pillars: string[] }) {
  return (
    <div className="relative flex min-h-[min(78vh,52rem)] flex-col items-center justify-end overflow-hidden px-4 pb-20 pt-24 text-center">
      <svg
        className="pointer-events-none absolute bottom-[12%] left-[-5%] w-[110%] max-w-none opacity-90"
        viewBox="0 0 800 120"
        fill="none"
        aria-hidden
      >
        <defs>
          <linearGradient id="hfc-rib-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(0 102 255 / 0)" />
            <stop offset="40%" stopColor="rgb(0 160 255 / 0.9)" />
            <stop offset="60%" stopColor="rgb(0 102 255 / 0.95)" />
            <stop offset="100%" stopColor="rgb(0 102 255 / 0)" />
          </linearGradient>
        </defs>
        <path
          d="M -40 85 C 120 20 280 120 400 55 S 620 -10 840 70"
          stroke="url(#hfc-rib-grad)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="40 200"
          style={{ animation: "hfc-ribbon-shift 14s linear infinite" }}
        />
      </svg>
      <div className="relative z-[1] max-w-[min(100%,48rem)]">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <div className="relative z-[1]">
        <PillarsRow titles={pillars} />
      </div>
    </div>
  );
}

function ConceptTypewave({ h1, h2, pillars }: { h1: React.ReactNode; h2: string; pillars: string[] }) {
  return (
    <div className="flex min-h-[min(78vh,52rem)] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="max-w-[min(100%,48rem)]">{h1}</div>
      <WaveHeading
        text={h2}
        className="mt-5 max-w-[min(100%,42rem)] text-balance text-[clamp(1rem,3vw,1.35rem)] font-semibold leading-snug tracking-[-0.02em] text-white/72"
      />
      <PillarsRow titles={pillars} />
    </div>
  );
}

function ConceptDepth({ h1, h2, pillars }: { h1: React.ReactNode; h2: string; pillars: string[] }) {
  const [pos, setPos] = useState({ x: 0.5, y: 0.5 });
  const onMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPos({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
  }, []);
  const onLeave = useCallback(() => setPos({ x: 0.5, y: 0.5 }), []);
  const dx = (pos.x - 0.5) * 14;
  const dy = (pos.y - 0.5) * 10;
  const depthFilter = `drop-shadow(${dx * -0.12}px ${dy * -0.1}px 0 rgb(255 255 255 / 0.12)) drop-shadow(${dx * 0.1}px ${dy * 0.08}px 12px rgb(0 102 255 / 0.35))`;

  return (
    <section
      className="flex min-h-[min(78vh,52rem)] cursor-default flex-col items-center justify-center px-4 py-16 text-center"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <div className="relative transition-[filter] duration-75 ease-out" style={{ filter: depthFilter }}>
        {h1}
      </div>
      <p className="mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </section>
  );
}

function ConceptDelta({ h1, h2, pillars }: { h1: React.ReactNode; h2: string; pillars: string[] }) {
  return (
    <div className="flex min-h-[min(78vh,52rem)] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-6 flex w-full max-w-[36rem] items-center justify-between font-mono text-[10px] text-[#0066ff]/80 sm:text-[11px]">
        <span style={{ animation: "hfc-delta-tick 1.8s ease-in-out infinite" }}>ΔVIN 0x4A2F</span>
        <span style={{ animation: "hfc-delta-tick 1.8s ease-in-out 0.4s infinite" }}>SYNC 14.2 Hz</span>
        <span style={{ animation: "hfc-delta-tick 1.8s ease-in-out 0.8s infinite" }}>BUF 98%</span>
      </div>
      <div className="max-w-[min(100%,48rem)]">{h1}</div>
      <div className="relative mt-5 h-px w-full max-w-[28rem] overflow-hidden bg-white/[0.08]" aria-hidden>
        <div className="hfc-delta-scan-bar absolute top-0 h-full w-[min(32%,9rem)] -translate-x-1/2 bg-gradient-to-r from-transparent via-[#0066ff]/88 to-transparent" />
      </div>
      <p className="mt-6 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function ConceptMist({ h1, h2, pillars }: { h1: React.ReactNode; h2: string; pillars: string[] }) {
  return (
    <div className="relative flex min-h-[min(78vh,52rem)] flex-col items-center justify-center overflow-hidden px-4 py-16 text-center">
      <div
        className="pointer-events-none absolute -left-1/4 top-1/4 h-[120%] w-[70%] rounded-full bg-[radial-gradient(ellipse_at_center,rgb(0_80_200/0.35)_0%,transparent_62%)]"
        style={{ animation: "hfc-mist-a 18s ease-in-out infinite" }}
      />
      <div
        className="pointer-events-none absolute -right-1/4 bottom-0 h-[90%] w-[65%] rounded-full bg-[radial-gradient(ellipse_at_center,rgb(40_120_255/0.28)_0%,transparent_58%)]"
        style={{ animation: "hfc-mist-b 22s ease-in-out infinite" }}
      />
      <div className="relative z-[1] max-w-[min(100%,48rem)]">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <div className="relative z-[1]">
        <PillarsRow titles={pillars} />
      </div>
    </div>
  );
}

function ConceptFrame({ h1, h2, pillars }: { h1: React.ReactNode; h2: string; pillars: string[] }) {
  const seg = "absolute h-6 w-6 border-[#0066ff]";
  return (
    <div className="relative flex min-h-[min(78vh,52rem)] flex-col items-center justify-center px-6 py-16 text-center">
      <div className="pointer-events-none absolute inset-[max(1rem,4vw)] rounded-3xl border border-white/[0.06]" aria-hidden />
      <div
        className={`${seg} left-[max(1rem,4vw)] top-[max(1rem,4vw)] border-b-0 border-r-0`}
        style={{ animation: "hfc-corner-pulse 3.2s ease-in-out infinite" }}
      />
      <div
        className={`${seg} right-[max(1rem,4vw)] top-[max(1rem,4vw)] border-b-0 border-l-0`}
        style={{ animation: "hfc-corner-pulse 3.2s ease-in-out 0.8s infinite" }}
      />
      <div
        className={`${seg} bottom-[max(1rem,4vw)] left-[max(1rem,4vw)] border-t-0 border-r-0`}
        style={{ animation: "hfc-corner-pulse 3.2s ease-in-out 1.6s infinite" }}
      />
      <div
        className={`${seg} bottom-[max(1rem,4vw)] right-[max(1rem,4vw)] border-l-0 border-t-0`}
        style={{ animation: "hfc-corner-pulse 3.2s ease-in-out 2.4s infinite" }}
      />
      <div className="relative z-[1] max-w-[min(100%,46rem)] px-2">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <div className="relative z-[1]">
        <PillarsRow titles={pillars} />
      </div>
    </div>
  );
}

function ConceptLattice({ h1, h2, pillars }: { h1: React.ReactNode; h2: string; pillars: string[] }) {
  const dots = useMemo(() => {
    const rows = 5;
    const cols = 14;
    const out: { key: string; d: number }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        out.push({ key: `${r}-${c}`, d: (r + c) * 0.08 });
      }
    }
    return out;
  }, []);

  return (
    <div className="relative flex min-h-[min(78vh,52rem)] flex-col items-center justify-center overflow-hidden px-4 py-16 text-center">
      <div
        className="pointer-events-none absolute inset-0 grid justify-items-center gap-y-[10px] opacity-[0.38] [grid-template-columns:repeat(14,10px)] sm:gap-y-[11px] sm:[grid-template-columns:repeat(14,11px)]"
        aria-hidden
      >
        {dots.map(({ key, d }) => (
          <span
            key={key}
            className="h-[3px] w-[3px] rounded-full bg-[#0066ff]"
            style={{
              animation: `hfc-lattice-dot 3.6s ease-in-out ${d}s infinite`,
            }}
          />
        ))}
      </div>
      <div className="relative z-[1] max-w-[min(100%,48rem)]">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <div className="relative z-[1]">
        <PillarsRow titles={pillars} />
      </div>
    </div>
  );
}

export function HeroFreshConceptsDemos() {
  const t = useTranslations("Hero");
  const [active, setActive] = useState(0);
  const pillarsRaw = t.raw("pillars") as { title: string }[] | undefined;
  const pillars = Array.isArray(pillarsRaw) ? pillarsRaw.map((p) => p.title) : [];

  const h1 = (
    <h1 className="text-balance text-[clamp(1.15rem,4.2vw+0.2rem,2.35rem)] font-semibold leading-[1.06] tracking-[-0.03em] text-white/95 sm:leading-[1.04]">
      <span className="block text-[0.42em] font-medium uppercase tracking-[0.28em] text-white/45 sm:text-[0.4em]">
        {t("h1Vin")} {t("h1Un")} {t("h1Sludinajuma")}
      </span>
      <span className="mt-1 block bg-gradient-to-b from-white via-white to-white/75 bg-clip-text text-transparent">
        {t("h1Line2")}
      </span>
    </h1>
  );

  const h2 = t("h2");
  const meta = CONCEPTS[active]!;

  const stage = (() => {
    switch (meta.id) {
      case "veil":
        return <ConceptVeil h1={h1} h2={h2} pillars={pillars} />;
      case "chroma":
        return <ConceptChroma h1={h1} h2={h2} pillars={pillars} />;
      case "bento":
        return <ConceptBento h1={h1} h2={h2} pillars={pillars} />;
      case "ribbon":
        return <ConceptRibbon h1={h1} h2={h2} pillars={pillars} />;
      case "typewave":
        return <ConceptTypewave h1={h1} h2={h2} pillars={pillars} />;
      case "depth":
        return <ConceptDepth h1={h1} h2={h2} pillars={pillars} />;
      case "delta":
        return <ConceptDelta h1={h1} h2={h2} pillars={pillars} />;
      case "mist":
        return <ConceptMist h1={h1} h2={h2} pillars={pillars} />;
      case "frame":
        return <ConceptFrame h1={h1} h2={h2} pillars={pillars} />;
      case "lattice":
        return <ConceptLattice h1={h1} h2={h2} pillars={pillars} />;
      default:
        return null;
    }
  })();

  return (
    <div className="hfc-shell min-w-0 bg-[#030304] text-white">
      <div className="sticky top-0 z-[30] border-b border-white/[0.08] bg-[#030304]/95 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-[#030304]/82">
        <div className="mx-auto flex max-w-[min(90rem,calc(100vw-1rem))] flex-col gap-3 px-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/demo"
              className="shrink-0 text-[10px] font-medium uppercase tracking-[0.14em] text-white/45 transition hover:text-[#7eb6ff]"
            >
              ← Demo studija
            </Link>
            <span className="text-[10px] text-white/25">|</span>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Jauni hero koncepti (demo)</p>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {CONCEPTS.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActive(i)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-left text-[9px] font-semibold uppercase tracking-[0.1em] transition sm:text-[10px] ${
                  i === active
                    ? "border-[#0066ff]/55 bg-[#0066ff]/15 text-white"
                    : "border-white/10 bg-white/[0.03] text-white/55 hover:border-white/20 hover:text-white/80"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[min(90rem,calc(100vw-1rem))] px-3 pb-6 pt-4 sm:px-5 sm:pb-10 sm:pt-6">
        <header className="mb-6 max-w-[52rem] border-b border-white/[0.07] pb-6">
          <h1 className="text-xl font-semibold tracking-tight text-white/95 sm:text-2xl">Desmit pilnīgi citi hero virzieni</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-white/55 sm:text-[14px]">
            Šī lapa ir tikai eksperimentu skats: nekādu lupu, krustu vai orbitālā punkta. Izvēlies konceptu augšā — zemāk redzēsi pilna augstuma
            prototipu ar īstu PROVIN hero tekstu. Pēc tam varēsim apvienot labākos fragmentus.
          </p>
          <p className="mt-2 text-[12px] text-[#7eb6ff]/90">
            <span className="font-semibold">{meta.label}.</span> {meta.blurb}
          </p>
        </header>

        <div className="overflow-hidden rounded-2xl border border-white/[0.1] bg-[#050508] shadow-[0_0_0_1px_rgb(0_0_0/0.4)]">{stage}</div>
      </div>
    </div>
  );
}
