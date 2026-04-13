"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  { id: "glitch", label: "11 · Digitālais traucējums", blurb: "Agresīva nobīde, krāsu nobīde un „kļūdas” ritms." },
  { id: "inferno", label: "12 · Infernālais lauks", blurb: "Sarkana/oranža enerģija no apakšas — intensīvs spīdums." },
  { id: "cryo", label: "13 · Kriogēnā slīde", blurb: "Ciānas šķērsslīdes un auksta metāla līnijas." },
  { id: "tilt", label: "14 · Telpiskā šūpošanās", blurb: "Viss bloks lēni šūpojas 3D perspektīvā." },
  { id: "stripes", label: "15 · Diagonālais audums", blurb: "Bezgalīgi slīdošas diagonāles — gandrīz op art." },
  { id: "vortex", label: "16 · Viesulis", blurb: "Tumšs rotējošs radials — agresīvs dziļums." },
  { id: "monolith", label: "17 · Monolīts", blurb: "Vertikāla gaisma aiz teksta kā signāla stab." },
  { id: "ripple", label: "18 · Impulsu riņķi", blurb: "Vairāki izplešanās gredzeni no centra." },
  { id: "slash", label: "19 · Gaismas šķēle", blurb: "Plaša diagonāla zibšņa šķērsvirziens." },
  { id: "shard", label: "20 · Lauztie stikli", blurb: "Ģeometriski lauzumi ar peldošu spīdumu." },
  { id: "datarain", label: "21 · Datu lietus", blurb: "Monospace kolonnas ar ātru rakstzīmju maiņu." },
  { id: "circuit", label: "22 · Shēmas impulss", blurb: "Leņķaini ceļi ar plūstošu stroke animāciju." },
  { id: "steel", label: "23 · Tērauda spīdums", blurb: "Horizontāls metāla highlights slīdēšana." },
  { id: "beam", label: "24 · Lāzera rotācija", blurb: "Ātrs apgriežens — ļoti agresīvs vizuālais spiediens." },
  { id: "bruise", label: "25 · Kontaminācija", blurb: "Violeti / dzeltens / zils — apzināti „netīrs” laukums." },
  { id: "ticker", label: "26 · Lentas ritējums", blurb: "Divas pretējas horizontālas ziņu lentes." },
  { id: "hex", label: "27 · Šūnu lauks", blurb: "Sešstūru režģis kā zems frekvenču signāls." },
  { id: "hazard", label: "28 · Brīdinājuma josta", blurb: "Dzelteni melnas slīps svītras — augsta kontrasta signāls." },
  { id: "overload", label: "29 · Pārslodze", blurb: "Spēcīgs zils/sarkans mirdzums un gredzena pulsācija." },
  { id: "abyss", label: "30 · Bezdibenis", blurb: "Krītoši punkti tumšā vertikālā gradientā." },
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

type HeroStageProps = { h1: ReactNode; h2: string; pillars: string[] };

function ConceptGlitch({ h1, h2, pillars }: HeroStageProps) {
  return (
    <div className="relative flex min-h-[min(78vh,52rem)] flex-col items-center justify-center overflow-hidden px-4 py-16 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent_0_2px,rgb(0_0_0/0.15)_2px_4px)] opacity-30 mix-blend-overlay" aria-hidden />
      <div className="hfc-glitch-wrap relative z-[1] max-w-[min(100%,48rem)]">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function ConceptInferno({ h1, h2, pillars }: HeroStageProps) {
  return (
    <div className="relative flex min-h-[min(78vh,52rem)] flex-col items-center justify-center overflow-hidden px-4 py-16 text-center">
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%]"
        style={{
          background: `radial-gradient(ellipse 120% 80% at 50% 100%, rgb(255 60 0 / 0.55) 0%, rgb(180 20 0 / 0.35) 35%, transparent 70%)`,
          animation: "hfc-inferno-pulse 4s ease-in-out infinite",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-[-20%] bottom-0 h-[40%] bg-gradient-to-t from-orange-500/25 via-red-600/10 to-transparent blur-2xl"
        aria-hidden
      />
      <div className="relative z-[1] max-w-[min(100%,48rem)] drop-shadow-[0_0_24px_rgb(0_0_0/0.9)]">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/75">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function ConceptCryo({ h1, h2, pillars }: HeroStageProps) {
  return (
    <div className="relative flex min-h-[min(78vh,52rem)] flex-col items-center justify-center overflow-hidden bg-[#02060a] px-4 py-16 text-center">
      <div className="pointer-events-none absolute inset-0 opacity-55" aria-hidden>
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent"
            style={{
              animation: `hfc-cryo-line-y ${3.4 + i * 0.2}s linear infinite`,
              animationDelay: `${i * 0.45}s`,
            }}
          />
        ))}
      </div>
      <div className="relative z-[1] max-w-[min(100%,48rem)]">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-cyan-100/55">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function ConceptTilt({ h1, h2, pillars }: HeroStageProps) {
  return (
    <div className="flex min-h-[min(78vh,52rem)] flex-col items-center justify-center px-4 py-16 text-center [perspective:1000px]">
      <div className="hfc-tilt-stage origin-center will-change-transform">
        <div className="max-w-[min(100%,48rem)]">{h1}</div>
        <p className="mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
          {h2}
        </p>
        <PillarsRow titles={pillars} />
      </div>
    </div>
  );
}

function ConceptStripes({ h1, h2, pillars }: HeroStageProps) {
  return (
    <div className="relative flex min-h-[min(78vh,52rem)] flex-col items-center justify-center overflow-hidden px-4 py-16 text-center">
      <div className="pointer-events-none absolute inset-0 hfc-stripes-bg opacity-70 mix-blend-screen" aria-hidden />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#030304] via-transparent to-[#030304]" aria-hidden />
      <div className="relative z-[1] max-w-[min(100%,48rem)]">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function ConceptVortex({ h1, h2, pillars }: HeroStageProps) {
  return (
    <div className="relative flex min-h-[min(78vh,52rem)] flex-col items-center justify-center overflow-hidden px-4 py-16 text-center">
      <div className="pointer-events-none absolute inset-[-30%] flex items-center justify-center" aria-hidden>
        <div
          className="h-[min(140vw,120vh)] w-[min(140vw,120vh)] rounded-full opacity-90"
          style={{
            background: `conic-gradient(from 0deg, rgb(0 40 120 / 0.5), rgb(0 0 0 / 0.95), rgb(0 80 200 / 0.4), rgb(0 0 0 / 0.98), rgb(0 102 255 / 0.35))`,
            animation: "hfc-vortex-spin 14s linear infinite",
            filter: "blur(1px)",
          }}
        />
      </div>
      <div className="relative z-[1] max-w-[min(100%,48rem)]">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function ConceptMonolith({ h1, h2, pillars }: HeroStageProps) {
  return (
    <div className="relative flex min-h-[min(78vh,52rem)] flex-col items-center justify-center overflow-hidden px-4 py-16 text-center">
      <div
        className="pointer-events-none absolute left-1/2 top-[8%] h-[84%] w-[min(18%,5rem)] -translate-x-1/2 rounded-full bg-gradient-to-b from-[#0066ff]/5 via-[#0066ff]/55 to-[#0066ff]/5 blur-[2px]"
        style={{ animation: "hfc-monolith-breathe 5s ease-in-out infinite" }}
        aria-hidden
      />
      <div className="relative z-[1] max-w-[min(100%,48rem)]">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function ConceptRipple({ h1, h2, pillars }: HeroStageProps) {
  return (
    <div className="relative flex min-h-[min(78vh,52rem)] flex-col items-center justify-center overflow-hidden px-4 py-16 text-center">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="absolute rounded-full border border-[#0066ff]/35"
            style={{
              width: "min(85vw, 28rem)",
              height: "min(85vw, 28rem)",
              animation: "hfc-ripple-ring 5s ease-out infinite",
              animationDelay: `${i * 1.15}s`,
            }}
          />
        ))}
      </div>
      <div className="relative z-[1] max-w-[min(100%,48rem)]">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function ConceptSlash({ h1, h2, pillars }: HeroStageProps) {
  return (
    <div className="relative flex min-h-[min(78vh,52rem)] flex-col items-center justify-center overflow-hidden px-4 py-16 text-center">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div
          className="absolute left-1/2 top-1/2 flex h-[220%] w-[220%] -translate-x-1/2 -translate-y-1/2 items-center justify-center"
          style={{ transform: "translate(-50%, -50%) rotate(-22deg)" }}
        >
          <div
            className="h-full w-[38%] bg-gradient-to-b from-transparent via-[#0066ff]/5 via-[#0066ff]/50 to-transparent opacity-95"
            style={{ animation: "hfc-slash-sweep 5.5s ease-in-out infinite" }}
          />
        </div>
      </div>
      <div className="relative z-[1] max-w-[min(100%,48rem)]">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function ConceptShard({ h1, h2, pillars }: HeroStageProps) {
  const shards = [
    "polygon(0% 0%, 100% 12%, 88% 100%, 0% 78%)",
    "polygon(12% 0%, 100% 0%, 92% 100%, 0% 88%)",
    "polygon(0% 22%, 100% 0%, 100% 100%, 0% 92%)",
  ];
  return (
    <div className="relative flex min-h-[min(78vh,52rem)] flex-col items-center justify-center overflow-hidden px-4 py-16 text-center">
      <div className="pointer-events-none absolute inset-4 opacity-40" aria-hidden>
        {shards.map((clip, i) => (
          <div
            key={i}
            className="absolute inset-0 bg-gradient-to-br from-[#0066ff]/25 to-transparent"
            style={{
              clipPath: clip,
              animation: "hfc-shard-drift 7s ease-in-out infinite",
              animationDelay: `${i * 1.2}s`,
            }}
          />
        ))}
      </div>
      <div className="relative z-[1] max-w-[min(100%,48rem)]">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

const DATARAIN_CHARS = "01Δ█▓▒░X/";

function ConceptDatarain({ h1, h2, pillars }: HeroStageProps) {
  const cols = 16;
  const rows = 20;
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const id = window.setInterval(() => setTick((x) => x + 1), 130);
    return () => window.clearInterval(id);
  }, []);
  const matrix = useMemo(() => {
    return Array.from({ length: cols }, (_, c) =>
      Array.from({ length: rows }, (_, r) => {
        const idx = (c * 13 + r * 7 + tick * 3) % DATARAIN_CHARS.length;
        return DATARAIN_CHARS[idx]!;
      }),
    );
  }, [tick, cols, rows]);

  return (
    <div className="relative flex min-h-[min(78vh,52rem)] flex-col items-center justify-center overflow-hidden px-4 py-16 text-center">
      <div
        className="pointer-events-none absolute inset-0 flex justify-center gap-[2px] overflow-hidden font-mono text-[7px] leading-none text-[#0066ff]/35 opacity-90 sm:gap-1 sm:text-[8px]"
        aria-hidden
      >
        {matrix.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-[1px] pt-[5%]">
            {col.map((ch, ri) => (
              <span key={ri}>{ch}</span>
            ))}
          </div>
        ))}
      </div>
      <div className="relative z-[1] max-w-[min(100%,48rem)] bg-[#030304]/75 px-3 py-2 backdrop-blur-[2px] sm:px-5">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function ConceptCircuit({ h1, h2, pillars }: HeroStageProps) {
  return (
    <div className="relative flex min-h-[min(78vh,52rem)] flex-col items-center justify-center overflow-hidden px-4 py-16 text-center">
      <svg
        className="pointer-events-none absolute inset-x-0 top-[12%] mx-auto h-40 w-full max-w-lg opacity-60"
        viewBox="0 0 320 100"
        fill="none"
        aria-hidden
      >
        <path
          d="M 8 88 L 8 24 L 120 24 L 120 56 L 200 56 L 200 16 L 312 16 L 312 72 L 240 72 L 240 88"
          stroke="rgb(0 102 255 / 0.5)"
          strokeWidth="1.2"
          strokeLinecap="square"
          strokeLinejoin="miter"
          strokeDasharray="14 10"
          style={{ animation: "hfc-circuit-dash 5s linear infinite" }}
        />
        <path
          d="M 40 88 L 40 40 L 160 40 L 160 72 L 280 72"
          stroke="rgb(100 180 255 / 0.35)"
          strokeWidth="0.8"
          strokeDasharray="8 12"
          style={{ animation: "hfc-circuit-dash 3.5s linear infinite reverse" }}
        />
      </svg>
      <div className="relative z-[1] max-w-[min(100%,48rem)] pt-24 sm:pt-28">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function ConceptSteel({ h1, h2, pillars }: HeroStageProps) {
  return (
    <div className="flex min-h-[min(78vh,52rem)] flex-col items-center justify-center px-4 py-16 text-center">
      <div
        className="rounded-3xl border border-white/[0.08] px-6 py-10 sm:px-10 sm:py-12"
        style={{
          background: "linear-gradient(100deg, #0a0c10 0%, #151922 38%, #2a3444 50%, #151922 62%, #0a0c10 100%)",
          backgroundSize: "220% 100%",
          animation: "hfc-steel-shine 6s ease-in-out infinite",
        }}
      >
        <div className="max-w-[min(100%,48rem)]">{h1}</div>
        <p className="mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
          {h2}
        </p>
        <PillarsRow titles={pillars} />
      </div>
    </div>
  );
}

function ConceptBeam({ h1, h2, pillars }: HeroStageProps) {
  return (
    <div className="relative flex min-h-[min(78vh,52rem)] flex-col items-center justify-center overflow-hidden px-4 py-16 text-center">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[200vmax] w-[200vmax] -translate-x-1/2 -translate-y-1/2 opacity-[0.22]" aria-hidden>
        <div
          className="h-full w-full"
          style={{
            background: `conic-gradient(from 0deg, transparent 0 340deg, rgb(0 200 255 / 0.85) 348deg, rgb(255 255 255 / 0.5) 352deg, transparent 358deg)`,
            animation: "hfc-beam-spin 2.8s linear infinite",
          }}
        />
      </div>
      <div className="relative z-[1] max-w-[min(100%,48rem)]">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function ConceptBruise({ h1, h2, pillars }: HeroStageProps) {
  return (
    <div className="relative flex min-h-[min(78vh,52rem)] flex-col items-center justify-center overflow-hidden px-4 py-16 text-center">
      <div
        className="pointer-events-none absolute -left-[20%] top-[10%] h-[70%] w-[70%] rounded-full bg-[radial-gradient(circle_at_30%_40%,rgb(120_40_200/0.55),transparent_55%)] blur-2xl"
        style={{ animation: "hfc-bruise-morph 11s ease-in-out infinite" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-[15%] bottom-0 h-[60%] w-[55%] rounded-full bg-[radial-gradient(circle_at_60%_50%,rgb(220_200_40/0.35),transparent_50%)] blur-xl"
        style={{ animation: "hfc-bruise-morph 9s ease-in-out infinite reverse" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-[20%] bottom-[5%] h-[45%] w-[50%] rounded-full bg-[radial-gradient(circle_at_50%_50%,rgb(0_102_255/0.4),transparent_55%)] blur-2xl"
        style={{ animation: "hfc-bruise-morph 13s ease-in-out infinite" }}
        aria-hidden
      />
      <div className="relative z-[1] max-w-[min(100%,48rem)]">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/70">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

const TICKER_LINE =
  "PROVIN · VIN · SLUDINĀJUMS · RISKS · 79,99 € · AUDITS · DATU SLĀNIS · PTAC · DISTANCES LĪGUMS · PROVIN · ";

function ConceptTicker({ h1, h2, pillars }: HeroStageProps) {
  const doubled = TICKER_LINE + TICKER_LINE;
  return (
    <div className="relative flex min-h-[min(78vh,52rem)] flex-col items-center justify-center overflow-hidden px-0 py-16 text-center">
      <div
        className="pointer-events-none absolute top-[14%] w-full overflow-hidden border-y border-white/[0.06] bg-black/50 py-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-[#0066ff]/70"
        aria-hidden
      >
        <div className="flex w-max whitespace-nowrap" style={{ animation: "hfc-ticker 22s linear infinite" }}>
          <span className="pr-16">{doubled}</span>
          <span className="pr-16">{doubled}</span>
        </div>
      </div>
      <div
        className="pointer-events-none absolute bottom-[12%] w-full overflow-hidden border-y border-white/[0.06] bg-black/50 py-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-white/35"
        aria-hidden
      >
        <div
          className="flex w-max whitespace-nowrap"
          style={{ animation: "hfc-ticker 18s linear reverse infinite" }}
        >
          <span className="pr-16">{doubled}</span>
          <span className="pr-16">{doubled}</span>
        </div>
      </div>
      <div className="relative z-[1] max-w-[min(100%,48rem)] px-4">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] px-4 text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

const HEX_BG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cpath d='M14 0 L28 8.5 V24.5 L14 33 L0 24.5 V8.5z' fill='none' stroke='%230066ff22' stroke-width='1'/%3E%3C/svg%3E\")";

function ConceptHex({ h1, h2, pillars }: HeroStageProps) {
  return (
    <div
      className="relative flex min-h-[min(78vh,52rem)] flex-col items-center justify-center overflow-hidden px-4 py-16 text-center"
      style={{ backgroundImage: HEX_BG, backgroundSize: "28px 49px" }}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#030304] via-transparent to-[#030304]" aria-hidden />
      <div className="relative z-[1] max-w-[min(100%,48rem)]">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function ConceptHazard({ h1, h2, pillars }: HeroStageProps) {
  return (
    <div className="relative flex min-h-[min(78vh,52rem)] flex-col items-center justify-center overflow-hidden px-4 py-16 text-center">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 hfc-hazard-bg opacity-40 mix-blend-screen" aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 hfc-hazard-bg opacity-40 mix-blend-screen" aria-hidden />
      <div className="relative z-[1] max-w-[min(100%,48rem)]">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function ConceptOverload({ h1, h2, pillars }: HeroStageProps) {
  return (
    <div className="relative flex min-h-[min(78vh,52rem)] flex-col items-center justify-center px-4 py-16 text-center">
      <div
        className="pointer-events-none absolute inset-[max(0.5rem,3vw)] rounded-[2rem] border-2 border-[#0066ff]/40"
        style={{ animation: "hfc-overload-flash 2.8s ease-in-out infinite" }}
        aria-hidden
      />
      <div className="relative z-[1] max-w-[min(100%,48rem)]">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function ConceptAbyss({ h1, h2, pillars }: HeroStageProps) {
  const stars = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => ({
        key: i,
        left: `${(i * 17) % 100}%`,
        delay: `${(i % 12) * 0.35}s`,
        dur: `${4 + (i % 5) * 0.6}s`,
      })),
    [],
  );
  return (
    <div className="relative flex min-h-[min(78vh,52rem)] flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#020205] via-[#050508] to-black px-4 py-16 text-center">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {stars.map((s) => (
          <span
            key={s.key}
            className="absolute top-0 h-[2px] w-[2px] rounded-full bg-[#7eb6ff]"
            style={{
              left: s.left,
              animation: `hfc-abyss-rise ${s.dur} linear infinite`,
              animationDelay: s.delay,
            }}
          />
        ))}
      </div>
      <div className="relative z-[1] max-w-[min(100%,48rem)]">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
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
      case "glitch":
        return <ConceptGlitch h1={h1} h2={h2} pillars={pillars} />;
      case "inferno":
        return <ConceptInferno h1={h1} h2={h2} pillars={pillars} />;
      case "cryo":
        return <ConceptCryo h1={h1} h2={h2} pillars={pillars} />;
      case "tilt":
        return <ConceptTilt h1={h1} h2={h2} pillars={pillars} />;
      case "stripes":
        return <ConceptStripes h1={h1} h2={h2} pillars={pillars} />;
      case "vortex":
        return <ConceptVortex h1={h1} h2={h2} pillars={pillars} />;
      case "monolith":
        return <ConceptMonolith h1={h1} h2={h2} pillars={pillars} />;
      case "ripple":
        return <ConceptRipple h1={h1} h2={h2} pillars={pillars} />;
      case "slash":
        return <ConceptSlash h1={h1} h2={h2} pillars={pillars} />;
      case "shard":
        return <ConceptShard h1={h1} h2={h2} pillars={pillars} />;
      case "datarain":
        return <ConceptDatarain h1={h1} h2={h2} pillars={pillars} />;
      case "circuit":
        return <ConceptCircuit h1={h1} h2={h2} pillars={pillars} />;
      case "steel":
        return <ConceptSteel h1={h1} h2={h2} pillars={pillars} />;
      case "beam":
        return <ConceptBeam h1={h1} h2={h2} pillars={pillars} />;
      case "bruise":
        return <ConceptBruise h1={h1} h2={h2} pillars={pillars} />;
      case "ticker":
        return <ConceptTicker h1={h1} h2={h2} pillars={pillars} />;
      case "hex":
        return <ConceptHex h1={h1} h2={h2} pillars={pillars} />;
      case "hazard":
        return <ConceptHazard h1={h1} h2={h2} pillars={pillars} />;
      case "overload":
        return <ConceptOverload h1={h1} h2={h2} pillars={pillars} />;
      case "abyss":
        return <ConceptAbyss h1={h1} h2={h2} pillars={pillars} />;
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
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Hero koncepti — 30 demo</p>
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
          <h1 className="text-xl font-semibold tracking-tight text-white/95 sm:text-2xl">Trīsdesmit atšķirīgi hero virzieni</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-white/55 sm:text-[14px]">
            Eksperimentu skats: pirmie desmit ir maigāki / strukturētāki; 11–30 iekļauj agresīvākus, kontrastainākus un „trokšņainākus” variantus. Izvēlies konceptu augšā — zemāk pilna augstuma prototips ar īstu PROVIN hero tekstu.
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
