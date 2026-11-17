"use client";

import { useEffect, useRef, useState } from "react";
import { renderProvinText } from "@/lib/provin-wordmark";

type Block = { label: string; text: string; id?: string };

type Props = {
  title: string;
  lead: string;
  social: React.ReactNode;
  duelA: string;
  duelB: string;
  blocks: Block[];
  videoId: string;
  videoTitle: string;
  playLabel: string;
};

/** Sadala tekstu: pirmais teikums (izcelts) + pārējais. */
function splitFirst(text: string): [string, string] {
  const m = /[.!?]\s/.exec(text);
  if (!m) return [text, ""];
  return [text.slice(0, m.index + 1), text.slice(m.index + 2)];
}

function Video({ videoId, videoTitle, playLabel }: { videoId: string; videoTitle: string; playLabel: string }) {
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  const onMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.transform = `rotateY(${(x - 0.5) * 8}deg) rotateX(${(0.5 - y) * 8}deg) scale(1.02)`;
    el.style.setProperty("--gx", `${x * 100}%`);
    el.style.setProperty("--gy", `${y * 100}%`);
  };

  if (playing) {
    return (
      <figure className="m-0">
        <div className="relative aspect-video w-full overflow-hidden rounded-[18px] bg-black">
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
            title={videoTitle}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </figure>
    );
  }

  return (
    <figure className="m-0 [perspective:1200px]">
      <button
        ref={ref}
        type="button"
        aria-label={`${playLabel}: ${videoTitle}`}
        onClick={() => setPlaying(true)}
        onPointerMove={onMove}
        onPointerLeave={() => {
          if (ref.current) ref.current.style.transform = "";
        }}
        className="about-video relative block aspect-video w-full cursor-pointer overflow-hidden rounded-[18px] border-0 bg-zinc-900 p-0 outline outline-1 -outline-offset-1 outline-white/10"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- YouTube CDN priekšskatījums */}
        <img
          src={`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`}
          alt=""
          className="h-full w-full object-cover"
          style={{ filter: "grayscale(1) contrast(1.08) brightness(0.92)" }}
          loading="lazy"
          decoding="async"
          width={1280}
          height={720}
        />
        <span className="about-video__play" aria-hidden>
          <svg viewBox="0 0 24 24" className="ml-[3px] h-6 w-6" fill="currentColor">
            <path d="M8 5.5v13l11-6.5z" />
          </svg>
        </span>
      </button>
      <figcaption className="mt-3.5 flex flex-wrap items-center gap-3">
        <span className="text-[10px] font-extrabold tracking-[0.14em] text-zinc-500">YouTube</span>
        <b className="text-[13.5px] font-semibold text-zinc-300">{videoTitle}</b>
      </figcaption>
    </figure>
  );
}

/**
 * Par PROVIN B4.1 (03.11): duelis, liels melnbalts video, trīs teksti ar birkām.
 * Ritinot pirmais teikums izgaismojas vārds pa vārdam; pēdējā bloka otrais teikums izcelts (VIN zils).
 */
export function AboutB41({ title, lead, social, duelA, duelB, blocks, videoId, videoTitle, playLabel }: Props) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    el.classList.add("is-js");
    if (typeof IntersectionObserver === "undefined") {
      el.querySelectorAll(".about-reveal").forEach((x) => x.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const t = e.target as HTMLElement;
          t.classList.add("is-in");
          t.querySelectorAll<HTMLElement>(".about-w").forEach((w, k) => {
            w.style.transitionDelay = `${k * 35}ms`;
          });
          io.unobserve(t);
        }
      },
      { threshold: 0.25 },
    );
    el.querySelectorAll(".about-reveal").forEach((x) => io.observe(x));
    return () => io.disconnect();
  }, []);

  const words = (s: string) =>
    s.split(/(\s+)/).map((w, i) => (/\s+/.test(w) ? w : <span key={i} className="about-w">{w}</span>));

  return (
    <div ref={root} className="about-b41 mx-auto w-full max-w-[calc(75rem+48px)] px-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] sm:px-6">
      <header className="flex flex-col items-center pt-6 text-center sm:pt-8">
        <h1 className="text-[clamp(2.75rem,6vw,4.75rem)] font-extrabold leading-none tracking-[-0.045em] text-white">
          {renderProvinText(title, { proAndSuffixClassName: "text-white" })}
        </h1>
        <p className="mt-3.5 text-[12px] font-bold uppercase tracking-[0.16em] text-zinc-500">{lead}</p>
        <div className="mt-[18px]">{social}</div>
      </header>

      <div className="about-duel about-reveal mt-14 grid items-center gap-[18px] sm:mt-20 lg:grid-cols-[1fr_auto_1fr] lg:gap-10">
        <p className="about-duel__a text-[clamp(1.9rem,3.6vw,3rem)] font-extrabold leading-[1.08] tracking-[-0.035em] text-zinc-600 lg:text-right">{duelA}</p>
        <i className="about-duel__line" aria-hidden />
        <p className="about-duel__b text-[clamp(1.9rem,3.6vw,3rem)] font-extrabold leading-[1.08] tracking-[-0.035em] text-white">{duelB}</p>
      </div>

      <div className="mt-12 grid items-start gap-10 sm:mt-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:gap-[72px]">
        <div className="order-2 grid gap-11 lg:order-1 lg:gap-14">
          {blocks.map((b, i) => {
            const [first, rest] = splitFirst(b.text);
            const last = i === blocks.length - 1;
            return (
              <div key={b.label} id={b.id} className="about-reveal scroll-mt-16">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#5c9dff]">{b.label}</span>
                <p className="mt-4 text-[16px] leading-[1.7] text-zinc-500">
                  <span className="mb-1.5 block text-[19px] font-semibold leading-[1.45] tracking-[-0.012em] text-white sm:text-[21px]">
                    {words(first)}
                  </span>
                  {last ? (
                    <span className="mt-[18px] block text-[24px] font-bold leading-[1.3] tracking-[-0.02em] text-white [text-wrap:balance] sm:text-[30px]">
                      {renderProvinText(rest, { proAndSuffixClassName: "text-white" })}
                    </span>
                  ) : (
                    rest
                  )}
                </p>
              </div>
            );
          })}
        </div>
        <aside className="order-1 lg:sticky lg:top-7 lg:order-2">
          <Video videoId={videoId} videoTitle={videoTitle} playLabel={playLabel} />
        </aside>
      </div>
    </div>
  );
}
