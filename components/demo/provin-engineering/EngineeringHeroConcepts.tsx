"use client";

import type { MotionValue } from "framer-motion";
import { useMemo, useRef } from "react";
import { motion, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";
import { FileText, Globe2, MessageCircle, TriangleAlert } from "lucide-react";
import { buildIrissThreadPath } from "@/lib/iriss-thread";
import type { EngineeringConceptMeta, EngineeringHeroContent } from "@/components/demo/provin-engineering/engineeringContent";
import "./provin-engineering.css";

const PILLAR_ICONS = [FileText, Globe2, TriangleAlert, MessageCircle] as const;

const shell = "pe-motion-root relative min-h-[min(88vh,56rem)] overflow-hidden px-4 py-14 sm:px-8";

function PillarsBlock({
  pillars,
  variant = "default",
}: {
  pillars: string[];
  variant?: "default" | "line";
}) {
  return (
    <div className="mt-10 grid w-full max-w-[56rem] grid-cols-2 gap-3 sm:grid-cols-4">
      {pillars.map((title, i) => {
        const Icon = PILLAR_ICONS[i] ?? FileText;
        return (
          <motion.div
            key={title}
            initial={variant === "default" ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: i * 0.08 }}
            className={
              variant === "line"
                ? "flex flex-col items-center gap-2 border border-white/10 bg-transparent px-2 py-3 text-center"
                : "rounded-xl border border-white/[0.1] bg-white/[0.03] px-2 py-3 text-center"
            }
          >
            <Icon className="mx-auto h-7 w-7 text-[#0066ff] [stroke-width:1.25]" strokeWidth={1.25} />
            <p className="whitespace-pre-line text-[8px] font-semibold uppercase leading-tight tracking-tight text-white/80 sm:text-[9px]">
              {title}
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}

function PillarsGauge({ pillars, scrollRotate }: { pillars: string[]; scrollRotate: MotionValue<number> }) {
  return (
    <div className="mt-10 grid w-full max-w-[56rem] grid-cols-2 gap-3 sm:grid-cols-4">
      {pillars.map((title, i) => {
        const Icon = PILLAR_ICONS[i] ?? FileText;
        return (
          <div
            key={title}
            className="relative flex flex-col items-center gap-2 overflow-hidden rounded-xl border border-white/[0.12] bg-white/[0.02] px-2 py-4 text-center"
          >
            <svg className="pointer-events-none absolute inset-x-2 top-1 h-10 w-[calc(100%-1rem)] overflow-visible" viewBox="0 0 100 36" aria-hidden>
              <path d="M 8 32 A 42 42 0 0 1 92 32" fill="none" stroke="rgb(192 192 192 / 0.35)" strokeWidth="0.45" />
              <motion.path
                d="M 8 32 A 42 42 0 0 1 92 32"
                fill="none"
                stroke="rgb(0 102 255 / 0.55)"
                strokeWidth="0.55"
                strokeDasharray="3 5"
                style={{ rotate: scrollRotate, transformOrigin: "50px 32px" }}
              />
            </svg>
            <Icon className="relative z-[1] mt-2 h-7 w-7 text-[#0066ff] [stroke-width:1.25]" strokeWidth={1.25} />
            <p className="whitespace-pre-line text-[8px] font-semibold uppercase leading-tight text-white/80 sm:text-[9px]">{title}</p>
          </div>
        );
      })}
    </div>
  );
}

function MetallicH1({ line1, auditWord, className = "" }: { line1: string; auditWord: string; className?: string }) {
  return (
    <h1 className={`pe-metallic-title max-w-[min(100%,48rem)] text-balance text-[clamp(1.2rem,4vw+0.2rem,2.4rem)] font-semibold leading-[1.05] tracking-[-0.03em] ${className}`}>
      <span className="block text-[0.38em] font-medium uppercase tracking-[0.26em] text-white/50">{line1}</span>
      <span className="mt-1 block">{auditWord}</span>
    </h1>
  );
}

function C01EnergyCore({ c }: { c: EngineeringHeroContent }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const needle = useTransform(scrollYProgress, [0, 1], [-58, 42]);
  return (
    <div ref={ref} className={`${shell} pe-bg-dark-engine flex flex-col items-center justify-center text-center`}>
      <div className="relative flex flex-col items-center">
        <motion.div
          className="relative z-[2] flex h-44 w-44 items-center justify-center sm:h-52 sm:w-52"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <svg viewBox="0 0 120 120" className="h-full w-full drop-shadow-[0_0_28px_rgb(0_102_255/0.35)]" aria-hidden>
            <circle cx="60" cy="60" r="54" fill="none" stroke="rgb(192 192 192 / 0.15)" strokeWidth="1" />
            <circle cx="60" cy="60" r="46" fill="none" stroke="rgb(0 102 255 / 0.35)" strokeWidth="1.2" />
            <motion.line
              x1="60"
              y1="60"
              x2="60"
              y2="22"
              stroke="rgb(255 120 100 / 0.95)"
              strokeWidth="2"
              strokeLinecap="round"
              style={{ rotate: needle, transformOrigin: "60px 60px" }}
            />
            <text x="60" y="112" textAnchor="middle" className="fill-[7px] font-mono fill-white/35">
              CORE
            </text>
          </svg>
        </motion.div>
        <div className="relative z-[1] -mt-10 max-w-[min(100%,46rem)]">
          <h1 className="text-balance text-[clamp(1.1rem,3.8vw,2.1rem)] font-semibold leading-[1.06] tracking-[-0.03em] text-white/95">
            <span className="block text-[0.4em] font-medium uppercase tracking-[0.24em] text-white/45">{c.line1}</span>
            <span className="mt-1 block bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">{c.auditWord}</span>
          </h1>
        </div>
      </div>
      <p className="mt-5 max-w-[40rem] text-[clamp(0.95rem,2.5vw,1.15rem)] leading-relaxed text-white/55">{c.subtitle}</p>
      <PillarsBlock pillars={c.pillars} />
    </div>
  );
}

function C02TechnicalGrid({ c }: { c: EngineeringHeroContent }) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const gridX = useSpring(useTransform(mx, [-0.5, 0.5], [18, -18]), { stiffness: 120, damping: 20 });
  const gridY = useSpring(useTransform(my, [-0.5, 0.5], [12, -12]), { stiffness: 120, damping: 20 });
  const coreX = useSpring(useTransform(mx, [-0.5, 0.5], [-10, 10]), { stiffness: 120, damping: 20 });
  const coreY = useSpring(useTransform(my, [-0.5, 0.5], [-8, 8]), { stiffness: 120, damping: 20 });
  const titleX = useSpring(useTransform(mx, [-0.5, 0.5], [4, -4]), { stiffness: 200, damping: 25 });
  const titleY = useSpring(useTransform(my, [-0.5, 0.5], [3, -3]), { stiffness: 200, damping: 25 });
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  return (
    <div className={`${shell} pe-bg-dark-engine`} onMouseMove={onMove} onMouseLeave={() => { mx.set(0); my.set(0); }}>
      <motion.div className="pointer-events-none absolute inset-0 pe-grid-fine opacity-[0.12]" style={{ x: gridX, y: gridY }} />
      <div className="relative z-[1] mx-auto flex max-w-3xl flex-col items-center text-center">
        <motion.div style={{ x: coreX, y: coreY }} className="mb-6 h-24 w-24 rounded-full border border-[#0066ff]/30 shadow-[0_0_60px_rgb(0_102_255/0.25)]" />
        <motion.div style={{ x: titleX, y: titleY }}>
          <MetallicH1 line1={c.line1} auditWord={c.auditWord} />
        </motion.div>
        <motion.p style={{ x: titleX, y: titleY }} className="mt-4 max-w-xl text-white/60">
          {c.subtitle}
        </motion.p>
        <PillarsBlock pillars={c.pillars} />
      </div>
    </div>
  );
}

function C03KineticAssembly({ c }: { c: EngineeringHeroContent }) {
  const pathD = useMemo(() => buildIrissThreadPath(400, 280), []);
  return (
    <div className={`${shell} pe-bg-dark-engine flex flex-col items-center justify-center`}>
      <svg className="mb-6 h-[200px] w-full max-w-lg" viewBox="0 0 400 280" aria-hidden>
        <motion.path
          d={pathD}
          fill="none"
          stroke="rgb(0 102 255 / 0.55)"
          strokeWidth="1.2"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.8, ease: "easeInOut" }}
        />
      </svg>
      <MetallicH1 line1={c.line1} auditWord={c.auditWord} />
      <p className="mt-4 max-w-xl text-center text-white/58">{c.subtitle}</p>
      <PillarsBlock pillars={c.pillars} />
    </div>
  );
}

function C04MetallicType({ c }: { c: EngineeringHeroContent }) {
  return (
    <div className={`${shell} pe-bg-dark-engine flex flex-col items-center justify-center text-center`}>
      <MetallicH1 line1={c.line1} auditWord={c.auditWord} />
      <p className="mt-5 max-w-xl text-white/58">{c.subtitle}</p>
      <PillarsBlock pillars={c.pillars} />
    </div>
  );
}

function C05GaugeOrbit({ c }: { c: EngineeringHeroContent }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const sr = useTransform(scrollYProgress, [0, 1], [0, 360]);
  return (
    <div ref={ref} className={`${shell} pe-bg-dark-engine flex flex-col items-center justify-center text-center`}>
      <MetallicH1 line1={c.line1} auditWord={c.auditWord} />
      <p className="mt-4 max-w-xl text-white/58">{c.subtitle}</p>
      <PillarsGauge pillars={c.pillars} scrollRotate={sr} />
    </div>
  );
}

function C06GlassDashboard({ c }: { c: EngineeringHeroContent }) {
  return (
    <div className={`${shell} pe-bg-dark-engine flex flex-col items-center justify-center`}>
      <div className="pe-blue-glow-deep relative w-full max-w-3xl rounded-2xl pe-glass-panel px-6 py-10 sm:px-10 sm:py-12">
        <h1 className="text-balance text-center text-[clamp(1.15rem,3.6vw,2rem)] font-semibold text-white/95">
          <span className="block text-[0.38em] font-medium uppercase tracking-[0.22em] text-white/45">{c.line1}</span>
          <span className="mt-1 block text-white">{c.auditWord}</span>
        </h1>
        <p className="mt-5 text-center text-white/58">{c.subtitle}</p>
        <PillarsBlock pillars={c.pillars} />
      </div>
    </div>
  );
}

function C07LiquidGlass({ c }: { c: EngineeringHeroContent }) {
  return (
    <div className={`${shell} pe-bg-dark-engine flex flex-col items-center`}>
      <svg className="mb-4 h-32 w-full max-w-xl opacity-70" viewBox="0 0 400 80" fill="none" aria-hidden>
        <path d="M 20 40 Q 100 10 200 40 T 380 40" stroke="rgb(200 210 230 / 0.35)" strokeWidth="6" strokeLinecap="round" />
        <path d="M 20 40 Q 100 10 200 40 T 380 40" stroke="rgb(0 102 255 / 0.45)" strokeWidth="2" />
        <circle r="4" fill="rgb(0 150 255)" filter="blur(2px)">
          <animateMotion dur="3s" repeatCount="indefinite" path="M 20 40 Q 100 10 200 40 T 380 40" />
        </circle>
      </svg>
      <div className="pe-glass-panel w-full max-w-3xl rounded-2xl px-6 py-8 text-center">
        <MetallicH1 line1={c.line1} auditWord={c.auditWord} />
        <p className="mt-4 text-white/58">{c.subtitle}</p>
        <PillarsBlock pillars={c.pillars} />
      </div>
    </div>
  );
}

function C08ReflectionPanel({ c }: { c: EngineeringHeroContent }) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const titleX = useSpring(useTransform(mx, [-0.5, 0.5], [5, -5]), { stiffness: 200, damping: 22 });
  const titleY = useSpring(useTransform(my, [-0.5, 0.5], [4, -4]), { stiffness: 200, damping: 22 });
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const subY = useSpring(useTransform(scrollYProgress, [0, 1], [0, -20]), { stiffness: 80, damping: 18 });
  const pilY = useSpring(useTransform(scrollYProgress, [0, 1], [0, 14]), { stiffness: 90, damping: 20 });
  return (
    <div
      ref={ref}
      className={`${shell} pe-bg-dark-engine flex flex-col items-center`}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width - 0.5);
        my.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onMouseLeave={() => {
        mx.set(0);
        my.set(0);
      }}
    >
      <motion.div style={{ x: titleX, y: titleY }} className="text-center">
        <MetallicH1 line1={c.line1} auditWord={c.auditWord} />
      </motion.div>
      <motion.div style={{ y: subY }} className="mt-4 max-w-xl text-center text-white/55">
        {c.subtitle}
      </motion.div>
      <motion.div style={{ y: pilY }} className="w-full">
        <PillarsBlock pillars={c.pillars} />
      </motion.div>
    </div>
  );
}

function C09EtchedPillars({ c }: { c: EngineeringHeroContent }) {
  return (
    <div className={`${shell} pe-bg-dark-engine flex flex-col items-center text-center`}>
      <MetallicH1 line1={c.line1} auditWord={c.auditWord} />
      <p className="mt-4 max-w-xl text-white/58">{c.subtitle}</p>
      <PillarsBlock pillars={c.pillars} variant="line" />
    </div>
  );
}

function C10DeepFocus({ c }: { c: EngineeringHeroContent }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const rotateA = useTransform(scrollYProgress, [0, 1], [0, 220]);
  const rotateB = useTransform(scrollYProgress, [0, 1], [0, -180]);
  return (
    <div ref={ref} className={`${shell} pe-bg-dark-engine flex flex-col items-center justify-center`}>
      <div className="relative flex items-center justify-center py-8">
        <motion.div className="pointer-events-none absolute h-64 w-64 rounded-full border border-white/10" style={{ rotate: rotateA }} />
        <motion.div className="pointer-events-none absolute h-48 w-72 rounded-[50%] border border-[#0066ff]/25" style={{ rotate: rotateB }} />
        <div className="relative z-[1] text-center">
          <MetallicH1 line1={c.line1} auditWord={c.auditWord} />
        </div>
      </div>
      <p className="max-w-xl text-white/58">{c.subtitle}</p>
      <PillarsBlock pillars={c.pillars} />
    </div>
  );
}

function C11SequentialUnroll({ c }: { c: EngineeringHeroContent }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const o1 = useTransform(scrollYProgress, [0, 0.2, 0.35], [0, 0.3, 1]);
  const o2 = useTransform(scrollYProgress, [0.15, 0.4, 0.55], [0, 0.4, 1]);
  const o3 = useTransform(scrollYProgress, [0.35, 0.65, 0.9], [0, 0.5, 1]);
  return (
    <div ref={ref} className={`${shell} pe-bg-dark-engine`}>
      <div className="mx-auto flex max-w-3xl flex-col items-center">
        <svg className="h-40 w-full text-[#0066ff]/40" viewBox="0 0 400 200" aria-hidden>
          <path d={buildIrissThreadPath(400, 200)} fill="none" stroke="currentColor" strokeWidth="1" />
        </svg>
        <motion.div style={{ opacity: o1 }} className="text-center">
          <MetallicH1 line1={c.line1} auditWord={c.auditWord} />
        </motion.div>
        <motion.p style={{ opacity: o2 }} className="mt-4 max-w-xl text-center text-white/58">
          {c.subtitle}
        </motion.p>
        <motion.div style={{ opacity: o3 }} className="w-full">
          <PillarsBlock pillars={c.pillars} />
        </motion.div>
      </div>
    </div>
  );
}

function C12HazyFocus({ c }: { c: EngineeringHeroContent }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const op1 = useTransform(scrollYProgress, [0, 0.33, 0.66], [0.42, 1, 0.42]);
  const bl1 = useTransform(scrollYProgress, [0, 0.33, 0.66], [6, 0, 6]);
  const op2 = useTransform(scrollYProgress, [0.2, 0.5, 0.8], [0.48, 1, 0.48]);
  const bl2 = useTransform(scrollYProgress, [0.2, 0.5, 0.8], [6, 0, 6]);
  const op3 = useTransform(scrollYProgress, [0.5, 0.85], [0.38, 1]);
  const filter1 = useTransform(bl1, (b) => `blur(${b}px)`);
  const filter2 = useTransform(bl2, (b) => `blur(${b}px)`);
  return (
    <div ref={ref} className={`${shell} flex flex-col gap-6`}>
      <motion.section style={{ opacity: op1, filter: filter1 }} className="rounded-2xl border border-white/[0.06] px-4 py-8 text-center">
        <MetallicH1 line1={c.line1} auditWord={c.auditWord} />
      </motion.section>
      <motion.section style={{ opacity: op2, filter: filter2 }} className="rounded-2xl border border-white/[0.06] px-4 py-6 text-center text-white/65">
        {c.subtitle}
      </motion.section>
      <motion.section style={{ opacity: op3 }} className="pb-8">
        <PillarsBlock pillars={c.pillars} />
      </motion.section>
    </div>
  );
}

function C13Blueprint({ c }: { c: EngineeringHeroContent }) {
  return (
    <div className={`${shell} bg-[#06080c] pe-grid-fine`}>
      <div className="relative mx-auto max-w-3xl border border-white/15 bg-white/[0.02] px-6 py-10 pe-blueprint-plus">
        <span className="absolute left-2 top-2 font-mono text-[9px] text-white/25">X0 Y0</span>
        <MetallicH1 line1={c.line1} auditWord={c.auditWord} />
        <p className="mt-4 border-b border-white/10 pb-2 text-white/55">{c.subtitle}</p>
        <PillarsBlock pillars={c.pillars} variant="line" />
      </div>
    </div>
  );
}

function C14MorphingCore({ c }: { c: EngineeringHeroContent }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const x1 = useTransform(scrollYProgress, [0, 1], ["0%", "8%"]);
  const y1 = useTransform(scrollYProgress, [0, 1], ["0%", "-5%"]);
  const sc = useTransform(scrollYProgress, [0, 1], [1, 1.15]);
  return (
    <div ref={ref} className={`${shell} relative overflow-hidden`}>
      <motion.div
        className="pointer-events-none absolute -left-1/4 top-0 h-[120%] w-[80%] rounded-full bg-[radial-gradient(ellipse_at_center,rgb(0_102_255/0.25),transparent_55%)] blur-3xl"
        style={{ x: x1, y: y1 }}
      />
      <motion.div
        className="pointer-events-none absolute -right-1/4 bottom-0 h-[90%] w-[70%] rounded-full bg-[radial-gradient(ellipse_at_center,rgb(200_210_230/0.12),transparent_60%)] blur-3xl"
        style={{ scale: sc }}
      />
      <div className="relative z-[1] mx-auto flex max-w-3xl flex-col items-center text-center">
        <MetallicH1 line1={c.line1} auditWord={c.auditWord} />
        <p className="mt-4 text-white/58">{c.subtitle}</p>
        <PillarsBlock pillars={c.pillars} />
      </div>
    </div>
  );
}

function C15AssemblyLine({ c }: { c: EngineeringHeroContent }) {
  return (
    <div className={`${shell} pe-bg-dark-engine`}>
      <MetallicH1 line1={c.line1} auditWord={c.auditWord} />
      <p className="mx-auto mt-4 max-w-xl text-center text-white/58">{c.subtitle}</p>
      <div className="mt-10 grid w-full max-w-[56rem] grid-cols-2 gap-3 sm:grid-cols-4">
        {c.pillars.map((title, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, scale: 0.92 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ type: "spring", stiffness: 420, damping: 22, delay: i * 0.15 }}
            className="rounded-xl border border-white/10 px-2 py-4 text-center"
          >
            <p className="mb-2 font-mono text-[8px] uppercase tracking-wider text-[#0066ff]/70">{`MODULE_${String.fromCharCode(65 + i)}_SYNC`}</p>
            <p className="whitespace-pre-line text-[8px] font-semibold uppercase text-white/80 sm:text-[9px]">{title}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function C16SilverSpec({ c }: { c: EngineeringHeroContent }) {
  return (
    <div className={`${shell} bg-[#e5e7eb] text-[#0a0a0a]`}>
      <h1 className="pe-metallic-title max-w-2xl text-center text-[clamp(1.2rem,3.5vw,2rem)] font-semibold">
        <span className="block text-[0.38em] font-medium uppercase tracking-[0.2em] text-[#374151]">{c.line1}</span>
        <span className="mt-1 block text-[#111827]">{c.auditWord}</span>
      </h1>
      <p className="mt-5 max-w-xl border-b border-[#050505] pb-3 text-center text-[#374151]">{c.subtitle}</p>
      <div className="mt-8 grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
        {c.pillars.map((t) => (
          <div key={t} className="border-b border-[#050505] px-2 py-3 text-center text-[9px] font-semibold uppercase text-[#111827]">
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}

function C17NegativeBlueprint({ c }: { c: EngineeringHeroContent }) {
  return (
    <div className={`${shell} bg-white text-[#111]`}>
      <div className="pointer-events-none absolute inset-0 pe-grid-fine opacity-[0.14]" />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="relative z-[1] mx-auto max-w-3xl text-center">
        <h1 className="text-[clamp(1.2rem,3.5vw,2rem)] font-semibold text-[#0f172a]">
          <span className="block text-[0.38em] font-medium uppercase tracking-[0.2em] text-[#64748b]">{c.line1}</span>
          <span className="mt-1 block">{c.auditWord}</span>
        </h1>
        <p className="mt-4 text-[#475569]">{c.subtitle}</p>
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {c.pillars.map((title, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 + i * 0.1 }}
              className="rounded border border-[#cbd5e1] px-2 py-3 text-[9px] font-semibold uppercase text-[#334155]"
            >
              {title}
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

function C18LiquidTitanium({ c }: { c: EngineeringHeroContent }) {
  return (
    <div className={`${shell} bg-gradient-to-br from-[#c8ccd4] via-[#9ca3af] to-[#6b7280] text-[#0c0c0c]`}>
      <div className="pointer-events-none absolute inset-0 pe-grid-fine opacity-25 mix-blend-multiply" />
      <div className="relative z-[1] mx-auto max-w-3xl text-center">
        <h1 className="text-[clamp(1.2rem,3.5vw,2rem)] font-semibold tracking-tight drop-shadow-sm">
          <span className="block text-[0.38em] uppercase tracking-[0.22em] text-[#374151]">{c.line1}</span>
          <span className="mt-1 block">{c.auditWord}</span>
        </h1>
        <p className="mt-4 text-[#1f2937]">{c.subtitle}</p>
        <PillarsBlock pillars={c.pillars} />
      </div>
    </div>
  );
}

function C19SynthesisRings({ c }: { c: EngineeringHeroContent }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const rotateA = useTransform(scrollYProgress, [0, 1], [0, 220]);
  const rotateB = useTransform(scrollYProgress, [0, 1], [0, -180]);
  const sc = useTransform(scrollYProgress, [0, 1], [0.9, 1.08]);
  return (
    <div ref={ref} className={`${shell} relative bg-gradient-to-b from-[#0a0c10] to-[#020308]`}>
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[min(90vw,28rem)] w-[min(90vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#0066ff]/20"
        style={{ scale: sc }}
      />
      <motion.div className="pointer-events-none absolute left-1/2 top-1/2 h-[min(70vw,22rem)] w-[min(70vw,22rem)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" style={{ rotate: rotateB }} />
      <motion.div className="pointer-events-none absolute left-1/2 top-1/2 h-[min(50vw,16rem)] w-[min(50vw,16rem)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#0066ff]/10" style={{ rotate: rotateA }} />
      <div className="relative z-[1] mx-auto flex max-w-3xl flex-col items-center text-center">
        <MetallicH1 line1={c.line1} auditWord={c.auditWord} />
        <p className="mt-4 text-white/58">{c.subtitle}</p>
        <PillarsBlock pillars={c.pillars} />
      </div>
    </div>
  );
}

function C20DataMatrix({ c }: { c: EngineeringHeroContent }) {
  return (
    <div className={`${shell} bg-white text-[#0f172a]`}>
      <div className="pointer-events-none absolute inset-0 pe-grid-fine opacity-[0.2]" />
      <div className="pointer-events-none absolute inset-8 font-mono text-[8px] leading-relaxed text-[#94a3b8]/60">
        {Array.from({ length: 6 }).map((_, r) => (
          <div key={r} className="flex gap-6">
            {Array.from({ length: 10 }).map((__, col) => (
              <span key={col}>{(r * 10 + col + 1024).toString(16).toUpperCase().slice(0, 4)}</span>
            ))}
          </div>
        ))}
      </div>
      <div className="relative z-[1] mx-auto max-w-3xl rounded-xl border border-[#cbd5e1] bg-white/90 px-6 py-10 text-center shadow-xl backdrop-blur-sm">
        <h1 className="text-[clamp(1.15rem,3.2vw,1.9rem)] font-semibold">
          <span className="block text-[0.38em] uppercase tracking-[0.2em] text-[#64748b]">{c.line1}</span>
          <span className="mt-1 block text-[#0f172a]">{c.auditWord}</span>
        </h1>
        <p className="mt-4 text-[#475569]">{c.subtitle}</p>
        <PillarsBlock pillars={c.pillars} />
      </div>
    </div>
  );
}

function TopoShell({
  c,
  meta,
  light,
  blueprint,
  rings,
  scan,
}: {
  c: EngineeringHeroContent;
  meta: EngineeringConceptMeta;
  light: boolean;
  blueprint: boolean;
  rings: boolean;
  scan: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const rotateA = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const rotateB = useTransform(scrollYProgress, [0, 1], [0, -160]);
  const scanY = useTransform(scrollYProgress, [0, 1], [0, 320]);
  return (
    <div
      ref={ref}
      className={`${shell} ${light ? "bg-white text-[#0f172a]" : "pe-bg-dark-engine text-white"} relative overflow-hidden`}
    >
      {!light && <div className="pointer-events-none absolute inset-0 pe-grid-fine opacity-[0.1]" />}
      {blueprint && (
        <div className="pointer-events-none absolute inset-6 border border-dashed border-slate-400/40 pe-blueprint-plus sm:inset-10" />
      )}
      {rings && (
        <>
          <motion.div
            className="pointer-events-none absolute left-1/2 top-[18%] h-72 w-72 -translate-x-1/2 rounded-full border border-[#0066ff]/25"
            style={{ rotate: rotateA }}
          />
          <motion.div
            className="pointer-events-none absolute left-1/2 top-[20%] h-56 w-56 -translate-x-1/2 rounded-full border border-white/10"
            style={{ rotate: rotateB }}
          />
        </>
      )}
      {scan && (
        <motion.div
          className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-[#0066ff]/60 to-transparent"
          style={{ y: scanY }}
        />
      )}
      <div className={`relative z-[1] mx-auto flex max-w-3xl flex-col items-center text-center ${light ? "text-[#0f172a]" : ""}`}>
        <h1 className={`text-[clamp(1.1rem,3.4vw,2rem)] font-semibold ${light ? "" : "pe-metallic-title"}`}>
          <span className={`block text-[0.38em] uppercase tracking-[0.2em] ${light ? "text-[#64748b]" : "text-white/45"}`}>{c.line1}</span>
          <span className={`mt-1 block ${light ? "text-[#0f172a]" : ""}`}>{c.auditWord}</span>
        </h1>
        <p className={`mt-4 max-w-xl ${light ? "text-[#475569]" : "text-white/58"}`}>{c.subtitle}</p>
        <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.28em] text-[#0066ff]/55">
          {meta.n >= 26 ? "TARGET_LOCK · " : ""}SCAN · {meta.id.replace(/-/g, "_").slice(0, 12).toUpperCase()}
        </div>
        <PillarsBlock pillars={c.pillars} variant={blueprint ? "line" : "default"} />
      </div>
    </div>
  );
}

export function EngineeringHeroConceptView({ meta, c }: { meta: EngineeringConceptMeta; c: EngineeringHeroContent }) {
  switch (meta.id) {
    case "energy-core":
      return <C01EnergyCore c={c} />;
    case "technical-grid":
      return <C02TechnicalGrid c={c} />;
    case "kinetic-assembly":
      return <C03KineticAssembly c={c} />;
    case "metallic-type":
      return <C04MetallicType c={c} />;
    case "gauge-orbit":
      return <C05GaugeOrbit c={c} />;
    case "glass-dashboard":
      return <C06GlassDashboard c={c} />;
    case "liquid-glass":
      return <C07LiquidGlass c={c} />;
    case "reflection-panel":
      return <C08ReflectionPanel c={c} />;
    case "etched-pillars":
      return <C09EtchedPillars c={c} />;
    case "deep-focus":
      return <C10DeepFocus c={c} />;
    case "sequential-unroll":
      return <C11SequentialUnroll c={c} />;
    case "hazy-focus":
      return <C12HazyFocus c={c} />;
    case "line-blueprint":
      return <C13Blueprint c={c} />;
    case "morphing-core":
      return <C14MorphingCore c={c} />;
    case "assembly-line":
      return <C15AssemblyLine c={c} />;
    case "silver-spec":
      return <C16SilverSpec c={c} />;
    case "negative-blueprint":
      return <C17NegativeBlueprint c={c} />;
    case "liquid-titanium":
      return <C18LiquidTitanium c={c} />;
    case "synthesis-rings":
      return <C19SynthesisRings c={c} />;
    case "data-matrix":
      return <C20DataMatrix c={c} />;
    case "interactive-assembly-tp":
      return <TopoShell c={c} meta={meta} light={false} blueprint={false} rings={false} scan />;
    case "hazy-focus-tp":
      return <TopoShell c={c} meta={meta} light={false} blueprint={false} rings={false} scan={false} />;
    case "negative-blueprint-tp":
      return <TopoShell c={c} meta={meta} light={true} blueprint={true} rings={false} scan={false} />;
    case "technical-tp":
      return <TopoShell c={c} meta={meta} light={false} blueprint={true} rings={false} scan={false} />;
    case "negative-topo-diagram":
      return <TopoShell c={c} meta={meta} light={false} blueprint={false} rings={true} scan={true} />;
    case "kinetic-synthesis-tp":
      return <TopoShell c={c} meta={meta} light={false} blueprint={false} rings={true} scan={false} />;
    case "kinetic-data-matrix-tp":
      return <TopoShell c={c} meta={meta} light={false} blueprint={true} rings={false} scan={true} />;
    case "negative-kinetic-type-tp":
      return <TopoShell c={c} meta={meta} light={true} blueprint={true} rings={false} scan={false} />;
    case "negative-technical-type-tp":
      return <TopoShell c={c} meta={meta} light={true} blueprint={true} rings={false} scan={true} />;
    case "kinetic-typography-tp":
      return <TopoShell c={c} meta={meta} light={false} blueprint={false} rings={true} scan={true} />;
    default:
      return <C01EnergyCore c={c} />;
  }
}
