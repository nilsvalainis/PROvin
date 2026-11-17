"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useLocale } from "next-intl";
import {
  HOME_V6_CASE_EVENTS,
  HOME_V6_PRICE_PHASE,
  formatHomeV6Eur,
  formatHomeV6Km,
  getHomeV6Copy,
} from "@/lib/home-v6-copy";
import styles from "./home-case-timeline.module.css";

const STEP_MS = 5500;
const SPARK_MIN = 31500;
const SPARK_MAX = 35000;
const SPARK_W = 1000;
const SPARK_H = 90;

const vars = (v: Record<string, string | number>) => v as CSSProperties;

const FLAT = HOME_V6_CASE_EVENTS.flatMap((phase, a) => phase.map((e, i) => ({ a, i, e })));

/** Pēdējā zināmā vērtība līdz notikumam (ieskaitot), ja tajā pašā datu nav. */
function lastKnown(a: number, i: number, key: "km" | "price"): number | null {
  for (let n = FLAT.length - 1; n >= 0; n--) {
    const f = FLAT[n]!;
    if ((f.a < a || (f.a === a && f.i <= i)) && f.e[key] != null) return f.e[key];
  }
  return null;
}

function CrossIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3.5L22 20H2z" />
      <path d="M12 10v4.5M12 17.5v.01" />
    </svg>
  );
}

const TAB_CLASS = ["", `${styles.tabRed} ${styles.tabDamage}`, styles.tabRed, styles.tabProvin];

/** Sākumlapa v6: VW gadījums - hronoloģija pa fāzēm ar automātisku pāreju. */
export function HomeCaseTimeline({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const c = getHomeV6Copy(locale).caseStudy;
  const [cur, setCur] = useState({ act: 0, ev: 0 });
  const { act, ev } = cur;
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const step = useCallback(() => {
    setCur(({ act: a, ev: i }) =>
      i < HOME_V6_CASE_EVENTS[a]!.length - 1 ? { act: a, ev: i + 1 } : { act: (a + 1) % HOME_V6_CASE_EVENTS.length, ev: 0 },
    );
  }, []);

  useEffect(() => {
    if (paused || reduced) return;
    const id = window.setInterval(step, STEP_MS);
    return () => window.clearInterval(id);
  }, [paused, reduced, step]);

  const selectPhase = (a: number) => {
    setPaused(true);
    setCur({ act: a, ev: 0 });
  };
  const selectEvent = (i: number) => {
    setPaused(true);
    setCur((prev) => ({ ...prev, ev: i }));
  };

  const phase = HOME_V6_CASE_EVENTS[act]!;
  const data = phase[ev]!;
  const text = c.events[act]![ev]!;
  const km = lastKnown(act, ev, "km");
  const price = lastKnown(act, ev, "price");
  const pos = FLAT.findIndex((f) => f.a === act && f.i === ev);
  const progress = ((pos + 1) / FLAT.length) * 100;
  const panelTone = data.kind === 3 ? styles.panelProvin : data.kind > 0 ? styles.panelRed : "";

  const spark =
    act === HOME_V6_PRICE_PHASE
      ? phase.map((e, i) => {
          const v = e.price ?? SPARK_MIN;
          return {
            x: i * (SPARK_W / phase.length) + 7,
            y: SPARK_H - ((v - SPARK_MIN) / (SPARK_MAX - SPARK_MIN)) * SPARK_H,
          };
        })
      : null;

  const badges = (extra: string) => (
    <div className={`${styles.badges} ${extra}`}>
      {c.badges.map((b) => (
        <span key={b}>
          <CrossIcon />
          {b}
        </span>
      ))}
    </div>
  );

  return (
    <section
      id="ko-atradam"
      aria-labelledby="home-case-timeline-title"
      className={`${styles.section} ${className}`.trim()}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mx-auto min-w-0 w-full max-w-[75rem]">
        <div className={styles.head}>
          <div>
            <p className={styles.kicker}>{c.kicker}</p>
            <h2 id="home-case-timeline-title" className={styles.title}>
              {c.title}
            </h2>
          </div>
          <p className={styles.facts}>{c.facts}</p>
        </div>
        {badges(styles.badgesTop)}
        <p className={styles.lead}>{c.lead}</p>

        <div className={styles.progress} aria-hidden>
          <i style={{ width: `${progress}%` }} />
        </div>
        <div className={styles.tabs} role="tablist" aria-label={c.title}>
          {c.phases.map((p, a) => (
            <button
              key={p.title}
              type="button"
              role="tab"
              aria-selected={a === act}
              aria-controls="home-case-timeline-stage"
              className={`${styles.tab} ${TAB_CLASS[a] ?? ""} ${a === act ? styles.tabOn : ""}`}
              onClick={() => selectPhase(a)}
            >
              <b>
                {a === 1 ? (
                  <i className={styles.tri} role="img" aria-label={`${c.damageAria} · ${p.title}`}>
                    <WarnIcon />
                  </i>
                ) : (
                  p.title
                )}
              </b>
              <span>{p.subtitle}</span>
              <em>{HOME_V6_CASE_EVENTS[a]!.length}</em>
            </button>
          ))}
        </div>

        <div className={styles.grid}>
          <div className={styles.stage} id="home-case-timeline-stage" role="tabpanel">
            <div key={act} className={styles.events} style={vars({ "--n": phase.length })}>
              {phase.map((e, i) => (
                <button
                  key={`${e.date}-${i}`}
                  type="button"
                  className={`${styles.event} ${styles[`k${e.kind}`] ?? ""} ${i < ev ? styles.past : ""} ${i === ev ? styles.eventOn : ""}`}
                  style={vars({ "--j": i })}
                  aria-pressed={i === ev}
                  onMouseEnter={() => selectEvent(i)}
                  onClick={() => selectEvent(i)}
                >
                  <i aria-hidden />
                  <time>{e.date}</time>
                  <b>{c.events[act]![i]!.title}</b>
                </button>
              ))}
            </div>
            {spark ? (
              <svg key={`spark-${act}`} className={styles.spark} viewBox={`0 -14 ${SPARK_W} 120`} preserveAspectRatio="none" aria-hidden>
                <polyline points={spark.map((q) => `${q.x},${q.y}`).join(" ")} />
                {spark.map((q, i) => (
                  <circle
                    key={i}
                    cx={q.x}
                    cy={q.y}
                    r={5}
                    className={i === ev ? styles.dotOn : ""}
                    onMouseEnter={() => selectEvent(i)}
                    onClick={() => selectEvent(i)}
                  />
                ))}
              </svg>
            ) : null}
            {badges(styles.badgesSide)}
          </div>

          <aside className={`${styles.panel} ${panelTone}`} aria-live="polite">
            <div key={`${act}-${ev}`} className={styles.flash}>
              <time>{data.date}</time>
              <h3>{text.title}</h3>
              <p>{text.text}</p>
              <dl>
                <div>
                  <dt>{c.panelOdometer}</dt>
                  <dd>{km != null ? formatHomeV6Km(km, locale) : "-"}</dd>
                </div>
                <div>
                  <dt>{c.panelPrice}</dt>
                  <dd>{price != null ? formatHomeV6Eur(price, locale) : "-"}</dd>
                </div>
                <div>
                  <dt>{c.panelStatus}</dt>
                  <dd>{text.status}</dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>

        <div className={styles.legend}>
          <span>
            <i className={styles.dotA} />
            {c.legend[0]}
          </span>
          <span>
            <i className={styles.dotB} />
            {c.legend[1]}
          </span>
          <span className={styles.legendRed}>
            <i className={styles.dotR} />
            {c.legend[2]}
          </span>
        </div>
        <p className={styles.confirmed}>
          <b>{c.confirmedStrong}</b> {c.confirmedText}
        </p>
      </div>
    </section>
  );
}
