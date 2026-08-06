"use client";

import { useEffect, useState } from "react";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";
import { getAzvinAboutCopy } from "@/lib/azvin-about-copy";
import type { AzvinLocale } from "@/lib/azvin-hero-copy";
import { readAzvinLocale, subscribeAzvinLocale } from "@/lib/azvin-locale";
import { TP5_DEALER_BRANDS } from "@/lib/test-pricing-5-mobile";
import styles from "@/app/[locale]/demo/azvin/azvin.module.css";

export function AzvinAboutSection() {
  const [locale, setLocale] = useState<AzvinLocale>("az");

  useEffect(() => {
    setLocale(readAzvinLocale());
    return subscribeAzvinLocale(setLocale);
  }, []);

  const copy = getAzvinAboutCopy(locale);

  return (
    <section
      id={copy.sectionId}
      className={styles.aboutSection}
      aria-labelledby="azvin-about-heading"
    >
      <div className={styles.aboutCanvas}>
        <header className={styles.aboutHeader}>
          <p className={styles.aboutEyebrow}>{copy.eyebrow}</p>
          <h2 id="azvin-about-heading" className={styles.aboutTitle}>
            {copy.title}
          </h2>
          <DiagnosticScanLine variant="rail" motion="alongPingPong" className="w-full" />
          <p className={styles.aboutLead}>{copy.lead}</p>
        </header>

        <div>
          <h3 className={styles.blockTitle}>{copy.bentoTitle}</h3>
          <div className={styles.bentoGrid}>
            {copy.bento.map((tile) => (
              <article
                key={tile.id}
                className={`${styles.bentoTile} ${tile.accent ? styles.bentoTileSoon : ""}`}
              >
                <h4 className={styles.bentoTitle}>{tile.title}</h4>
                <p className={styles.bentoBody}>{tile.body}</p>
                {tile.accent ? <p className={styles.bentoAccent}>{tile.accent}</p> : null}
              </article>
            ))}
          </div>
        </div>

        <div>
          <h3 className={styles.blockTitle}>{copy.brandsTitle}</h3>
          <ul className={styles.brandChips}>
            {TP5_DEALER_BRANDS.map((brand) => (
              <li key={brand} className={styles.brandChip}>
                {brand}
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.aboutCloser}>
          <p className={styles.punchline}>
            <span className={styles.punchlineLead}>{copy.punchlineLead}</span>
            <span className={styles.punchlineAccent}>{copy.punchlineAccent}</span>
          </p>
          <a href="#azvin-hero" className={styles.aboutCta}>
            {copy.ctaLabel}
          </a>
        </div>
      </div>
    </section>
  );
}
