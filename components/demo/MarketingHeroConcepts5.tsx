"use client";

import { useMemo, useState } from "react";
import "./marketing-hero-concepts-5.css";

function CarSilhouette({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 480 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M40 132h52l8-24h228l14 24h88v-20l-18-32-76-18-34-38h-72l-38 38-104 10-28 32v28z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
        opacity="0.9"
      />
      <path
        d="M96 132a28 28 0 1 0 0 .1M352 132a28 28 0 1 0 0 .1"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.55"
      />
      <path d="M128 84h120" stroke="currentColor" strokeWidth="1.2" opacity="0.25" strokeLinecap="round" />
    </svg>
  );
}

function FakeVinResults({ vin }: { vin: string }) {
  const clean = vin.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (clean.length < 11) return null;
  return (
    <div
      className="mhc5-animate-in mt-10 max-w-xl rounded-2xl border border-neutral-200/80 bg-white/80 p-6 text-left shadow-lg shadow-neutral-900/[0.04] backdrop-blur-sm"
      role="region"
      aria-live="polite"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400">Demo rezultāts</p>
      <ul className="mt-3 space-y-2 text-[15px] text-neutral-700">
        <li>
          <span className="font-medium text-neutral-900">VIN:</span> {clean.slice(0, 17)}
        </li>
        <li>
          <span className="font-medium text-neutral-900">Reģions (simulācija):</span> EU
        </li>
        <li>
          <span className="font-medium text-neutral-900">Riska līmenis:</span> zems (māketa dati)
        </li>
        <li>
          <span className="font-medium text-neutral-900">Nobraukuma krustojums:</span> bez novirzēm (demo)
        </li>
      </ul>
    </div>
  );
}

export function MarketingHeroConcepts5() {
  const [vinInteractive, setVinInteractive] = useState("");

  const milestones = useMemo(() => {
    const n = vinInteractive.toUpperCase().replace(/[^A-Z0-9]/g, "").length;
    return [
      { label: "Normalizēšana", on: n >= 3 },
      { label: "Reģistru šķērssaites", on: n >= 8 },
      { label: "Riska heiristika", on: n >= 11 },
      { label: "Atskaite (simulācija)", on: n >= 14 },
    ];
  }, [vinInteractive]);

  return (
    <div className="min-w-0">
      <header className="border-b border-white/[0.08] bg-[#030304] px-4 py-8 sm:px-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">PROVIN · demo</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-white/95 sm:text-2xl">Pieci mārketinga hero koncepti</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/50">
          Statiski bloki ar latviešu copy — Apple līdz SaaS uzticamībai. Nav saistīti ar produkcijas{" "}
          <code className="rounded bg-white/10 px-1 py-0.5 text-[11px] text-white/70">MarketingHero</code> orbitu.
        </p>
        <nav className="mt-5 flex flex-wrap gap-2 text-[11px]" aria-label="Sadaļas">
          {[
            ["#mhc5-apple", "1 · Apple"],
            ["#mhc5-ai", "2 · AI"],
            ["#mhc5-luxury", "3 · Luxury"],
            ["#mhc5-input", "4 · Input"],
            ["#mhc5-trust", "5 · Trust"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="rounded-full border border-white/15 px-3 py-1.5 text-white/55 transition hover:border-sky-500/40 hover:text-sky-200/90"
            >
              {label}
            </a>
          ))}
        </nav>
      </header>

      {/* 1 · Apple-level minimal */}
      <section
        id="mhc5-apple"
        className="scroll-mt-6 border-b border-neutral-200/60 bg-gradient-to-b from-slate-100/90 via-blue-50/40 to-white py-24 sm:py-32"
        aria-labelledby="mhc5-apple-h"
      >
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2
            id="mhc5-apple-h"
            className="mhc5-animate-in mhc5-d1 text-balance text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl md:text-[2.65rem] md:leading-[1.08]"
          >
            Atklāj patieso auto stāstu pirms pirkuma
          </h2>
          <p className="mhc5-animate-in mhc5-d2 mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-neutral-500 sm:text-lg">
            Pilns VIN audits ar risku analīzi, datu krustošanu un eksperta ieskatiem
          </p>
          <div className="mhc5-animate-in mhc5-d3 mx-auto mt-12 max-w-md">
            <label htmlFor="mhc5-apple-vin" className="sr-only">
              VIN
            </label>
            <div className="flex flex-col gap-3 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.12)] sm:flex-row sm:items-stretch">
              <input
                id="mhc5-apple-vin"
                type="text"
                inputMode="text"
                autoComplete="off"
                maxLength={17}
                placeholder="Ievadi VIN (17 zīmes)"
                className="min-h-[52px] flex-1 rounded-2xl border border-neutral-200/90 bg-white/90 px-4 text-center text-[15px] font-medium tracking-wide text-neutral-800 shadow-inner shadow-neutral-900/[0.03] outline-none ring-0 transition placeholder:text-neutral-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-200/60 sm:text-left"
              />
              <button
                type="button"
                className="min-h-[52px] shrink-0 rounded-2xl bg-neutral-900 px-7 text-[15px] font-semibold text-white transition hover:bg-neutral-800 active:scale-[0.99]"
              >
                Pārbaudīt auto
              </button>
            </div>
          </div>
          <ul className="mhc5-animate-in mhc5-d4 mx-auto mt-10 flex max-w-lg flex-col gap-2.5 text-left text-sm text-neutral-600 sm:mt-14 sm:text-center">
            <li className="flex items-start gap-2 sm:justify-center">
              <span className="mt-0.5 text-emerald-600" aria-hidden>
                ✔
              </span>
              <span>10 000+ pārbaudīti auto</span>
            </li>
            <li className="flex items-start gap-2 sm:justify-center">
              <span className="mt-0.5 text-emerald-600" aria-hidden>
                ✔
              </span>
              <span>Eiropas + ASV datubāzes</span>
            </li>
            <li className="flex items-start gap-2 sm:justify-center">
              <span className="mt-0.5 text-emerald-600" aria-hidden>
                ✔
              </span>
              <span>24h rezultāts</span>
            </li>
          </ul>
        </div>
      </section>

      {/* 2 · AI inspector */}
      <section
        id="mhc5-ai"
        className="scroll-mt-6 border-b border-white/10 bg-gradient-to-br from-[#0a0b10] via-[#0f1118] to-[#06070c] py-20 text-zinc-100 sm:py-28"
        aria-labelledby="mhc5-ai-h"
      >
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 id="mhc5-ai-h" className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl md:text-[2.35rem] md:leading-tight">
              Tavs auto tiek analizēts reāllaikā
            </h2>
            <p className="mt-4 max-w-md text-pretty text-base leading-relaxed text-zinc-400 sm:text-lg">
              Mēs pārbaudām 100+ datu punktus, lai atrastu slēptos riskus
            </p>
            <button
              type="button"
              className="mt-8 rounded-xl bg-sky-500 px-6 py-3 text-[15px] font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:bg-sky-400 active:scale-[0.99]"
            >
              Sākt analīzi
            </button>
          </div>

          <div
            className="mhc5-ai-scan relative overflow-hidden rounded-2xl border border-white/[0.08] bg-zinc-900/60 p-5 shadow-2xl shadow-black/50 backdrop-blur-md sm:p-6"
            aria-label="Analīzes panelis (demo)"
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Live panelis</span>
              <span className="flex items-center gap-1.5 text-[11px] text-emerald-400/90">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/50 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                Aktīvs
              </span>
            </div>

            <div className="mt-5 flex flex-wrap items-end gap-6">
              <div className="relative grid h-28 w-28 shrink-0 place-items-center">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
                  <circle cx="50" cy="50" r="42" fill="none" stroke="rgb(39 39 42)" strokeWidth="10" />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="url(#mhc5-risk-grad)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${0.82 * 264} 264`}
                  />
                  <defs>
                    <linearGradient id="mhc5-risk-grad" x1="0" x2="1">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="100%" stopColor="#22c55e" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-bold tracking-tight text-white">82%</span>
                  <span className="text-[9px] font-medium uppercase tracking-wider text-zinc-500">Risks</span>
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Nobraukuma līkne</p>
                <div className="mt-2 flex h-24 items-end gap-1.5 rounded-lg border border-white/[0.05] bg-black/30 px-2 pb-2 pt-3">
                  {[40, 55, 48, 62, 58, 70, 68, 82, 78, 88].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm bg-gradient-to-t from-sky-600/30 to-sky-400/80 transition-all"
                      style={{ height: `${h}%`, animationDelay: `${i * 80}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {[
                { t: "VIN paraksts", warn: true },
                { t: "Sludinājumu krusts", warn: false },
                { t: "Servisa vēsture", warn: true },
              ].map((x) => (
                <span
                  key={x.t}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium ${
                    x.warn
                      ? "border-amber-500/35 bg-amber-500/10 text-amber-200/90"
                      : "border-emerald-500/25 bg-emerald-500/10 text-emerald-200/85"
                  }`}
                >
                  {x.warn ? "⚠" : "✓"} {x.t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 3 · Luxury dark gold */}
      <section
        id="mhc5-luxury"
        className="scroll-mt-6 relative overflow-hidden border-b border-amber-900/20 bg-[#030201] py-20 text-[#f5f0e8] sm:py-28"
        aria-labelledby="mhc5-luxury-h"
      >
        <div className="pointer-events-none absolute -right-20 top-1/2 h-[min(90vw,520px)] w-[min(90vw,520px)] -translate-y-1/2 rounded-full bg-amber-600/15 mhc5-lux-glow blur-3xl" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-amber-200/45">PROVIN · atelier demo</p>
            <h2
              id="mhc5-luxury-h"
              className="mt-4 font-serif text-4xl font-normal leading-[1.05] tracking-tight text-[#faf6ef] sm:text-5xl md:text-[3.15rem]"
            >
              Ne katrs auto ir tā vērts
            </h2>
            <p className="mt-5 max-w-md text-pretty text-base leading-relaxed text-[#c9bcab] sm:text-lg">
              Atklāj slēptos defektus pirms tie kļūst par tavām izmaksām
            </p>
            <button
              type="button"
              className="mt-10 rounded-full border border-amber-400/40 bg-gradient-to-b from-[#f3e7c8] to-[#c9a227] px-8 py-3.5 text-[15px] font-semibold text-[#1a1208] shadow-[0_0_0_1px_rgba(212,175,55,0.2),0_20px_50px_rgba(0,0,0,0.45)] transition hover:brightness-105 active:scale-[0.99]"
            >
              Saņemt auditu
            </button>
          </div>
          <div className="relative flex justify-center lg:justify-end">
            <div className="relative w-full max-w-md text-amber-500/90 drop-shadow-[0_0_40px_rgba(212,175,55,0.25)]">
              <CarSilhouette className="w-full" />
            </div>
          </div>
        </div>
      </section>

      {/* 4 · Input-first */}
      <section
        id="mhc5-input"
        className="scroll-mt-6 border-b border-neutral-200 bg-neutral-50 py-24 sm:py-32"
        aria-labelledby="mhc5-input-h"
      >
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 id="mhc5-input-h" className="text-balance text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
            Ievadi VIN. Uzzini visu.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-pretty text-neutral-500 sm:text-lg">Bez minējumiem. Tikai fakti.</p>

          <div className="mx-auto mt-14 max-w-2xl">
            <label htmlFor="mhc5-big-vin" className="sr-only">
              VIN
            </label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
              <input
                id="mhc5-big-vin"
                type="text"
                value={vinInteractive}
                onChange={(e) => setVinInteractive(e.target.value.toUpperCase())}
                inputMode="text"
                autoComplete="off"
                maxLength={17}
                placeholder="·················"
                className="min-h-[64px] flex-1 rounded-2xl border-2 border-neutral-900 bg-white px-4 text-center text-xl font-semibold tracking-[0.2em] text-neutral-900 shadow-sm outline-none transition placeholder:tracking-[0.35em] placeholder:text-neutral-300 focus:border-neutral-700 focus:ring-4 focus:ring-neutral-900/10 sm:text-2xl md:min-h-[72px] md:text-3xl"
              />
              <button
                type="button"
                className="min-h-[64px] shrink-0 rounded-2xl bg-neutral-900 px-8 text-base font-semibold text-white transition hover:bg-neutral-800 md:min-h-[72px] md:px-10 md:text-lg"
              >
                Pārbaudīt
              </button>
            </div>
            <p className="mt-3 text-xs text-neutral-400">Demo: ieraksti vismaz 11 zīmes, lai parādītos māketa rezultāts.</p>
          </div>

          {vinInteractive.replace(/[^A-Z0-9]/gi, "").length >= 11 ? (
            <FakeVinResults vin={vinInteractive} />
          ) : (
            <div className="mt-10 min-h-[120px]" aria-hidden />
          )}

          <div className="mx-auto mt-8 flex max-w-md flex-wrap justify-center gap-2 text-[11px] text-neutral-400">
            {milestones.map((m) => (
              <span
                key={m.label}
                className={`rounded-full border px-2.5 py-1 transition ${
                  m.on ? "border-emerald-300/80 bg-emerald-50 text-emerald-800" : "border-neutral-200 bg-white/60"
                }`}
              >
                {m.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 5 · Trust / SaaS */}
      <section
        id="mhc5-trust"
        className="scroll-mt-6 bg-gradient-to-b from-white to-slate-50 py-20 sm:py-28"
        aria-labelledby="mhc5-trust-h"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.05fr]">
            <div>
              <h2 id="mhc5-trust-h" className="text-balance text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
                Balstīts datos, nevis minējumos
              </h2>
              <p className="mt-4 max-w-lg text-pretty text-base leading-relaxed text-neutral-600 sm:text-lg">
                Apvienojam datus no 20+ avotiem, lai tu pieņemtu pareizo lēmumu
              </p>
              <button
                type="button"
                className="mt-8 rounded-xl bg-neutral-900 px-6 py-3 text-[15px] font-semibold text-white shadow-md transition hover:bg-neutral-800"
              >
                Pārbaudīt auto
              </button>
            </div>

            <div
              className="relative overflow-hidden rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-xl shadow-neutral-900/[0.06]"
              aria-hidden
            >
              <div className="absolute inset-0 bg-[radial-gradient(900px_400px_at_80%_0%,rgb(14_165_233/0.07),transparent_55%)]" />
              <p className="relative text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">Datu avoti (UI mock)</p>
              <div className="relative mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {["CSDD", "EU", "DE", "US", "Ads", "Foto", "Serv.", "Tirgus"].map((name) => (
                  <div
                    key={name}
                    className="rounded-lg border border-neutral-100 bg-neutral-50/90 px-2 py-2.5 text-center text-[10px] font-semibold text-neutral-600"
                  >
                    {name}
                  </div>
                ))}
              </div>
              <div className="relative mt-4 flex items-center justify-between rounded-xl border border-dashed border-sky-200/80 bg-sky-50/50 px-3 py-3 text-[11px] text-sky-900/80">
                <span>Krusteniskā validācija</span>
                <span className="font-mono text-[10px] text-sky-700/90">sync · OK</span>
              </div>
            </div>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-6 border-t border-neutral-200/80 pt-12 sm:grid-cols-3">
            <div className="text-center sm:text-left">
              <p className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">2M+</p>
              <p className="mt-1 text-sm font-medium text-neutral-500">ierakstu</p>
            </div>
            <div className="text-center sm:text-left">
              <p className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">50k+</p>
              <p className="mt-1 text-sm font-medium text-neutral-500">lietotāju</p>
            </div>
            <div className="text-center sm:text-left">
              <p className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">4.9★</p>
              <p className="mt-1 text-sm font-medium text-neutral-500">vērtējums</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
