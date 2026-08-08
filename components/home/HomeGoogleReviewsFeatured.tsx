"use client";

import { useEffect, useState } from "react";
import {
  GOOGLE_REVIEWS,
  type GoogleReviewEntry,
} from "@/lib/google-reviews-data";

/** Vienāds excerpt garums karuselī — balstīts uz pilnā BUJ kolonnas augstumu. */
const QUOTE_MAX_CHARS = 240;

/** Fiksēts 6 rindu bloka augstums, lai slide maiņa nelēkā. */
const QUOTE_BODY_CLASS =
  "line-clamp-6 min-h-[9.72rem] text-pretty text-[1.2rem] font-medium leading-[1.35] tracking-tight text-white/[0.94] sm:min-h-[11.088rem] sm:text-[1.4rem] sm:leading-[1.32] lg:min-h-[11.484rem] lg:text-left lg:text-[1.45rem]";

const QUOTE_FOOTER_CLASS = "mt-4 flex min-h-[5.25rem] flex-col gap-1.5 sm:mt-5";

function StarRow({ count = 5 }: { count?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[#fbbc04]" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <svg key={i} viewBox="0 0 20 20" className="h-3 w-3">
          <path
            fill="currentColor"
            d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 0 0 .95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 0 0-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 0 0-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 0 0-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 0 0 .951-.69l1.07-3.292Z"
          />
        </svg>
      ))}
    </span>
  );
}

function clipQuote(text: string, max = QUOTE_MAX_CHARS): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  const minKeep = Math.floor(max * 0.55);
  return `${(lastSpace > minKeep ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

type Props = {
  profileUrl: string;
  googleLabel: string;
  prevLabel: string;
  nextLabel: string;
};

/**
 * Kreisā kolonna: atsauksmju karuselis ar manuālu slide + Google saite.
 * Labā kolonna (BUJ) nāk no vecāka layouta.
 */
export function HomeGoogleReviewsFeatured({
  profileUrl,
  googleLabel,
  prevLabel,
  nextLabel,
}: Props) {
  const reviews: GoogleReviewEntry[] =
    GOOGLE_REVIEWS.length > 0 ? GOOGLE_REVIEWS : [];
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reviews.length < 2 || paused) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % reviews.length);
    }, 7000);
    return () => window.clearInterval(id);
  }, [reviews.length, paused]);

  const current = reviews[index] ?? reviews[0];
  if (!current) return null;

  const clipped = clipQuote(current.text);
  const goPrev = () => {
    setPaused(true);
    setIndex((i) => (i - 1 + reviews.length) % reviews.length);
  };
  const goNext = () => {
    setPaused(true);
    setIndex((i) => (i + 1) % reviews.length);
  };

  const slideControls =
    reviews.length > 1 ? (
      <div className="mt-5 flex items-center gap-4 lg:mt-6 lg:justify-start">
        <button
          type="button"
          onClick={goPrev}
          className="inline-flex min-h-11 min-w-11 items-center justify-center text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40 transition hover:text-white sm:min-h-0 sm:min-w-0"
          aria-label={prevLabel}
        >
          ←
        </button>
        <div className="flex h-1.5 gap-2" aria-hidden>
          {reviews.map((r, i) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setPaused(true);
                setIndex(i);
              }}
              className={`h-1.5 w-1.5 rounded-full transition ${
                i === index ? "bg-provin-accent" : "bg-white/25 hover:bg-white/45"
              }`}
              aria-label={`Atsauksme ${i + 1}`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={goNext}
          className="inline-flex min-h-11 min-w-11 items-center justify-center text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40 transition hover:text-white sm:min-h-0 sm:min-w-0"
          aria-label={nextLabel}
        >
          →
        </button>
      </div>
    ) : null;

  return (
    <div className="flex w-full min-h-[18.5rem] flex-col sm:min-h-[20rem] lg:min-h-[19.5rem]">
      <blockquote
        key={current.id}
        className="flex w-full min-h-[15.75rem] flex-col transition-opacity duration-500 sm:min-h-[17.25rem] lg:min-h-[17.5rem]"
      >
        <p className={QUOTE_BODY_CLASS}>“{clipped}”</p>
        <footer className={QUOTE_FOOTER_CLASS}>
          <cite className="min-h-[1rem] not-italic text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
            {current.author}
          </cite>
          <div className="flex min-h-[1rem] items-center justify-center gap-2 text-[11px] text-white/35 lg:justify-start">
            <StarRow count={current.rating} />
            <span>{current.relativeDateLv}</span>
          </div>
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 min-h-[1.25rem] self-center text-[11px] font-semibold uppercase tracking-[0.16em] text-provin-accent no-underline transition hover:text-white lg:self-start"
          >
            {googleLabel}
          </a>
        </footer>
      </blockquote>
      <div className="flex justify-center lg:justify-start">{slideControls}</div>
    </div>
  );
}
