"use client";

import { useEffect, useState } from "react";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";
import {
  homeEditorialPunchlineAccentClass,
  homeEditorialPunchlineClass,
  homeEditorialPunchlineLeadClass,
  homeEditorialSectionBodyLeadClass,
  homeEditorialSectionTitleClass,
} from "@/lib/home-layout";
import { getAzvinAboutCopy } from "@/lib/azvin-about-copy";
import { AZVIN_DEALER_BRANDS } from "@/lib/azvin-dealer-brands";
import type { AzvinLocale } from "@/lib/azvin-hero-copy";
import { readAzvinLocale, subscribeAzvinLocale } from "@/lib/azvin-locale";
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
      className={`demo-design-dir__section home-body-ink scroll-mt-16 py-14 sm:py-18 md:py-20 ${styles.aboutSection}`}
      aria-labelledby="azvin-about-heading"
    >
      <div className="demo-design-dir__shell">
        <header className={`text-center ${styles.aboutIntro}`}>
          <p className={styles.aboutEyebrow}>{copy.eyebrow}</p>
          <h2 id="azvin-about-heading" className={homeEditorialSectionTitleClass}>
            {copy.title}
          </h2>
          <div className="mx-auto mt-3 w-full max-w-[min(100%,42rem)] px-1 sm:px-2">
            <DiagnosticScanLine variant="rail" motion="alongPingPong" className="w-full" />
          </div>
          <p className={homeEditorialSectionBodyLeadClass}>{copy.lead}</p>
        </header>

        <div className={`${styles.aboutBlock} ${styles.aboutPanel}`}>
          <h3 className={styles.aboutBlockTitle}>{copy.directionsTitle}</h3>
          <div className={styles.directionsGrid}>
            {copy.directions.map((direction) => (
              <article key={direction.id} className={styles.directionCard} data-direction={direction.id}>
                <h4 className={styles.directionTitle}>{direction.title}</h4>
                <p className={styles.directionBody}>{direction.body}</p>
                {direction.accent ? <p className={styles.directionAccent}>{direction.accent}</p> : null}
              </article>
            ))}
          </div>
        </div>

        <div className={`${styles.aboutBlock} ${styles.aboutPanel}`}>
          <h3 className={styles.aboutBlockTitle}>{copy.brandsTitle}</h3>
          <p className={styles.aboutBlockLead}>{copy.brandsLead}</p>
          <ul className={styles.brandsGrid}>
            {AZVIN_DEALER_BRANDS.map((brand) => (
              <li key={brand} className={styles.brandItem}>
                <span className={styles.brandCheck} aria-hidden>
                  ✓
                </span>
                <span>{brand}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.aboutCloser}>
          <p className={`${homeEditorialPunchlineClass} ${styles.aboutPunchline}`}>
            <span className={homeEditorialPunchlineLeadClass}>{copy.punchlineLead}</span>
            <span className={homeEditorialPunchlineAccentClass}>{copy.punchlineAccent}</span>
          </p>
          <a href="#azvin-hero" className={styles.aboutCta}>
            {copy.ctaLabel}
          </a>
        </div>
      </div>
    </section>
  );
}
