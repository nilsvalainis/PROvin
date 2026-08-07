"use client";

import { useEffect, useState } from "react";
import {
  GOOGLE_REVIEWS,
  GOOGLE_REVIEWS_AGGREGATE_RATING,
  type GoogleReviewEntry,
} from "@/lib/google-reviews-data";

/** Īsie / spēcīgie citāti — editorial pull-quote, ne kartīšu siena. */
const FEATURED_IDS = ["dzintars-jaunzems", "edgars-sulcs", "andris-ever"] as const;

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

function clipQuote(text: string, max = 240): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 120 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

type Props = {
  profileUrl: string;
  ratingLabel: string;
  trustAside: string;
};

/**
 * Desktop: tā pati 7+5 asimetrija kā hero (citāts kreisajā, Google enkurs labajā zem kartītes).
 * Mobile: centrēts stack.
 */
export function HomeGoogleReviewsFeatured({ profileUrl, ratingLabel, trustAside }: Props) {
  const reviews = pickFeatured();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reviews.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % reviews.length);
    }, 7000);
    return () => window.clearInterval(id);
  }, [reviews.length]);

  const current = reviews[index] ?? reviews[0];
  if (!current) return null;

  const dots = reviews.length > 1 ? (
    <div className="mt-5 flex gap-2 lg:mt-6" aria-hidden>
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
    <div className="relative min-h-[9.5rem] w-full sm:min-h-[8.5rem] lg:min-h-[9rem]">
      {reviews.map((review, i) => (
        <blockquote
          key={review.id}
          className={`absolute inset-x-0 top-0 transition-opacity duration-700 ease-out ${
            i === index ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          aria-hidden={i !== index}
        >
          <p className="text-pretty text-[1.2rem] font-medium leading-[1.35] tracking-tight text-white/[0.94] sm:text-[1.4rem] sm:leading-[1.32] lg:text-[1.45rem]">
            “{clipQuote(review.text)}”
          </p>
          <footer className="mt-4 flex flex-col gap-1.5 sm:mt-5">
            <cite className="not-italic text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
              {review.author}
            </cite>
            <div className="flex items-center gap-2 text-[11px] text-white/35">
              <StarRow count={review.rating} size="sm" />
              <span>{review.relativeDateLv}</span>
            </div>
          </footer>
        </blockquote>
      ))}
    </div>
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

  return (
    <div className="w-full">
      {/* Mobile / tablet — viena kolonna */}
      <div className="flex flex-col items-center text-center lg:hidden">
        {quoteBlock}
        <div className="flex justify-center">{dots}</div>
        <div className="mt-8 flex w-full flex-col items-center border-t border-white/[0.08] pt-6">
          {trustRail}
        </div>
      </div>

      {/* Desktop — hero 12 kol. / 7+5 */}
      <div className="hidden lg:grid lg:grid-cols-12 lg:items-start lg:gap-16">
        <div className="min-w-0 lg:col-span-7">
          {quoteBlock}
          {dots}
        </div>
        <div className="min-w-0 lg:col-span-5 lg:flex lg:justify-end">
          <div className="w-full max-w-[27.5rem] border-l border-white/[0.08] pl-8 pt-1">
            {trustRail}
            <p className="mt-5 max-w-[28ch] text-[13px] leading-relaxed text-white/35">
              {trustAside}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
