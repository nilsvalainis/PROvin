import { getLocale } from "next-intl/server";
import { getHomeV6HeroCopy } from "@/lib/home-hero-v6-copy";
import styles from "./sections-v6.module.css";

/** ES zvaigžņu aplis (12 zvaigznes) - lēni griežas. */
function StarRing() {
  const stars = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    return { x: 50 + Math.cos(a) * 38, y: 50 + Math.sin(a) * 38 };
  });
  return (
    <svg className={styles.ring} viewBox="0 0 100 100" aria-hidden focusable="false">
      <g>
        {stars.map((s, i) => (
          <path
            key={i}
            transform={`translate(${s.x.toFixed(2)} ${s.y.toFixed(2)}) scale(0.55)`}
            d="M0-6l1.76 3.58 3.95.57-2.86 2.79.68 3.93L0 3.01l-3.53 1.86.68-3.93-2.86-2.79 3.95-.57z"
          />
        ))}
      </g>
    </svg>
  );
}

/** «Pilnīgākais vēstures datu pārklājums Eiropā» - 6 avotu kartītes (hero «Kas iekļauts auditā» mērķis). */
export async function HomeCoverageV6() {
  const locale = await getLocale();
  const c = getHomeV6HeroCopy(locale).coverage;
  return (
    <section id="segums" className={`${styles.section} ${styles.coverage}`} aria-labelledby="segums-h">
      <div className={styles.wrap}>
        <div className={styles.coverHead}>
          <div className={styles.seal}>
            <StarRing />
            <h2 id="segums-h" className={styles.sealTitle}>
              <b>{c.titleAccent}</b> {c.titleRest}
            </h2>
          </div>
          <p className={styles.lead}>{c.lead}</p>
        </div>
        <div className={styles.cards}>
          {c.cards.map((card, j) => (
            <div key={card.title} className={styles.glass} style={{ ["--j" as string]: j }}>
              <b>{card.title}</b>
              <p>{card.body}</p>
            </div>
          ))}
        </div>
        <p className={styles.note}>{c.note}</p>
      </div>
    </section>
  );
}
