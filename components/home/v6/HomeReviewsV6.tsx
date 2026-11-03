"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { getHomeV6HeroCopy } from "@/lib/home-hero-v6-copy";
import { GOOGLE_REVIEWS, getGoogleReviewsProfileUrl } from "@/lib/google-reviews-data";
import styles from "./sections-v6.module.css";

function initials(name: string): string {
  return name
    .replace(/[_-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

function ReviewCard({ author, text, readAll }: { author: string; text: string; readAll: string }) {
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) setLong(el.scrollHeight > el.clientHeight + 2);
  }, []);
  return (
    <article className={styles.review}>
      <i className={styles.stars} aria-label="5/5">
        ★★★★★
      </i>
      <p ref={ref} className={`${styles.reviewText}${open ? ` ${styles.reviewOpen}` : ""}`}>
        „{text}”
      </p>
      {long && !open ? (
        <button type="button" className={styles.reviewMore} onClick={() => setOpen(true)}>
          {readAll}
        </button>
      ) : null}
      <footer className={styles.reviewBy}>
        <span aria-hidden>{initials(author)}</span>
        <div>
          <b>{author}</b>
          <small>Google</small>
        </div>
      </footer>
    </article>
  );
}

/** «Ko saka pircēji» - visas 7 atsauksmes slīdnī bloka platumā, bez datumiem. */
export function HomeReviewsV6() {
  const locale = useLocale();
  const c = getHomeV6HeroCopy(locale).reviews;
  const track = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const update = () => {
    const el = track.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft < 4, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 4 });
  };

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const go = (dir: -1 | 1) => {
    const el = track.current;
    if (!el) return;
    const card = el.querySelector("article");
    const step = card ? card.getBoundingClientRect().width + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  return (
    <section id="atsauksmes" className={styles.section} aria-labelledby="atsauksmes-h">
      <div className={styles.wrap}>
        <div className={styles.reviewsHead}>
          <div>
            <p className={styles.kicker}>{c.kicker}</p>
            <h2 id="atsauksmes-h" className={styles.h2}>
              {c.title}
            </h2>
          </div>
          <a className={styles.ratingBadge} href={getGoogleReviewsProfileUrl()} target="_blank" rel="noopener noreferrer">
            <b>5,0</b>
            <span>
              <i aria-hidden>★★★★★</i>
              {c.ratingNote}
            </span>
          </a>
        </div>
        <div ref={track} className={styles.track} onScroll={update}>
          {GOOGLE_REVIEWS.map((r) => (
            <ReviewCard key={r.id} author={r.author} text={r.text} readAll={c.readAll} />
          ))}
        </div>
        <div className={styles.trackNav}>
          <button type="button" aria-label={c.prev} disabled={edge.start} onClick={() => go(-1)}>
            ‹
          </button>
          <button type="button" aria-label={c.next} disabled={edge.end} onClick={() => go(1)}>
            ›
          </button>
        </div>
      </div>
    </section>
  );
}
