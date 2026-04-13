"use client";

import "./motion-concept-demos.css";
import { Link } from "@/i18n/navigation";

function cardClass() {
  return "rounded-2xl border border-white/[0.1] bg-[#0a0b0f] p-4 sm:p-5";
}

const MAP_ROUTE_PATH = "M 12 55 L 28 38 L 44 48 L 62 28 L 88 22";

export function MotionConceptDemos() {
  return (
    <div className="motion-concept-demos mx-auto max-w-[min(72rem,calc(100vw-2rem))] pb-16 pt-6 text-white/90">
      <header className="mb-10 border-b border-white/[0.08] pb-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Demo · citi koncepti</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white/95 sm:text-3xl">Kustības un datu metaforas bez lēcas</h1>
        <p className="mt-3 max-w-[50rem] text-[14px] leading-relaxed text-white/55">
          Desmit pilnīgi citas kompozīcijas — terminālis, radars, mērierīce, mezglu caurule, kartes maršruts u.tml. Domātas kā alternatīva palielināmā stikla motīvam; produkcijā izvēlēties vienu valodu.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <article className={cardClass()} id="mcd-c1">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6f8]">C1 · Diagnostikas terminālis</h2>
          <p className="mt-2 text-[12px] text-white/50">
            Monospace „žurnāla” ritējums un mirgojošs kursors — OBD / SSH estētika bez jebkāda stikla.
          </p>
          <div className="motion-concept-demos__stage motion-concept-demos__terminal mt-4">
            <div className="motion-concept-demos__anim-terminal-inner">
              <p className="text-white/35">$ provin-scan --vin WVWZZZ...</p>
              <p>PID 0x0C: RPM 2 847</p>
              <p>PID 0x0D: SPD 0 km/h</p>
              <p>PID 0x05: ECT 91°C</p>
              <p className="text-white/40">DTC pending: none</p>
              <p>PID 0x0C: RPM 2 901</p>
              <p>PID 0x0D: SPD 0 km/h</p>
              <p>PID 0x11: TP 12.4%</p>
              <p className="text-white/35">stream OK · 14 Hz</p>
              <p>PID 0x0C: RPM 2 812</p>
              <p>PID 0x0F: IAT 18°C</p>
              <p>PID 0x2F: FL 78%</p>
              <span className="motion-concept-demos__cursor" aria-hidden />
            </div>
          </div>
        </article>

        <article className={cardClass()} id="mcd-c2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7eb6ff]">C2 · Fāžu josla</h2>
          <p className="mt-2 text-[12px] text-white/50">
            Viena horizontāla sliede ar slīdošu „gaismas” segmentu — kā ielādes vai sinhronizācijas indikators.
          </p>
          <div className="motion-concept-demos__stage mt-4 flex items-center px-5 py-10">
            <div className="motion-concept-demos__phase-track w-full">
              <div className="motion-concept-demos__anim-bar-fill" />
            </div>
          </div>
        </article>

        <article className={cardClass()} id="mcd-c3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5cf]">C3 · Plakanais radars</h2>
          <p className="mt-2 text-[12px] text-white/50">
            Koncentriskie riņķi, rotējoša līnija un mirgojošs blips — pilnīgi neatkarīgs no lēcas formas.
          </p>
          <div className="motion-concept-demos__stage mt-4 flex justify-center py-4">
            <svg viewBox="0 0 100 100" className="h-[120px] w-[120px]" fill="none" aria-hidden>
              <circle cx="50" cy="50" r="38" stroke="rgb(0 200 255 / 0.12)" strokeWidth="0.6" />
              <circle cx="50" cy="50" r="26" stroke="rgb(0 200 255 / 0.1)" strokeWidth="0.5" />
              <circle cx="50" cy="50" r="14" stroke="rgb(0 200 255 / 0.08)" strokeWidth="0.45" />
              <g className="motion-concept-demos__radar-sweep">
                <line x1="50" y1="50" x2="50" y2="14" stroke="rgb(0 255 220 / 0.35)" strokeWidth="0.8" strokeLinecap="round" />
              </g>
              <circle cx="68" cy="38" r="2.2" fill="rgb(255 200 80 / 0.95)" className="motion-concept-demos__anim-pulse" />
            </svg>
          </div>
        </article>

        <article className={cardClass()} id="mcd-c4">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#fc8]">C4 · Aprites mērierīce</h2>
          <p className="mt-2 text-[12px] text-white/50">
            Loka skala un šķērss kā šautra — klasiska instrumenta paneļa metafora.
          </p>
          <div className="motion-concept-demos__stage mt-4 flex justify-center py-2">
            <svg viewBox="0 0 120 70" className="w-full max-w-[200px]" fill="none" aria-hidden>
              <path
                d="M 24 58 A 36 36 0 0 1 96 58"
                stroke="rgb(255 255 255 / 0.12)"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              {[0, 1, 2, 3, 4, 5, 6].map((i) => {
                const a = Math.PI * (1 - i / 6);
                const x1 = 60 + 30 * Math.cos(a);
                const y1 = 58 + 30 * Math.sin(a);
                const x2 = 60 + 34 * Math.cos(a);
                const y2 = 58 + 34 * Math.sin(a);
                return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgb(255 255 255 / 0.2)" strokeWidth="0.45" />;
              })}
              <g className="motion-concept-demos__gauge-needle">
                <line x1="60" y1="58" x2="60" y2="32" stroke="rgb(255 100 80)" strokeWidth="1.4" strokeLinecap="round" />
                <circle cx="60" cy="58" r="2.5" fill="rgb(40 40 44)" stroke="rgb(255 255 255 / 0.25)" strokeWidth="0.4" />
              </g>
            </svg>
          </div>
        </article>

        <article className={cardClass()} id="mcd-c5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9cf]">C5 · Mezglu caurule</h2>
          <p className="mt-2 text-[12px] text-white/50">
            Vienota līnija ar plūstošu <span className="font-mono text-white/35">stroke-dashoffset</span> — datu plūsma starp punktiem.
          </p>
          <div className="motion-concept-demos__stage mt-4 flex items-center justify-center py-6">
            <svg viewBox="0 0 220 40" className="w-full max-w-[260px]" fill="none" aria-hidden>
              {[20, 75, 130, 185].map((x) => (
                <circle key={x} cx={x} cy="20" r="4" fill="rgb(20 24 32)" stroke="rgb(0 150 255 / 0.45)" strokeWidth="0.6" />
              ))}
              <path
                d="M 20 20 H 185"
                pathLength="100"
                stroke="rgb(0 180 255 / 0.85)"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeDasharray="12 28"
                className="motion-concept-demos__anim-dash"
              />
            </svg>
          </div>
        </article>

        <article className={cardClass()} id="mcd-c6">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#aab]">C6 · Kartiņu klāsts</h2>
          <p className="mt-2 text-[12px] text-white/50">
            Trīs slāņi ar nobīdi; vidējā karte „elpo” ar zilu kontūru — UI, ne optika.
          </p>
          <div className="motion-concept-demos__stage mt-4 flex items-center justify-center py-8">
            <div className="relative h-[72px] w-[140px]">
              <div className="absolute left-2 top-3 z-0 h-14 w-24 rounded-lg border border-white/[0.08] bg-[#12141a]" />
              <div className="absolute left-10 top-4 z-0 h-14 w-24 rounded-lg border border-white/[0.06] bg-[#101218]" />
              <div className="motion-concept-demos__card-mid absolute left-6 top-1 z-10 h-14 w-24 rounded-lg border border-[#0066ff]/40 bg-[#151820] shadow-lg" />
            </div>
          </div>
        </article>

        <article className={cardClass()} id="mcd-c7">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6cf]">C7 · Spektra joslas</h2>
          <p className="mt-2 text-[12px] text-white/50">
            Īsas vertikālas joslas ar neatkarīgu augstumu — audio / FFT sajūta.
          </p>
          <div className="motion-concept-demos__stage mt-4 px-4 py-6">
            <div className="motion-concept-demos__anim-eq mx-auto flex h-24 max-w-[200px] items-end justify-center gap-[5px]">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="h-full w-2 overflow-hidden rounded-sm bg-white/[0.06]">
                  <span className="h-full w-full" />
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className={cardClass()} id="mcd-c8">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#d4a574]">C8 · Topogrāfisks maršruts</h2>
          <p className="mt-2 text-[12px] text-white/50">
            Vienkārša „karte” un punkts pa lauztu līniju — navigācija bez lēcas.
          </p>
          <div className="motion-concept-demos__stage mt-4 py-4">
            <svg viewBox="0 0 100 72" className="mx-auto h-[100px] w-full max-w-[220px]" fill="none" aria-hidden>
              <rect width="100" height="72" rx="5" fill="rgb(22 20 17)" />
              <path d="M 12 58 L 28 40 L 44 50 L 62 30 L 88 24" stroke="rgb(180 150 110 / 0.35)" strokeWidth="0.9" strokeDasharray="2 2" />
              <path d={MAP_ROUTE_PATH} stroke="rgb(200 170 120 / 0.55)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
              <circle r="2.8" fill="rgb(0 120 255)" stroke="rgb(255 255 255 / 0.5)" strokeWidth="0.35" cx="0" cy="0">
                <animateMotion dur="3.2s" repeatCount="indefinite" calcMode="linear" path={MAP_ROUTE_PATH} rotate="0" />
              </circle>
            </svg>
          </div>
        </article>

        <article className={cardClass()} id="mcd-c9">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8af]">C9 · Šūnu skenēšana</h2>
          <p className="mt-2 text-[12px] text-white/50">
            5×5 režģis ar secīgu „ielādes” pulsāciju — kā atmiņas vai sensora maskas vizualizācija.
          </p>
          <div className="motion-concept-demos__stage mt-4 p-4">
            <div className="mx-auto grid w-fit grid-cols-5 gap-1">
              {Array.from({ length: 25 }, (_, i) => (
                <div
                  key={i}
                  className="motion-concept-demos__anim-grid-cell h-3 w-3 rounded-[2px] bg-[#0066ff]/25"
                  style={{ animationDelay: `${(i % 5) * 0.1 + Math.floor(i / 5) * 0.1}s` }}
                />
              ))}
            </div>
          </div>
        </article>

        <article className={cardClass()} id="mcd-c10">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ffb347]">C10 · Digitālais skaitītājs</h2>
          <p className="mt-2 text-[12px] text-white/50">
            Segmentu kastes un horizontāla skenēšanas svītra — odometra / reģistrācijas displeja valoda.
          </p>
          <div className="motion-concept-demos__stage relative mt-4 overflow-hidden px-4 py-6">
            <div className="relative mx-auto flex w-fit gap-1 font-mono text-[15px] font-semibold tracking-widest text-[#7eb6ff]">
              {"184732".split("").map((d, i) => (
                <span key={i} className="flex h-9 w-6 items-center justify-center rounded border border-white/[0.12] bg-black/50">
                  {d}
                </span>
              ))}
            </div>
            <div className="motion-concept-demos__anim-odometer-scan pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-[#0066ff]/25 to-transparent" />
          </div>
        </article>
      </div>

      <p className="mt-10 text-center text-[11px] text-white/35">
        <Link href="/demo/lens-variants" className="text-[#7eb6ff]/80 underline-offset-2 hover:text-[#7eb6ff] hover:underline">
          Salīdzinājumam: palielināmā stikla demo
        </Link>
        <span className="mx-2 text-white/20">·</span>
        <Link href="/demo" className="text-white/45 hover:text-white/70">
          Demo studija
        </Link>
      </p>
    </div>
  );
}
