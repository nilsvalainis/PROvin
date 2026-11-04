"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { recordSampleReportClick } from "@/lib/sample-report-click-client";
import { TP5_DEALER_SAMPLE_REPORT_HREF, getTp5UiCopy } from "@/lib/test-pricing-5-ui-copy";
import {
  HOME_V6_MILEAGE_POINTS,
  HOME_V6_OIL_INTERVALS,
  HOME_V6_OIL_NORM_KM,
  formatHomeV6Km,
  formatHomeV6Number,
  getHomeV6Copy,
} from "@/lib/home-v6-copy";
import styles from "./home-dealer-story.module.css";

const VB_W = 640;
const X0 = 34;
const X1 = 606;
const Y_TOP = 46.1;
const Y_BOTTOM = 187.9;
const BASE_Y = 210;

const vars = (v: Record<string, string | number>) => v as CSSProperties;

function chartPoints() {
  const kms = HOME_V6_MILEAGE_POINTS.map((p) => p.km);
  const min = Math.min(...kms);
  const max = Math.max(...kms);
  const step = (X1 - X0) / (HOME_V6_MILEAGE_POINTS.length - 1);
  return HOME_V6_MILEAGE_POINTS.map((p, i) => ({
    ...p,
    x: X0 + i * step,
    y: Y_BOTTOM - ((p.km - min) / (max - min || 1)) * (Y_BOTTOM - Y_TOP),
  }));
}

/** Sākumlapa v6: dīlera dati - nobraukuma līkne un eļļas maiņas intervāli (VW Passat piemērs). */
export function HomeDealerStory({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const c = getHomeV6Copy(locale).dealer;
  const rootRef = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const pts = chartPoints();
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${X1} ${BASE_Y} L${X0} ${BASE_Y} Z`;
  const scale = HOME_V6_OIL_NORM_KM * 2;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      ref={rootRef}
      id="dilera-dati"
      aria-labelledby="home-dealer-story-title"
      className={`${styles.section} ${inView ? styles.isIn : ""} ${className}`.trim()}
    >
      <div className="mx-auto min-w-0 w-full max-w-[75rem]">
        <p className={styles.kicker}>
          <span className={styles.badge}>{c.badge}</span>
          {c.kicker}
        </p>
        <h2 id="home-dealer-story-title" className={styles.title}>
          {c.title}
        </h2>
        <p className={styles.lead}>{c.lead}</p>

        <div className={styles.grid}>
          <div className={styles.chartCol}>
            <svg
              className={`${styles.chart} ${hover !== null ? styles.hov : ""}`}
              viewBox={`0 0 ${VB_W} 230`}
              role="img"
              aria-label={c.chartAria}
            >
              <defs>
                <linearGradient id="home-dealer-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#2563eb" stopOpacity=".28" />
                  <stop offset="1" stopColor="#2563eb" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path className={styles.area} d={area} fill="url(#home-dealer-area)" />
              <path className={styles.line} d={line} />
              {pts.map((p, i) => (
                <g key={p.date} className={`${styles.point} ${hover === i ? styles.pointOn : ""}`} style={vars({ "--j": i })}>
                  <circle cx={p.x} cy={p.y} r={6} />
                  <text x={p.x} y={p.y - 16}>
                    {formatHomeV6Number(p.km, locale)}
                  </text>
                  <text className={styles.date} x={p.x} y={224}>
                    {p.date}
                  </text>
                </g>
              ))}
            </svg>
            <p className={styles.note}>{c.chartNote}</p>
          </div>

          <div className={styles.listCol}>
            <p className={styles.cap}>
              {c.intervalsCaption} <span>{c.intervalsNorm}</span>
            </p>
            {HOME_V6_OIL_INTERVALS.map((iv, i) => {
              const okKm = Math.min(iv.km, HOME_V6_OIL_NORM_KM);
              const overKm = Math.max(0, iv.km - HOME_V6_OIL_NORM_KM);
              const okW = (okKm / scale) * 100;
              const overW = Math.min(100 - okW, (overKm / scale) * 100);
              return (
                <div
                  key={iv.from}
                  className={styles.row}
                  style={vars({ "--j": i + 1 })}
                  onMouseEnter={() => setHover(i + 1)}
                  onMouseLeave={() => setHover(null)}
                >
                  <div className={styles.rowHead}>
                    <time>
                      {iv.from} → {iv.to}
                    </time>
                    <b>{formatHomeV6Km(iv.km, locale)}</b>
                  </div>
                  <div className={styles.bar} aria-hidden>
                    <i className={styles.ok} style={vars({ "--w": `${okW.toFixed(1)}%` })} />
                    <i
                      className={styles.over}
                      style={vars({ "--w": `${overW.toFixed(1)}%`, "--l": `${okW.toFixed(1)}%` })}
                    />
                    <i className={styles.limit} />
                  </div>
                  {overKm > 0 ? (
                    <em className={styles.red}>{c.overNorm.replace("{km}", formatHomeV6Km(overKm, locale))}</em>
                  ) : (
                    <em>{c.withinNorm}</em>
                  )}
                </div>
              );
            })}
            <div className={styles.guarantee}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              <div>
                <b>{c.guaranteeStrong}</b>
                <p>{c.guaranteeText}</p>
              </div>
            </div>
            <div className={styles.actions}>
              <Link href="/?plan=dealer#home-hero" className={styles.cta}>
                {c.cta}
              </Link>
              <a
                href={TP5_DEALER_SAMPLE_REPORT_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.sample}
                onClick={() => recordSampleReportClick()}
              >
                📄 {getTp5UiCopy(locale).sampleReportLink}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
