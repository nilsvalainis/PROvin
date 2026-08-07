"use client";

import { useEffect, useId, useState } from "react";
import {
  GOOGLE_REVIEWS,
  GOOGLE_REVIEWS_AGGREGATE_RATING,
  type GoogleReviewEntry,
} from "@/lib/google-reviews-data";

/** Īsie / spēcīgie citāti — editorial pull-quote, ne kartīšu siena. */
const FEATURED_IDS = ["dzintars-jaunzems", "edgars-sulcs", "andris-ever"] as const;

/** Vienāds excerpt garums karuselī — īsākais featured teksts tiek apgriezts pie ~100. */
const QUOTE_MAX_CHARS = 100;

/** Fiksēts 3 rindu bloka augstums pēc aktuālajiem font-size / line-height. */
const QUOTE_BODY_CLASS =
  "line-clamp-3 min-h-[4.875rem] text-pretty text-[1.2rem] font-medium leading-[1.35] tracking-tight text-white/[0.94] sm:min-h-[5.544rem] sm:text-[1.4rem] sm:leading-[1.32] lg:min-h-[5.742rem] lg:text-left lg:text-[1.45rem]";

/** Kājenes + „Lasīt visu” — vienāda augstuma rezervācija visām kartēm. */
const QUOTE_FOOTER_CLASS = "mt-4 flex min-h-[5.25rem] flex-col gap-1.5 sm:mt-5";

function pickFeatured(): GoogleReviewEntry[] {
  const byId = new Map(GOOGLE_REVIEWS.map((r) => [r.id, r]));
  const featured = FEATURED_IDS.map((id) => byId.get(id)).filter(
    (r): r is GoogleReviewEntry => !!r,
  );
  return featured.length > 0 ? featured : GOOGLE_REVIEWS.slice(0, 3);
}

function StarRow({ count = 5, size = "md" }: { count?: number; size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
  return (
    <span className="inline-flex items-center gap-0.5 text-[#fbbc04]" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <svg key={i} viewBox="0 0 20 20" className={box}>
          <path
            fill="currentColor"
            d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 0 0 .95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 0 0-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 0 0-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 0 0-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 0 0 .951-.69l1.07-3.292Z"
          />
        </svg>
      ))}
    </span>
  );
}

function clipQuote(text: string, max = QUOTE_MAX_CHARS): { clipped: string; truncated: boolean } {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return { clipped: t, truncated: false };
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return {
    clipped: `${(lastSpace > 56 ? cut.slice(0, lastSpace) : cut).trim()}…`,
    truncated: true,
  };
}

function formatCarouselQuote(text: string): { clipped: string; truncated: boolean } {
  const { clipped, truncated } = clipQuote(text);
  return { clipped, truncated: truncated || text.replace(/\s+/g, " ").trim().length > clipped.length };
}

type Props = {
  profileUrl: string;
  ratingLabel: string;
  readFullLabel: string;
  closeLabel: string;
};

/**
 * Desktop: tā pati 7+5 asimetrija kā hero (citāts kreisajā, Google enkurs labajā zem kartītes).
 * Mobile: centrēts stack.
 */
export function HomeGoogleReviewsFeatured({
  profileUrl,
  ratingLabel,
  readFullLabel,
  closeLabel,
}: Props) {
  const reviews = pickFeatured();
  const [index, setIndex] = useState(0);
  const [openFull, setOpenFull] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (reviews.length < 2 || openFull) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % reviews.length);
    }, 7000);
    return () => window.clearInterval(id);
  }, [reviews.length, openFull]);

  useEffect(() => {
    if (!openFull) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenFull(false);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [openFull]);

  const current = reviews[index] ?? reviews[0];
  if (!current) return null;

  const { clipped, truncated } = formatCarouselQuote(current.text);

  const dots =
    reviews.length > 1 ? (
      <div className="mt-5 flex h-1.5 gap-2 lg:mt-6" aria-hidden>
        {reviews.map((r, i) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setIndex(i)}
            className={`h-1.5 w-1.5 rounded-full transition ${
              i === index ? "bg-provin-accent" : "bg-white/25 hover:bg-white/45"
            }`}
            aria-label={`Atsauksme ${i + 1}`}
          />
        ))}
      </div>
    ) : null;

  const quoteBlock = (
    <blockquote
      key={current.id}
      className="flex w-full min-h-[10.75rem] flex-col transition-opacity duration-500 sm:min-h-[11.5rem] lg:min-h-[11.75rem]"
    >
      <p className={QUOTE_BODY_CLASS}>“{clipped}”</p>
      <footer className={QUOTE_FOOTER_CLASS}>
        <cite className="min-h-[1rem] not-italic text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
          {current.author}
        </cite>
        <div className="flex min-h-[1rem] items-center justify-center gap-2 text-[11px] text-white/35 lg:justify-start">
          <StarRow count={current.rating} size="sm" />
          <span>{current.relativeDateLv}</span>
        </div>
        <button
          type="button"
          onClick={() => setOpenFull(true)}
          aria-hidden={!truncated}
          tabIndex={truncated ? 0 : -1}
          className={`mt-1 min-h-[1.25rem] self-center text-[11px] font-semibold uppercase tracking-[0.16em] transition lg:self-start ${
            truncated
              ? "text-provin-accent hover:text-white"
              : "pointer-events-none invisible text-provin-accent"
          }`}
        >
          {readFullLabel}
        </button>
      </footer>
    </blockquote>
  );

  const trustRail = (
    <div className="flex flex-col gap-3 lg:max-w-[27.5rem] lg:gap-4">
      <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
        <StarRow count={GOOGLE_REVIEWS_AGGREGATE_RATING} />
        <span>{ratingLabel}</span>
      </p>
      <a
        href={profileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-fit text-[11px] font-semibold uppercase tracking-[0.16em] text-provin-accent no-underline transition hover:text-white"
      >
        Google →
      </a>
    </div>
  );

  const fullDialog = openFull ? (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="presentation"
      onClick={() => setOpenFull(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[min(85vh,36rem)] w-full max-w-lg overflow-y-auto border border-white/[0.12] bg-[#0a0c10] p-5 shadow-2xl sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3
              id={titleId}
              className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55"
            >
              {current.author}
            </h3>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-white/35">
              <StarRow count={current.rating} size="sm" />
              <span>{current.relativeDateLv}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpenFull(false)}
            className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45 transition hover:text-white"
          >
            {closeLabel}
          </button>
        </div>
        <p className="mt-5 whitespace-pre-line text-pretty text-[1.05rem] leading-[1.55] text-white/[0.92]">
          “{current.text.trim()}”
        </p>
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex text-[11px] font-semibold uppercase tracking-[0.16em] text-provin-accent no-underline transition hover:text-white"
        >
          Google →
        </a>
      </div>
    </div>
  ) : null;

  return (
    <div className="w-full">
      {/* Mobile / tablet — viena kolonna */}
      <div className="flex flex-col items-center text-center lg:hidden">
        <div className="flex w-full min-h-[13.5rem] flex-col sm:min-h-[14.25rem]">
          {quoteBlock}
          <div className="flex justify-center">{dots}</div>
        </div>
        <div className="mt-8 flex w-full flex-col items-center border-t border-white/[0.08] pt-6">
          {trustRail}
        </div>
      </div>

      {/* Desktop — hero 12 kol. / 7+5 */}
      <div className="hidden lg:grid lg:grid-cols-12 lg:items-start lg:gap-16">
        <div className="flex min-h-[13.25rem] min-w-0 flex-col lg:col-span-7">
          {quoteBlock}
          {dots}
        </div>
        <div className="min-w-0 lg:col-span-5 lg:flex lg:justify-end">
          <div className="w-full max-w-[27.5rem] border-l border-white/[0.08] pl-8 pt-1">
            {trustRail}
          </div>
        </div>
      </div>

      {fullDialog}
    </div>
  );
}
