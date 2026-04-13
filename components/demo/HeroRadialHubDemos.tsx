"use client";

import "./hero-radial-hub-demos.css";
import { useId } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const CX = 200;
const CY = 200;
const TOP = { x: 200, y: 48 };
const RIGHT = { x: 352, y: 200 };
const BOTTOM = { x: 200, y: 352 };
const LEFT = { x: 48, y: 200 };

/** Lauztas „sparkline” atzīmes uz katras ass (V4). */
function sparkPath(ax: "t" | "r" | "b" | "l"): string {
  switch (ax) {
    case "t":
      return `M ${CX} ${CY} L 208 175 L 192 150 L 210 120 L 188 95 L 200 ${TOP.y}`;
    case "r":
      return `M ${CX} ${CY} L 225 192 L 248 210 L 268 188 L 295 205 L ${RIGHT.x} ${RIGHT.y}`;
    case "b":
      return `M ${CX} ${CY} L 192 228 L 210 255 L 185 275 L 205 305 L 200 ${BOTTOM.y}`;
    case "l":
      return `M ${CX} ${CY} L 175 208 L 150 192 L 125 210 L 95 188 L ${LEFT.x} ${LEFT.y}`;
    default:
      return "";
  }
}

function hexPath(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    pts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return `${pts.join(" ")} Z`;
}

const VARIANT_INFO: { id: number; title: string; blurb: string }[] = [
  { id: 1, title: "V1 · Punktu globuss", blurb: "Kā atsauce uz orbitējošiem punktiem — smalks režģis, serifa tips, mijas pulsējošas līnijas." },
  { id: 2, title: "V2 · OBD pavedieni", blurb: "Termināļa zaļš, pārtrauktas līnijas ar skrejošu dash; „datu vadu” valoda." },
  { id: 3, title: "V3 · Tēmeklis centrā", blurb: "Sarkans krusts kā skenēšanas fokuss; balts savienojums ar mezgliem — diagnostikas dramaturģija." },
  { id: 4, title: "V4 · Sparkline zari", blurb: "Četri nobraukuma/līknes stila lauzti ceļi uz centru — grafiku metafora." },
  { id: 5, title: "V5 · Hex tīkls", blurb: "Mezgli kā šestūņi; zila tehniskā gamma — savienojuma topoloģija." },
  { id: 6, title: "V6 · Odometra ceļš", blurb: "Biezs pārtraukts „ceļš” un dzeltens tonis — nobraukuma / odometra atsauce." },
  { id: 7, title: "V7 · Blueprint", blurb: "Režģa fons un ciāna — shēmas / dokumentācijas sajūta." },
  { id: 8, title: "V8 · Luksusa minimālisms", blurb: "Matētas matētās līnijas, lēna elpošana — augstas klases melnbalts." },
  { id: 9, title: "V9 · Termiskā plūsma", blurb: "Silta gradienta līnijas un pulsācija — „karsto” datu plūsma." },
  { id: 10, title: "V10 · Daļiņu sinhrons", blurb: "Zili impulsi slīd pa līnijām uz mezgliem — sinhrona savienojuma ritms." },
];

type NodeCopy = { keyLine: string; subLine: string };

function HubSvg({
  variant,
  uid,
}: {
  variant: number;
  uid: string;
}) {
  const th = `${uid}-th`;

  const linesStandard = (
    <>
      <line className="hero-rad-hub__line" x1={CX} y1={CY} x2={TOP.x} y2={TOP.y} />
      <line className="hero-rad-hub__line" x1={CX} y1={CY} x2={RIGHT.x} y2={RIGHT.y} />
      <line className="hero-rad-hub__line" x1={CX} y1={CY} x2={BOTTOM.x} y2={BOTTOM.y} />
      <line className="hero-rad-hub__line" x1={CX} y1={CY} x2={LEFT.x} y2={LEFT.y} />
    </>
  );

  if (variant === 1) {
    return (
      <svg className="hero-rad-hub__svg" viewBox="0 0 400 400" fill="none" aria-hidden>
        <g className="hero-rad-hub__anim-pulse-line">
          <line className="hero-rad-hub__line-glow" x1={CX} y1={CY} x2={TOP.x} y2={TOP.y} />
          <line className="hero-rad-hub__line-glow" x1={CX} y1={CY} x2={RIGHT.x} y2={RIGHT.y} />
          <line className="hero-rad-hub__line-glow" x1={CX} y1={CY} x2={BOTTOM.x} y2={BOTTOM.y} />
          <line className="hero-rad-hub__line-glow" x1={CX} y1={CY} x2={LEFT.x} y2={LEFT.y} />
        </g>
        {linesStandard}
        <circle className="hero-rad-hub__node-ring" cx={TOP.x} cy={TOP.y} r="5" />
        <circle className="hero-rad-hub__node-ring" cx={RIGHT.x} cy={RIGHT.y} r="5" />
        <circle className="hero-rad-hub__node-ring" cx={BOTTOM.x} cy={BOTTOM.y} r="5" />
        <circle className="hero-rad-hub__node-ring" cx={LEFT.x} cy={LEFT.y} r="5" />
      </svg>
    );
  }

  if (variant === 2) {
    return (
      <svg className="hero-rad-hub__svg" viewBox="0 0 400 400" fill="none" aria-hidden>
        <g>
          <line className="hero-rad-hub__line-ghost" x1={CX} y1={CY} x2={TOP.x} y2={TOP.y} />
          <line className="hero-rad-hub__line-ghost" x1={CX} y1={CY} x2={RIGHT.x} y2={RIGHT.y} />
          <line className="hero-rad-hub__line-ghost" x1={CX} y1={CY} x2={BOTTOM.x} y2={BOTTOM.y} />
          <line className="hero-rad-hub__line-ghost" x1={CX} y1={CY} x2={LEFT.x} y2={LEFT.y} />
        </g>
        <line className="hero-rad-hub__line hero-rad-hub__anim-dash" x1={CX} y1={CY} x2={TOP.x} y2={TOP.y} pathLength="100" />
        <line className="hero-rad-hub__line hero-rad-hub__anim-dash" x1={CX} y1={CY} x2={RIGHT.x} y2={RIGHT.y} pathLength="100" />
        <line className="hero-rad-hub__line hero-rad-hub__anim-dash" x1={CX} y1={CY} x2={BOTTOM.x} y2={BOTTOM.y} pathLength="100" />
        <line className="hero-rad-hub__line hero-rad-hub__anim-dash" x1={CX} y1={CY} x2={LEFT.x} y2={LEFT.y} pathLength="100" />
      </svg>
    );
  }

  if (variant === 3) {
    return (
      <svg className="hero-rad-hub__svg" viewBox="0 0 400 400" fill="none" aria-hidden>
        {linesStandard}
        <g className="hero-rad-hub__anim-reticle" transform={`translate(${CX} ${CY})`}>
          <circle r="14" stroke="rgb(255 60 60 / 0.85)" strokeWidth={0.8} fill="none" vectorEffect="non-scaling-stroke" />
          <line x1="-18" y1="0" x2="18" y2="0" stroke="rgb(255 80 80 / 0.9)" strokeWidth={0.65} vectorEffect="non-scaling-stroke" />
          <line x1="0" y1="-18" x2="0" y2="18" stroke="rgb(255 80 80 / 0.9)" strokeWidth={0.65} vectorEffect="non-scaling-stroke" />
          <circle r="2.2" fill="rgb(255 90 90)" />
        </g>
      </svg>
    );
  }

  if (variant === 4) {
    return (
      <svg className="hero-rad-hub__svg" viewBox="0 0 400 400" fill="none" aria-hidden>
        <path className="hero-rad-hub__line hero-rad-hub__anim-dash" d={sparkPath("t")} pathLength="100" />
        <path className="hero-rad-hub__line hero-rad-hub__anim-dash" d={sparkPath("r")} pathLength="100" style={{ animationDelay: "-0.5s" }} />
        <path className="hero-rad-hub__line hero-rad-hub__anim-dash" d={sparkPath("b")} pathLength="100" style={{ animationDelay: "-1s" }} />
        <path className="hero-rad-hub__line hero-rad-hub__anim-dash" d={sparkPath("l")} pathLength="100" style={{ animationDelay: "-1.5s" }} />
      </svg>
    );
  }

  if (variant === 5) {
    const r = 12;
    return (
      <svg className="hero-rad-hub__svg" viewBox="0 0 400 400" fill="none" aria-hidden>
        <g className="hero-rad-hub__anim-hex">{linesStandard}</g>
        <path d={hexPath(TOP.x, TOP.y, r)} className="hero-rad-hub__line" fill="rgb(0 100 255 / 0.08)" stroke="rgb(120 180 255 / 0.55)" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
        <path d={hexPath(RIGHT.x, RIGHT.y, r)} className="hero-rad-hub__line" fill="rgb(0 100 255 / 0.08)" stroke="rgb(120 180 255 / 0.55)" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
        <path d={hexPath(BOTTOM.x, BOTTOM.y, r)} className="hero-rad-hub__line" fill="rgb(0 100 255 / 0.08)" stroke="rgb(120 180 255 / 0.55)" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
        <path d={hexPath(LEFT.x, LEFT.y, r)} className="hero-rad-hub__line" fill="rgb(0 100 255 / 0.08)" stroke="rgb(120 180 255 / 0.55)" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }

  if (variant === 6) {
    return (
      <svg className="hero-rad-hub__svg" viewBox="0 0 400 400" fill="none" aria-hidden>
        <line className="hero-rad-hub__line hero-rad-hub__anim-dash" x1={CX} y1={CY} x2={TOP.x} y2={TOP.y} pathLength="100" />
        <line className="hero-rad-hub__line hero-rad-hub__anim-dash" x1={CX} y1={CY} x2={RIGHT.x} y2={RIGHT.y} pathLength="100" />
        <line className="hero-rad-hub__line hero-rad-hub__anim-dash" x1={CX} y1={CY} x2={BOTTOM.x} y2={BOTTOM.y} pathLength="100" />
        <line className="hero-rad-hub__line hero-rad-hub__anim-dash" x1={CX} y1={CY} x2={LEFT.x} y2={LEFT.y} pathLength="100" />
      </svg>
    );
  }

  if (variant === 7) {
    return (
      <svg className="hero-rad-hub__svg" viewBox="0 0 400 400" fill="none" aria-hidden>
        {linesStandard}
      </svg>
    );
  }

  if (variant === 8) {
    return (
      <svg className="hero-rad-hub__svg" viewBox="0 0 400 400" fill="none" aria-hidden>
        <g className="hero-rad-hub__anim-minimal">
          <line className="hero-rad-hub__line" x1={CX} y1={CY} x2={TOP.x} y2={TOP.y} />
          <line className="hero-rad-hub__line" x1={CX} y1={CY} x2={RIGHT.x} y2={RIGHT.y} />
          <line className="hero-rad-hub__line" x1={CX} y1={CY} x2={BOTTOM.x} y2={BOTTOM.y} />
          <line className="hero-rad-hub__line" x1={CX} y1={CY} x2={LEFT.x} y2={LEFT.y} />
        </g>
      </svg>
    );
  }

  if (variant === 9) {
    return (
      <svg className="hero-rad-hub__svg" viewBox="0 0 400 400" fill="none" aria-hidden>
        <defs>
          <linearGradient id={th} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(255 200 80)" stopOpacity="0.9" />
            <stop offset="50%" stopColor="rgb(255 80 40)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="rgb(255 40 20)" stopOpacity="0.85" />
          </linearGradient>
        </defs>
        <g className="hero-rad-hub__anim-thermal">
          <line stroke={`url(#${th})`} strokeWidth={1.4} vectorEffect="non-scaling-stroke" x1={CX} y1={CY} x2={TOP.x} y2={TOP.y} />
          <line stroke={`url(#${th})`} strokeWidth={1.4} vectorEffect="non-scaling-stroke" x1={CX} y1={CY} x2={RIGHT.x} y2={RIGHT.y} />
          <line stroke={`url(#${th})`} strokeWidth={1.4} vectorEffect="non-scaling-stroke" x1={CX} y1={CY} x2={BOTTOM.x} y2={BOTTOM.y} />
          <line stroke={`url(#${th})`} strokeWidth={1.4} vectorEffect="non-scaling-stroke" x1={CX} y1={CY} x2={LEFT.x} y2={LEFT.y} />
        </g>
      </svg>
    );
  }

  /* V10 */
  return (
    <svg className="hero-rad-hub__svg" viewBox="0 0 400 400" fill="none" aria-hidden>
      <line className="hero-rad-hub__line" x1={CX} y1={CY} x2={TOP.x} y2={TOP.y} />
      <line className="hero-rad-hub__line" x1={CX} y1={CY} x2={RIGHT.x} y2={RIGHT.y} />
      <line className="hero-rad-hub__line" x1={CX} y1={CY} x2={BOTTOM.x} y2={BOTTOM.y} />
      <line className="hero-rad-hub__line" x1={CX} y1={CY} x2={LEFT.x} y2={LEFT.y} />
      <g transform={`translate(${CX} ${CY})`}>
        <circle r="2.8" fill="rgb(0 150 255)" className="hero-rad-hub__particle">
          <animateMotion dur="2.6s" repeatCount="indefinite" path={`M 0 0 L ${TOP.x - CX} ${TOP.y - CY}`} />
        </circle>
        <circle r="2.8" fill="rgb(0 180 255)" className="hero-rad-hub__particle">
          <animateMotion dur="2.6s" begin="-0.65s" repeatCount="indefinite" path={`M 0 0 L ${RIGHT.x - CX} ${RIGHT.y - CY}`} />
        </circle>
        <circle r="2.8" fill="rgb(100 200 255)" className="hero-rad-hub__particle">
          <animateMotion dur="2.6s" begin="-1.3s" repeatCount="indefinite" path={`M 0 0 L ${BOTTOM.x - CX} ${BOTTOM.y - CY}`} />
        </circle>
        <circle r="2.8" fill="rgb(0 130 255)" className="hero-rad-hub__particle">
          <animateMotion dur="2.6s" begin="-1.95s" repeatCount="indefinite" path={`M 0 0 L ${LEFT.x - CX} ${LEFT.y - CY}`} />
        </circle>
      </g>
    </svg>
  );
}

function RadialSection({
  variant,
  uid,
  nodes,
  approved,
  lens1,
  lens2,
}: {
  variant: number;
  uid: string;
  nodes: NodeCopy[];
  approved: string;
  lens1: string;
  lens2: string;
}) {
  const info = VARIANT_INFO[variant - 1];
  const pos: ("t" | "r" | "b" | "l")[] = ["t", "r", "b", "l"];

  return (
    <section id={`hrh-v${variant}`} className={`hero-rad-hub hero-rad-hub--v${variant} scroll-mt-24 border-b border-white/[0.06]`}>
      <div className="mx-auto max-w-[min(52rem,calc(100vw-2rem))] px-4 pb-3 pt-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7eb6ff]/90">{info.title}</p>
        <p className="mt-1.5 max-w-[40rem] text-[12px] leading-relaxed text-white/48">{info.blurb}</p>
      </div>
      <div className="relative mx-auto max-w-[min(56rem,calc(100vw-1rem))] px-3 pb-16 pt-4">
        <HubSvg variant={variant} uid={uid} />
        <div className="hero-rad-hub__center">
          <p className="hero-rad-hub__kicker">{approved}</p>
          <h1 className="hero-rad-hub__h1">
            {lens1}
            <span className="hero-rad-hub__h1-sub block">{lens2}</span>
          </h1>
          <p className="hero-rad-hub__tag">Auto vēstures pārbaude · dati · savienojums</p>
        </div>
        {nodes.map((n, i) => (
          <div key={pos[i]} className={`hero-rad-hub__node hero-rad-hub__node--${pos[i]}`}>
            <p className="hero-rad-hub__node-k">{n.keyLine}</p>
            <p className="hero-rad-hub__node-s">{n.subLine}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function HeroRadialHubDemos() {
  const uid = useId().replace(/:/g, "");
  const t = useTranslations("Hero");
  const lens1 = t("lensLine1");
  const lens2 = t("lensLine2");
  const approved = t("approved");
  const raw = t.raw("pillars") as { title: string }[];

  const nodes: NodeCopy[] = [
    { keyLine: "VIN · avoti", subLine: raw[0]?.title?.replace(/\n/g, " ") ?? "2–4 atskaites" },
    { keyLine: "Apkopojums", subLine: raw[1]?.title?.replace(/\n/g, " ") ?? "Sludinājuma analīze" },
    { keyLine: "Nobraukums · odometrs", subLine: raw[2]?.title?.replace(/\n/g, " ") ?? "Risku analīze" },
    { keyLine: "Dati · savienojums", subLine: raw[3]?.title?.replace(/\n/g, " ") ?? "Konsultācija" },
  ];

  return (
    <div className="bg-[#020203] text-white">
      <header className="mx-auto max-w-[min(52rem,calc(100vw-2rem))] border-b border-white/[0.08] px-4 pb-10 pt-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">Demo · hero tīkls</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white/95 sm:text-3xl">10 radiaļu / tīkla hero scenāriji</h1>
        <p className="mt-3 max-w-[48rem] text-[14px] leading-relaxed text-white/55">
          Centrā — <span className="text-white/75">Approved by IRISS</span> un virsraksts kā uz mājas hero; apkārt četri mezgli ar VIN, apkopojumu, nobraukumu/odometru un datu savienojumu. Katrs variants citādāks vizuālais valodas ieraksts (tikai demo, produkcija nemainīta).
        </p>
        <p className="mt-4 text-[12px] text-white/40">
          Atslēgvārdi: nobraukums, odometrs, apkopojums, savienojums, avoti, auto vēstures pārbaude, dati.
        </p>
      </header>

      {VARIANT_INFO.map((v) => (
        <RadialSection key={v.id} variant={v.id} uid={`${uid}-v${v.id}`} nodes={nodes} approved={approved} lens1={lens1} lens2={lens2} />
      ))}

      <p className="py-12 text-center text-[11px] text-white/35">
        <Link href="/demo/hero-variants" className="text-[#7eb6ff]/80 hover:text-[#7eb6ff] hover:underline">
          Hero orbit varianti
        </Link>
        <span className="mx-2 text-white/20">·</span>
        <Link href="/demo" className="text-white/45 hover:text-white/65">
          Demo studija
        </Link>
      </p>
    </div>
  );
}
