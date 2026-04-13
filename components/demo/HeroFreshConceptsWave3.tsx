"use client";

import type { MouseEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import "./hero-fresh-concepts-wave3.css";

export type HeroWave3Props = { h1: ReactNode; h2: string; pillars: string[] };

export type HeroConceptMeta = { id: string; label: string; blurb: string };

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

const shell =
  "hfc3-root relative flex min-h-[min(78vh,52rem)] flex-col items-center justify-center overflow-hidden px-4 py-16 text-center";

export const HERO_CONCEPTS_WAVE3: HeroConceptMeta[] = [
  { id: "iris", label: "31 · Iris", blurb: "Koncentriski gredzeni un zīlīte — bioloģiska metafora par „skatīšanos cauri datiem”." },
  { id: "retina", label: "32 · Tīklenes šķiedras", blurb: "Radiāls šķiedru lauks — kā sensora virsma." },
  { id: "pupil", label: "33 · Zīlītes kustība", blurb: "Lēna, organiska zīlītes nobīde fokusa laukumā." },
  { id: "pupiltrack", label: "34 · Peles fokuss", blurb: "Zīlīte seko kursoram — interaktīvs „skatiens”." },
  { id: "lensring", label: "35 · Lēcas halo", blurb: "Hromatiskais gredzens ap centrālo lauku — lupa kā optika." },
  { id: "loupe", label: "36 · Lūpas siluets", blurb: "Minimāls lupas kontūrs + iekšējā datu režģa slīde." },
  { id: "tesseract", label: "37 · 4D kubs", blurb: "Wireframe kubs ar rotāciju — datu bloks telpā." },
  { id: "databeams", label: "38 · Datu staru kūlis", blurb: "Vairākas Bezier līknes ar plūstošu stroke." },
  { id: "databars", label: "39 · Histogramma", blurb: "Dinamiski stabi — frekvenču / slāņu sajūta." },
  { id: "datastack", label: "40 · Slāņu kaudze", blurb: "3D kārtojums ar ēnām — datu nogulumi." },
  { id: "gearmesh", label: "41 · Zobrata pāris", blurb: "Divi saistīti zobrati pretējā virzienā." },
  { id: "rack", label: "42 · Zobsliede", blurb: "Taisna zobsliede un ritenis — lineārs mehānisms." },
  { id: "piston", label: "43 · Virzulis", blurb: "Vertikāla kinemātika — spēks un impulss." },
  { id: "linkage", label: "44 · Četrstūra kinemātika", blurb: "Četru stienīšu ķēde ar plūstošu leņķi." },
  { id: "flywheel", label: "45 · Lidojošais ritenis", blurb: "Smags gredzens ar inerces sajūtu." },
  { id: "spring", label: "46 · Spirāles spriegums", blurb: "SVG spirāle ar „elpošanu” gar stroke." },
  { id: "odometer", label: "47 · Odometrs", blurb: "Krītoši cipari — nobraukuma metafora." },
  { id: "trip", label: "48 · Brauciena skaitītājs", blurb: "Garāks ciparu lauks + „km” marķieris." },
  { id: "speedo", label: "49 · Spidometra loks", blurb: "Loka skala un šķērss — klasiska mērierīce." },
  { id: "redline", label: "50 · Sarkanais apgabals", blurb: "Adata tuvu sarkanajai zonai ar brīdinājuma spīdumu." },
  { id: "meshnet", label: "51 · Mezgla grafs", blurb: "Mezgli un šķērssavienojumi — tīkla topoloģija." },
  { id: "synapse", label: "52 · Sinapse", blurb: "Divi mezgli un loka „izlāde” starp tiem." },
  { id: "neural", label: "53 · Neironu režģis", blurb: "Trijstūru režģis ar mazu signālu vilni." },
  { id: "quantum", label: "54 · Varbūtības gredzeni", blurb: "Vairāki gredzeni ar fāžu nobīdi — abstrakta interference." },
  { id: "bridge", label: "55 · Tilta trokšņi", blurb: "Vantīšu līnijas ar mikro vibrāciju." },
  { id: "chain", label: "56 · Ķēde", blurb: "Saistīti posmi ar secīgu impulsu." },
  { id: "valve", label: "57 · Vārsta rats", blurb: "Rotējošs vārsta ritenis ar rievām." },
  { id: "turbine", label: "58 · Turbīnas asmens", blurb: "Septiņas asmens formas ar rotāciju." },
  { id: "dipstick", label: "59 · Eļļas līmenis", blurb: "Vertikāla mērjosla un šķidruma līmeņa vilnis." },
  { id: "ecu", label: "60 · ECU bloks", blurb: "Kontrollera siluets ar mirgojošiem kontaktiem." },
];

function W3Iris({ h1, h2, pillars }: HeroWave3Props) {
  return (
    <div className={shell}>
      <svg className="pointer-events-none absolute left-1/2 top-[18%] h-[min(52vw,22rem)] w-[min(52vw,22rem)] -translate-x-1/2 opacity-50" viewBox="0 0 200 200" aria-hidden>
        {[92, 76, 60, 44, 28].map((r, i) => (
          <circle
            key={r}
            cx="100"
            cy="100"
            r={r}
            fill="none"
            stroke={`rgb(0 102 255 / ${0.12 + i * 0.08})`}
            strokeWidth="1.2"
            style={{ animation: `hfc3-iris-breathe ${5 + i * 0.4}s ease-in-out infinite`, animationDelay: `${i * 0.2}s` }}
          />
        ))}
        <circle cx="100" cy="100" r="14" fill="rgb(5 8 14)" stroke="rgb(0 102 255 / 0.5)" strokeWidth="1.5" />
        <circle cx="100" cy="100" r="6" fill="rgb(0 102 255 / 0.35)" style={{ animation: "hfc3-iris-breathe 3s ease-in-out infinite" }} />
      </svg>
      <div className="relative z-[1] max-w-[min(100%,48rem)] pt-[min(28vw,9rem)] sm:pt-[min(22vw,7rem)]">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function W3Retina({ h1, h2, pillars }: HeroWave3Props) {
  return (
    <div className={shell}>
      <svg className="pointer-events-none absolute inset-0 opacity-[0.22]" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" aria-hidden>
        {Array.from({ length: 48 }).map((_, i) => {
          const a = (i / 48) * Math.PI * 2;
          return (
            <line
              key={i}
              x1="200"
              y1="200"
              x2={200 + Math.cos(a) * 380}
              y2={200 + Math.sin(a) * 380}
              stroke="rgb(0 102 255 / 0.25)"
              strokeWidth="0.6"
            />
          );
        })}
      </svg>
      <div className="relative z-[1] max-w-[min(100%,48rem)]">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function W3Pupil({ h1, h2, pillars }: HeroWave3Props) {
  return (
    <div className={shell}>
      <div className="pointer-events-none absolute left-1/2 top-[20%] h-32 w-32 -translate-x-1/2 rounded-full border border-[#0066ff]/30 bg-black/60 shadow-[0_0_40px_rgb(0_102_255/0.25)]" aria-hidden>
        <div
          className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0066ff]/70 blur-[0.5px]"
          style={{ animation: "hfc3-pupil-dart 6s ease-in-out infinite" }}
        />
      </div>
      <div className="relative z-[1] max-w-[min(100%,48rem)] pt-20">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function W3PupilTrack({ h1, h2, pillars }: HeroWave3Props) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const move = useCallback((e: MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    const ny = ((e.clientY - r.top) / r.height - 0.5) * 2;
    setPos({ x: Math.max(-1, Math.min(1, nx)), y: Math.max(-1, Math.min(1, ny)) });
  }, []);
  return (
    <div className={shell} onMouseMove={move} onMouseLeave={() => setPos({ x: 0, y: 0 })}>
      <div className="pointer-events-none absolute left-1/2 top-[20%] h-36 w-36 -translate-x-1/2 rounded-full border border-white/15 bg-black/50" aria-hidden>
        <div
          className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-[#0066ff] to-[#003366]"
          style={{ transform: `translate(calc(-50% + ${pos.x * 14}px), calc(-50% + ${pos.y * 14}px))` }}
        />
      </div>
      <div className="relative z-[1] max-w-[min(100%,48rem)] pt-24">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function W3LensRing({ h1, h2, pillars }: HeroWave3Props) {
  return (
    <div className={shell}>
      <div className="pointer-events-none absolute left-1/2 top-[16%] h-[min(48vw,20rem)] w-[min(48vw,20rem)] -translate-x-1/2 rounded-full" aria-hidden>
        <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,rgb(255_0_100/0.35),transparent_40deg,rgb(0_255_200/0.25)_120deg,transparent_200deg,rgb(0_102_255/0.5)_280deg,transparent)] blur-sm" style={{ animation: "hfc3-scan-orbit 18s linear infinite" }} />
        <div className="absolute inset-[10%] rounded-full border-2 border-white/10 bg-black/40" />
      </div>
      <div className="relative z-[1] max-w-[min(100%,48rem)] pt-[min(26vw,8.5rem)]">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function W3Loupe({ h1, h2, pillars }: HeroWave3Props) {
  return (
    <div className={shell}>
      <div className="pointer-events-none absolute left-[50%] top-[14%] h-[min(42vw,17rem)] w-[min(42vw,17rem)] -translate-x-[58%]" aria-hidden>
        <Search className="h-full w-full text-[#0066ff]/25 [stroke-width:1]" strokeWidth={1} aria-hidden />
        <div className="absolute left-[12%] top-[12%] h-[52%] w-[52%] overflow-hidden rounded-full border border-[#0066ff]/20">
          <div className="hfc3-stripes-bg absolute inset-0 opacity-40" />
        </div>
      </div>
      <div className="relative z-[1] max-w-[min(100%,48rem)] pt-[min(24vw,7.5rem)]">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function W3Tesseract({ h1, h2, pillars }: HeroWave3Props) {
  return (
    <div className={shell}>
      <div className="pointer-events-none absolute left-1/2 top-[12%] flex h-44 w-44 -translate-x-1/2 items-center justify-center [perspective:420px]" aria-hidden>
        <div
          className="relative h-24 w-24 [transform-style:preserve-3d]"
          style={{ animation: "hfc3-cube-spin 14s linear infinite" }}
        >
          {[
            { t: "translateZ(48px)", b: "border-[#0066ff]/40" },
            { t: "translateZ(-48px)", b: "border-cyan-400/25" },
            { t: "rotateY(90deg) translateZ(48px)", b: "border-white/15" },
            { t: "rotateY(-90deg) translateZ(48px)", b: "border-white/15" },
            { t: "rotateX(90deg) translateZ(48px)", b: "border-[#0066ff]/25" },
            { t: "rotateX(-90deg) translateZ(48px)", b: "border-white/10" },
          ].map((f, i) => (
            <div
              key={i}
              className={`absolute inset-0 m-auto h-24 w-24 border bg-black/20 ${f.b}`}
              style={{ transform: f.t }}
            />
          ))}
        </div>
      </div>
      <div className="relative z-[1] max-w-[min(100%,48rem)] pt-36">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function W3DataBeams({ h1, h2, pillars }: HeroWave3Props) {
  return (
    <div className={shell}>
      <svg className="pointer-events-none absolute inset-x-0 top-[8%] mx-auto h-52 w-full max-w-2xl opacity-55" viewBox="0 0 400 160" fill="none" aria-hidden>
        <path
          d="M 0 120 Q 100 20 200 100 T 400 40"
          stroke="rgb(0 102 255 / 0.45)"
          strokeWidth="1.2"
          strokeDasharray="10 14"
          style={{ animation: "hfc3-dash-flow 5s linear infinite" }}
        />
        <path
          d="M 0 60 Q 140 140 280 40 T 400 100"
          stroke="rgb(120 180 255 / 0.35)"
          strokeWidth="0.9"
          strokeDasharray="8 12"
          style={{ animation: "hfc3-dash-flow 4s linear infinite reverse" }}
        />
        <path
          d="M 20 140 C 120 40 220 160 380 20"
          stroke="rgb(0 200 255 / 0.3)"
          strokeWidth="0.8"
          strokeDasharray="6 10"
          style={{ animation: "hfc3-dash-flow 6.5s linear infinite" }}
        />
      </svg>
      <div className="relative z-[1] max-w-[min(100%,48rem)] pt-28">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function W3DataBars({ h1, h2, pillars }: HeroWave3Props) {
  const h = [40, 72, 55, 88, 48, 95, 62, 78, 52, 84, 44, 68];
  return (
    <div className={shell}>
      <div className="pointer-events-none absolute bottom-[28%] left-1/2 flex h-28 w-[min(90%,28rem)] -translate-x-1/2 items-end justify-center gap-1 opacity-60" aria-hidden>
        {h.map((height, i) => (
          <div
            key={i}
            className="w-[6px] max-w-[2.5%] flex-1 origin-bottom rounded-t-sm bg-gradient-to-t from-[#0066ff]/20 to-[#0066ff]/85 sm:w-2"
            style={{
              height: `${height}%`,
              animation: `hfc3-bar-pulse ${1.8 + (i % 5) * 0.25}s ease-in-out infinite`,
              animationDelay: `${i * 0.12}s`,
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

function W3DataStack({ h1, h2, pillars }: HeroWave3Props) {
  const layers = ["w-[92%]", "w-[88%]", "w-[84%]", "w-[80%]"];
  return (
    <div className={shell}>
      <div className="pointer-events-none absolute left-1/2 top-[18%] flex w-[min(22rem,80vw)] -translate-x-1/2 flex-col items-center gap-2 opacity-50" aria-hidden>
        {layers.map((w, i) => (
          <div
            key={w}
            className={`h-3 rounded-md border border-white/10 bg-gradient-to-r from-[#0066ff]/10 via-white/5 to-[#0066ff]/10 ${w}`}
            style={{
              transform: `translateY(${i * -4}px) perspective(400px) rotateX(52deg)`,
              boxShadow: "0 8px 24px rgb(0 0 0 / 0.5)",
            }}
          />
        ))}
      </div>
      <div className="relative z-[1] max-w-[min(100%,48rem)] pt-24">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function W3GearMesh({ h1, h2, pillars }: HeroWave3Props) {
  return (
    <div className={shell}>
      <svg className="pointer-events-none absolute left-1/2 top-[14%] h-40 w-64 -translate-x-1/2 opacity-50" viewBox="0 0 200 100" fill="none" aria-hidden>
        <g style={{ transformOrigin: "50px 50px", animation: "hfc3-gear 8s linear infinite" }}>
          <circle cx="50" cy="50" r="28" stroke="rgb(0 102 255 / 0.5)" strokeWidth="1.2" />
          {[...Array(12)].map((_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return (
              <line
                key={i}
                x1={50 + Math.cos(a) * 22}
                y1={50 + Math.sin(a) * 22}
                x2={50 + Math.cos(a) * 32}
                y2={50 + Math.sin(a) * 32}
                stroke="rgb(0 102 255 / 0.6)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            );
          })}
        </g>
        <g style={{ transformOrigin: "150px 50px", animation: "hfc3-gear-rev 8s linear infinite" }}>
          <circle cx="150" cy="50" r="22" stroke="rgb(180 200 255 / 0.45)" strokeWidth="1" />
          {[...Array(10)].map((_, i) => {
            const a = (i / 10) * Math.PI * 2;
            return (
              <line
                key={i}
                x1={150 + Math.cos(a) * 16}
                y1={50 + Math.sin(a) * 16}
                x2={150 + Math.cos(a) * 26}
                y2={50 + Math.sin(a) * 26}
                stroke="rgb(180 200 255 / 0.55)"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            );
          })}
        </g>
      </svg>
      <div className="relative z-[1] max-w-[min(100%,48rem)] pt-32">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function W3Rack({ h1, h2, pillars }: HeroWave3Props) {
  return (
    <div className={shell}>
      <svg className="pointer-events-none absolute left-1/2 top-[22%] h-24 w-[min(90%,24rem)] -translate-x-1/2 opacity-55" viewBox="0 0 360 80" fill="none" aria-hidden>
        <line x1="20" y1="40" x2="300" y2="40" stroke="rgb(255 255 255 / 0.15)" strokeWidth="2" />
        {Array.from({ length: 28 }).map((_, i) => (
          <line key={i} x1={24 + i * 10} y1="34" x2={24 + i * 10} y2="46" stroke="rgb(0 102 255 / 0.5)" strokeWidth="2" />
        ))}
        <circle cx="320" cy="40" r="18" stroke="rgb(0 102 255 / 0.45)" strokeWidth="1.2" />
      </svg>
      <div className="relative z-[1] max-w-[min(100%,48rem)] pt-28">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function W3Piston({ h1, h2, pillars }: HeroWave3Props) {
  return (
    <div className={shell}>
      <div className="pointer-events-none absolute left-[18%] top-[20%] flex h-40 w-16 flex-col items-center opacity-50" aria-hidden>
        <div className="h-3 w-full rounded-sm bg-white/20" />
        <div className="mt-1 flex h-28 w-12 items-start justify-center rounded-sm border border-white/15 bg-black/50 pt-1">
          <div className="h-16 w-8 rounded-sm bg-gradient-to-b from-[#0066ff]/60 to-[#0066ff]/20" style={{ animation: "hfc3-piston 2.2s ease-in-out infinite" }} />
        </div>
        <div className="mt-1 h-3 w-full rounded-sm bg-white/20" />
      </div>
      <div className="relative z-[1] max-w-[min(100%,48rem)] pl-8 sm:pl-12">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance pl-8 text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65 sm:pl-12">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function W3Linkage({ h1, h2, pillars }: HeroWave3Props) {
  return (
    <div className={shell}>
      <svg className="pointer-events-none absolute left-1/2 top-[20%] h-36 w-72 -translate-x-1/2 opacity-50" viewBox="0 0 280 100" fill="none" aria-hidden>
        <path
          d="M 20 80 L 80 30 L 200 30 L 260 80"
          stroke="rgb(0 102 255 / 0.4)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="20" cy="80" r="5" fill="rgb(0 102 255 / 0.5)" />
        <circle cx="80" cy="30" r="5" fill="rgb(0 200 255 / 0.45)" style={{ animation: "hfc3-node-pulse 2s ease-in-out infinite" }} />
        <circle cx="200" cy="30" r="5" fill="rgb(0 102 255 / 0.5)" style={{ animation: "hfc3-node-pulse 2s ease-in-out 0.4s infinite" }} />
        <circle cx="260" cy="80" r="5" fill="rgb(0 102 255 / 0.5)" />
      </svg>
      <div className="relative z-[1] max-w-[min(100%,48rem)] pt-28">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function W3Flywheel({ h1, h2, pillars }: HeroWave3Props) {
  return (
    <div className={shell}>
      <div className="pointer-events-none absolute left-1/2 top-[14%] h-44 w-44 -translate-x-1/2 rounded-full border-[3px] border-dashed border-[#0066ff]/35 opacity-60" style={{ animation: "hfc3-flywheel 10s linear infinite" }} aria-hidden />
      <div className="pointer-events-none absolute left-1/2 top-[14%] h-32 w-32 -translate-x-1/2 translate-y-6 rounded-full border border-white/10" aria-hidden />
      <div className="relative z-[1] max-w-[min(100%,48rem)] pt-36">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function W3Spring({ h1, h2, pillars }: HeroWave3Props) {
  return (
    <div className={shell}>
      <svg className="pointer-events-none absolute right-[8%] top-[18%] h-48 w-24 opacity-45" viewBox="0 0 60 200" fill="none" aria-hidden>
        <path
          d="M 30 10 Q 50 30 10 50 Q 50 70 10 90 Q 50 110 10 130 Q 50 150 30 190"
          stroke="rgb(0 102 255 / 0.55)"
          strokeWidth="2"
          fill="none"
          strokeDasharray="8 6"
          style={{ animation: "hfc3-dash-flow 3.5s linear infinite" }}
        />
      </svg>
      <div className="relative z-[1] max-w-[min(100%,48rem)] pr-10">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance pr-10 text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function useOdometerDigits(len: number) {
  const [digits, setDigits] = useState<number[]>(() => Array.from({ length: len }, () => 0));
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const id = window.setInterval(() => {
      setDigits((prev) => prev.map((d) => (d + (Math.random() > 0.65 ? 1 : 0)) % 10));
    }, 320);
    return () => window.clearInterval(id);
  }, [len]);
  return digits;
}

function OdometerColumn({ value }: { value: number }) {
  return (
    <div className="relative h-10 w-7 overflow-hidden rounded border border-[#0066ff]/30 bg-black/60 font-mono text-lg font-bold leading-10 text-[#7eb6ff]">
      <div className="flex flex-col transition-transform duration-300 ease-out" style={{ transform: `translateY(-${value * 2.5}rem)` }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <span key={n} className="h-10 shrink-0 text-center">
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}

function W3Odometer({ h1, h2, pillars }: HeroWave3Props) {
  const d = useOdometerDigits(5);
  return (
    <div className={shell}>
      <div className="pointer-events-none mb-4 flex justify-center gap-1.5 opacity-90" aria-hidden>
        {d.map((v, i) => (
          <OdometerColumn key={i} value={v} />
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

function W3Trip({ h1, h2, pillars }: HeroWave3Props) {
  const d = useOdometerDigits(7);
  return (
    <div className={shell}>
      <div className="pointer-events-none mb-3 flex flex-wrap items-center justify-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-white/40" aria-hidden>
        <span>TRIP</span>
        <div className="flex gap-1">
          {d.map((v, i) => (
            <OdometerColumn key={i} value={v} />
          ))}
        </div>
        <span className="text-[#0066ff]/80">km</span>
      </div>
      <div className="relative z-[1] max-w-[min(100%,48rem)]">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function W3Speedo({ h1, h2, pillars }: HeroWave3Props) {
  return (
    <div className={shell}>
      <svg className="pointer-events-none absolute left-1/2 top-[12%] h-44 w-72 -translate-x-1/2 opacity-55" viewBox="0 0 200 110" fill="none" aria-hidden>
        <path
          d="M 30 95 A 70 70 0 0 1 170 95"
          stroke="rgb(255 255 255 / 0.12)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
          const a = Math.PI * (1 - i / 8);
          const x1 = 100 + 58 * Math.cos(a);
          const y1 = 95 + 58 * Math.sin(a);
          const x2 = 100 + 66 * Math.cos(a);
          const y2 = 95 + 66 * Math.sin(a);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgb(0 102 255 / 0.45)" strokeWidth="1.2" />;
        })}
        <g style={{ transformOrigin: "100px 95px", animation: "hfc3-needle 5s ease-in-out infinite" }}>
          <line x1="100" y1="95" x2="100" y2="38" stroke="rgb(255 100 80 / 0.9)" strokeWidth="2" strokeLinecap="round" />
        </g>
      </svg>
      <div className="relative z-[1] max-w-[min(100%,48rem)] pt-32">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function W3Redline({ h1, h2, pillars }: HeroWave3Props) {
  return (
    <div className={shell}>
      <svg className="pointer-events-none absolute left-1/2 top-[12%] h-44 w-72 -translate-x-1/2 opacity-70" viewBox="0 0 200 110" fill="none" aria-hidden>
        <defs>
          <linearGradient id="hfc3-redarc" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(0 102 255 / 0.3)" />
            <stop offset="72%" stopColor="rgb(255 80 60 / 0.9)" />
            <stop offset="100%" stopColor="rgb(255 40 40 / 1)" />
          </linearGradient>
        </defs>
        <path d="M 30 95 A 70 70 0 0 1 170 95" stroke="url(#hfc3-redarc)" strokeWidth="6" strokeLinecap="round" />
        <g style={{ transformOrigin: "100px 95px", animation: "hfc3-needle 3.5s ease-in-out infinite" }}>
          <line x1="100" y1="95" x2="155" y2="62" stroke="rgb(255 220 200)" strokeWidth="2.2" strokeLinecap="round" />
        </g>
      </svg>
      <div className="relative z-[1] max-w-[min(100%,48rem)] pt-32">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

const MESH_NODES: { x: number; y: number }[] = [
  { x: 40, y: 30 },
  { x: 120, y: 20 },
  { x: 200, y: 45 },
  { x: 90, y: 80 },
  { x: 170, y: 90 },
  { x: 30, y: 100 },
  { x: 220, y: 25 },
  { x: 150, y: 55 },
];

function W3MeshNet({ h1, h2, pillars }: HeroWave3Props) {
  const edges = useMemo(() => {
    const e: [number, number][] = [];
    for (let i = 0; i < MESH_NODES.length; i++) {
      for (let j = i + 1; j < MESH_NODES.length; j++) {
        const dx = MESH_NODES[i]!.x - MESH_NODES[j]!.x;
        const dy = MESH_NODES[i]!.y - MESH_NODES[j]!.y;
        if (dx * dx + dy * dy < 120 * 120) e.push([i, j]);
      }
    }
    return e;
  }, []);
  return (
    <div className={shell}>
      <svg className="pointer-events-none absolute left-1/2 top-[14%] h-44 w-[min(90%,20rem)] -translate-x-1/2 opacity-50" viewBox="0 0 260 120" fill="none" aria-hidden>
        {edges.map(([a, b], i) => (
          <line
            key={i}
            x1={MESH_NODES[a]!.x}
            y1={MESH_NODES[a]!.y}
            x2={MESH_NODES[b]!.x}
            y2={MESH_NODES[b]!.y}
            stroke="rgb(0 102 255 / 0.25)"
            strokeWidth="0.8"
          />
        ))}
        {MESH_NODES.map((n, i) => (
          <circle key={i} cx={n.x} cy={n.y} r="3.5" fill="rgb(0 102 255 / 0.55)" style={{ animation: `hfc3-node-pulse 2.4s ease-in-out ${i * 0.15}s infinite` }} />
        ))}
      </svg>
      <div className="relative z-[1] max-w-[min(100%,48rem)] pt-32">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function W3Synapse({ h1, h2, pillars }: HeroWave3Props) {
  return (
    <div className={shell}>
      <svg className="pointer-events-none absolute left-1/2 top-[20%] h-32 w-64 -translate-x-1/2 opacity-60" viewBox="0 0 200 100" fill="none" aria-hidden>
        <circle cx="40" cy="50" r="8" fill="rgb(0 102 255 / 0.6)" />
        <circle cx="160" cy="50" r="8" fill="rgb(0 200 255 / 0.55)" />
        <path
          d="M 48 50 Q 100 10 152 50"
          stroke="rgb(0 180 255 / 0.5)"
          strokeWidth="1.5"
          fill="none"
          strokeDasharray="6 8"
          style={{ animation: "hfc3-dash-flow 1.4s linear infinite", opacity: 0.85 }}
        />
      </svg>
      <div className="relative z-[1] max-w-[min(100%,48rem)] pt-28">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function W3Neural({ h1, h2, pillars }: HeroWave3Props) {
  const tri = [
    [100, 20, 40, 100, 160, 100],
    [100, 45, 55, 95, 145, 95],
  ];
  return (
    <div className={shell}>
      <svg className="pointer-events-none absolute left-1/2 top-[16%] h-40 w-56 -translate-x-1/2 opacity-45" viewBox="0 0 200 110" fill="none" aria-hidden>
        {tri.map((t, k) => (
          <polygon
            key={k}
            points={`${t[0]},${t[1]} ${t[2]},${t[3]} ${t[4]},${t[5]}`}
            stroke="rgb(0 102 255 / 0.35)"
            strokeWidth="0.8"
            fill="rgb(0 102 255 / 0.04)"
            style={{ animation: `hfc3-fade-pulse ${3 + k}s ease-in-out infinite` }}
          />
        ))}
      </svg>
      <div className="relative z-[1] max-w-[min(100%,48rem)] pt-32">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function W3Quantum({ h1, h2, pillars }: HeroWave3Props) {
  return (
    <div className={shell}>
      <div className="pointer-events-none absolute left-1/2 top-[18%] h-48 w-48 -translate-x-1/2" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="absolute left-1/2 top-1/2 rounded-full border border-[#0066ff]/25"
            style={{
              width: `${40 + i * 22}%`,
              height: `${40 + i * 22}%`,
              transform: "translate(-50%, -50%)",
              animation: `hfc3-iris-breathe ${3.5 + i * 0.5}s ease-in-out infinite`,
              animationDelay: `${i * 0.25}s`,
            }}
          />
        ))}
      </div>
      <div className="relative z-[1] max-w-[min(100%,48rem)] pt-36">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function W3Bridge({ h1, h2, pillars }: HeroWave3Props) {
  return (
    <div className={shell}>
      <svg className="pointer-events-none absolute left-1/2 top-[22%] h-32 w-[min(92%,26rem)] -translate-x-1/2 opacity-45" viewBox="0 0 400 100" fill="none" aria-hidden>
        <path d="M 20 80 Q 200 10 380 80" stroke="rgb(255 255 255 / 0.15)" strokeWidth="1.5" />
        {Array.from({ length: 11 }).map((_, i) => {
          const x = 40 + i * 32;
          return (
            <line
              key={i}
              x1={x}
              y1={80 - i * 1.2}
              x2={x}
              y2="20"
              stroke="rgb(0 102 255 / 0.35)"
              strokeWidth="0.6"
              style={{ animation: "hfc3-pupil-dart 4s ease-in-out infinite", animationDelay: `${i * 0.08}s` }}
            />
          );
        })}
      </svg>
      <div className="relative z-[1] max-w-[min(100%,48rem)] pt-28">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function W3Chain({ h1, h2, pillars }: HeroWave3Props) {
  return (
    <div className={shell}>
      <div className="pointer-events-none absolute left-1/2 top-[22%] flex -translate-x-1/2 gap-2 opacity-55" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-10 w-10 rounded-full border-2 border-[#0066ff]/40 bg-black/40"
            style={{ animation: `hfc3-node-pulse 2s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </div>
      <div className="relative z-[1] max-w-[min(100%,48rem)] pt-28">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function W3Valve({ h1, h2, pillars }: HeroWave3Props) {
  return (
    <div className={shell}>
      <div className="pointer-events-none absolute right-[12%] top-[18%] h-28 w-28 opacity-50" aria-hidden>
        <div className="h-full w-full rounded-full border-2 border-white/15" style={{ animation: "hfc3-gear 6s linear infinite" }}>
          <div className="absolute left-1/2 top-1/2 h-[85%] w-1.5 -translate-x-1/2 -translate-y-1/2 bg-[#0066ff]/40" />
          <div className="absolute left-1/2 top-1/2 h-1.5 w-[85%] -translate-x-1/2 -translate-y-1/2 bg-[#0066ff]/40" />
        </div>
      </div>
      <div className="relative z-[1] max-w-[min(100%,48rem)] pr-16">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance pr-16 text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function W3Turbine({ h1, h2, pillars }: HeroWave3Props) {
  return (
    <div className={shell}>
      <svg className="pointer-events-none absolute left-1/2 top-[14%] h-40 w-40 -translate-x-1/2 opacity-50" viewBox="0 0 100 100" aria-hidden>
        <g style={{ transformOrigin: "50px 50px", animation: "hfc3-flywheel 2.2s linear infinite" }}>
          {[...Array(7)].map((_, i) => {
            const a = (i / 7) * Math.PI * 2;
            return (
              <path
                key={i}
                d={`M 50 50 L ${50 + Math.cos(a) * 42} ${50 + Math.sin(a) * 42} L ${50 + Math.cos(a + 0.35) * 18} ${50 + Math.sin(a + 0.35) * 18} Z`}
                fill="rgb(0 102 255 / 0.35)"
                stroke="rgb(0 160 255 / 0.4)"
                strokeWidth="0.3"
              />
            );
          })}
        </g>
      </svg>
      <div className="relative z-[1] max-w-[min(100%,48rem)] pt-36">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function W3Dipstick({ h1, h2, pillars }: HeroWave3Props) {
  return (
    <div className={shell}>
      <div className="pointer-events-none absolute left-[10%] top-[22%] flex h-44 w-8 flex-col items-center opacity-55" aria-hidden>
        <div className="h-full w-2 rounded-full bg-gradient-to-b from-white/25 to-white/5" />
        <div className="absolute bottom-[18%] left-1/2 w-3 -translate-x-1/2 rounded-sm bg-[#0066ff]/30" style={{ height: "42%", animation: "hfc3-fluid 3s ease-in-out infinite" }} />
      </div>
      <div className="relative z-[1] max-w-[min(100%,48rem)] pl-10">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance pl-10 text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

function W3Ecu({ h1, h2, pillars }: HeroWave3Props) {
  return (
    <div className={shell}>
      <div className="pointer-events-none absolute right-[8%] top-[20%] h-32 w-44 rounded-lg border border-[#0066ff]/30 bg-black/50 opacity-70 shadow-[0_0_30px_rgb(0_102_255/0.2)]" aria-hidden>
        <div className="grid grid-cols-12 gap-0.5 p-2">
          {Array.from({ length: 48 }).map((_, i) => (
            <div
              key={i}
              className="h-1 w-1 rounded-[1px] bg-[#0066ff]/40"
              style={{ animation: `hfc3-pin-blink ${1.2 + (i % 5) * 0.15}s ease-in-out infinite`, animationDelay: `${(i % 9) * 0.05}s` }}
            />
          ))}
        </div>
      </div>
      <div className="relative z-[1] max-w-[min(100%,48rem)] pr-12">{h1}</div>
      <p className="relative z-[1] mt-4 max-w-[min(100%,40rem)] text-balance pr-12 text-[clamp(0.95rem,2.8vw,1.2rem)] font-medium leading-snug text-white/65">
        {h2}
      </p>
      <PillarsRow titles={pillars} />
    </div>
  );
}

export function renderHeroConceptWave3(id: string, p: HeroWave3Props): ReactNode {
  switch (id) {
    case "iris":
      return <W3Iris {...p} />;
    case "retina":
      return <W3Retina {...p} />;
    case "pupil":
      return <W3Pupil {...p} />;
    case "pupiltrack":
      return <W3PupilTrack {...p} />;
    case "lensring":
      return <W3LensRing {...p} />;
    case "loupe":
      return <W3Loupe {...p} />;
    case "tesseract":
      return <W3Tesseract {...p} />;
    case "databeams":
      return <W3DataBeams {...p} />;
    case "databars":
      return <W3DataBars {...p} />;
    case "datastack":
      return <W3DataStack {...p} />;
    case "gearmesh":
      return <W3GearMesh {...p} />;
    case "rack":
      return <W3Rack {...p} />;
    case "piston":
      return <W3Piston {...p} />;
    case "linkage":
      return <W3Linkage {...p} />;
    case "flywheel":
      return <W3Flywheel {...p} />;
    case "spring":
      return <W3Spring {...p} />;
    case "odometer":
      return <W3Odometer {...p} />;
    case "trip":
      return <W3Trip {...p} />;
    case "speedo":
      return <W3Speedo {...p} />;
    case "redline":
      return <W3Redline {...p} />;
    case "meshnet":
      return <W3MeshNet {...p} />;
    case "synapse":
      return <W3Synapse {...p} />;
    case "neural":
      return <W3Neural {...p} />;
    case "quantum":
      return <W3Quantum {...p} />;
    case "bridge":
      return <W3Bridge {...p} />;
    case "chain":
      return <W3Chain {...p} />;
    case "valve":
      return <W3Valve {...p} />;
    case "turbine":
      return <W3Turbine {...p} />;
    case "dipstick":
      return <W3Dipstick {...p} />;
    case "ecu":
      return <W3Ecu {...p} />;
    default:
      return null;
  }
}
