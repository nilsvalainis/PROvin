"use client";

import "./production-lens-variants.css";
import { useId } from "react";
import { HANDLE_RAIL_A, HANDLE_RAIL_B } from "@/components/demo/lens-demo-shared";

function cardClass() {
  return "rounded-2xl border border-white/[0.1] bg-[#0a0b0f] p-4 sm:p-5";
}

const VARIANTS: { id: number; title: string; body: string }[] = [
  {
    id: 1,
    title: "V1 · Produkcijas atsauce",
    body: "Tās pašas krāsas un kontrasts kā `MarketingHero` ar `designDirection` — salīdzināšanas bāze.",
  },
  {
    id: 2,
    title: "V2 · Vēsais sudrabs",
    body: "Gaišāka loka gradienta mala, mīkstāks zils centrs — „aukstāka” stikla sajūta.",
  },
  {
    id: 3,
    title: "V3 · Dzeltens dzinēja tonis",
    body: "Siltāks centrs un dzeltens punkts — tuvāk diagnostikas / track displejam, bet tā pati lupas forma.",
  },
  {
    id: 4,
    title: "V4 · Ciānas neons",
    body: "Spēcīgāks spīdums uz punkta un ciāna iekšējā mala — nakts / HUD variants.",
  },
  {
    id: 5,
    title: "V5 · Augsts kontrasts",
    body: "Blīvāks zils disks un spilgtākas baltās kontūras — uz tumša fona maksimāli lasāms.",
  },
  {
    id: 6,
    title: "V6 · Disksēts, zems",
    body: "Samazināta kopējā opacity un atturīgs punkts — fona elements, ne centrālais akcents.",
  },
  {
    id: 7,
    title: "V7 · Divslīņu kāts",
    body: "Tā pati lēca, bet kāts kā divas paralēlas sliedes (ģeometrija kā `HANDLE_RAIL_*`).",
  },
  {
    id: 8,
    title: "V8 · Bez refleksa",
    body: "Noņemta baltā līkā „spīduma” līnija lēcā — minimālāks highlights.",
  },
  {
    id: 9,
    title: "V9 · Paplašināts punkts",
    body: "Lielāks zils punkts un garāks starojums — skrejošais akcents dominē vairāk nekā rāmī.",
  },
  {
    id: 10,
    title: "V10 · Matēts / plānas līnijas",
    body: "Plānākas kontūras un vājāks pildījums — tehnisks, „zīmējuma” raksturs.",
  },
];

function ProductionLensSvg({
  variant,
  uid,
  showMockText,
}: {
  variant: number;
  uid: string;
  showMockText: boolean;
}) {
  const gid = `${uid}-g`;
  const lid = `${uid}-lc`;
  const cid = `${uid}-cp`;
  const dualHandle = variant === 7;
  const dotR = variant === 9 ? 2.12 : 1.42;

  return (
    <>
      <svg className="lens-prod-var__svg" viewBox="0 0 112 112" xmlns="http://www.w3.org/2000/svg" fill="none" aria-hidden>
        <defs>
          <clipPath id={cid}>
            <circle cx="44" cy="44" r="25.4" />
          </clipPath>
          <radialGradient id={lid} cx="44" cy="44" r="23" gradientUnits="userSpaceOnUse">
            <stop offset="0%" className="lens-prod-var__stop-fill-0" stopOpacity="1" />
            <stop offset="40%" className="lens-prod-var__stop-fill-40" stopOpacity="1" />
            <stop offset="100%" className="lens-prod-var__stop-fill-100" stopOpacity="1" />
          </radialGradient>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" className="lens-prod-var__stop-rim-0" stopOpacity="1" />
            <stop offset="52%" className="lens-prod-var__stop-rim-52" stopOpacity="1" />
            <stop offset="100%" className="lens-prod-var__stop-rim-100" stopOpacity="1" />
          </linearGradient>
        </defs>
        <circle cx="44" cy="44" r="26" fill={`url(#${lid})`} clipPath={`url(#${cid})`} />
        <circle
          className="lens-prod-var__stroke-outer"
          cx="44"
          cy="44"
          r="26"
          fill="none"
          stroke={`url(#${gid})`}
          vectorEffect="non-scaling-stroke"
        />
        <circle className="lens-prod-var__stroke-inner" cx="44" cy="44" r="23.5" fill="none" vectorEffect="non-scaling-stroke" />
        <g transform="translate(44 44)">
          <g className="lens-prod-var__dot-orbit">
            <circle className="lens-prod-var__dot" cx="24.75" cy="0" r={dotR} />
          </g>
        </g>
        {variant !== 8 ? (
          <path
            className="lens-prod-var__glare-path"
            d="M 29 37 Q 44 31 59 37"
            fill="none"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {dualHandle ? (
          <>
            <path className="lens-prod-var__handle" d={HANDLE_RAIL_A} stroke={`url(#${gid})`} vectorEffect="non-scaling-stroke" />
            <path
              className="lens-prod-var__handle lens-prod-var__handle-b"
              d={HANDLE_RAIL_B}
              stroke={`url(#${gid})`}
              vectorEffect="non-scaling-stroke"
            />
          </>
        ) : (
          <path className="lens-prod-var__handle" d="M 64 64 L 83 83" stroke={`url(#${gid})`} vectorEffect="non-scaling-stroke" />
        )}
      </svg>
      {showMockText ? (
        <div className="lens-prod-var__mock-stack">
          <span className="lens-prod-var__mock-l1">VIN UN SLUDINĀJUMA</span>
          <span className="lens-prod-var__mock-l2">AUDITS</span>
        </div>
      ) : null}
    </>
  );
}

export function ProductionLensVariants() {
  const base = useId().replace(/:/g, "");

  return (
    <div className="mx-auto max-w-[min(72rem,calc(100vw-2rem))] pb-16 pt-6 text-white/90">
      <header className="mb-10 border-b border-white/[0.08] pb-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Demo · lupas stili</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white/95 sm:text-3xl">10 varianti produkcijas lupas dizainam</h1>
        <p className="mt-3 max-w-[50rem] text-[14px] leading-relaxed text-white/55">
          Tā pati <span className="font-mono text-[12px] text-white/40">viewBox 112×112</span> ģeometrija kā{" "}
          <span className="font-mono text-[12px] text-white/40">MarketingHero</span> siluetam — mainās krāsas, līniju biezums, kāta veids un
          spīdums. Mock teksts imitē <span className="font-mono text-white/45">lensLine1/2</span>; produkcijā paliek esošā implementācija.
        </p>
      </header>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {VARIANTS.map((v) => (
          <article key={v.id} id={`lupa-v${v.id}`} className={`${cardClass()} scroll-mt-28`}>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7eb6ff]">{v.title}</h2>
            <p className="mt-2 text-[12px] leading-relaxed text-white/50">{v.body}</p>
            <div className={`lens-prod-var__stage lens-prod-var--v${v.id} relative mx-auto mt-5`}>
              <ProductionLensSvg variant={v.id} uid={`${base}-p${v.id}`} showMockText />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
