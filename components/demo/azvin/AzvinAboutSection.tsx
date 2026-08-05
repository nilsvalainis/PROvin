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
      className={`demo-design-dir__section home-body-ink scroll-mt-16 py-16 sm:py-20 md:py-24 ${styles.aboutSection}`}
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
          <p className={`${homeEditorialSectionBodyLeadClass} ${styles.aboutMission}`}>{copy.mission}</p>
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
          <h3 className={styles.aboutBlockTitle}>{copy.differentTitle}</h3>
          <div className={styles.differentGrid}>
            {copy.different.map((item) => (
              <article key={item.title} className={styles.differentCard}>
                <h4 className={styles.differentTitle}>{item.title}</h4>
                <p className={styles.differentBody}>{item.body}</p>
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

        <div className={`${styles.aboutBlock} ${styles.aboutPanel}`}>
          <h3 className={styles.aboutBlockTitle}>{copy.reportTitle}</h3>
          <p className={styles.aboutBlockLead}>{copy.reportLead}</p>
          <ul className={styles.reportList}>
            {copy.reportItems.map((item) => (
              <li key={item} className={styles.reportItem}>
                <span className={styles.brandCheck} aria-hidden>
                  ✓
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={`${styles.aboutBlock} ${styles.aboutPanel}`}>
          <h3 className={styles.aboutBlockTitle}>{copy.trustTitle}</h3>
          <ul className={styles.trustList}>
            {copy.trust.map((item) => (
              <li key={item} className={styles.trustItem}>
                <span className={styles.brandCheck} aria-hidden>
                  ✓
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={`${styles.aboutBlock} ${styles.aboutPanel}`}>
          <h3 className={styles.aboutBlockTitle}>{copy.statsTitle}</h3>
          <div className={styles.statsGrid}>
            {copy.stats.map((stat) => (
              <div key={stat.label} className={styles.statCard}>
                <p className={styles.statValue}>{stat.value}</p>
                <p className={styles.statLabel}>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className={`${styles.aboutBlock} ${styles.aboutPanel} ${styles.aboutContact}`}>
          <h3 className={styles.aboutBlockTitle}>{copy.contactTitle}</h3>
          <p className={styles.aboutBlockLead}>{copy.contactBody}</p>
          <a href="#azvin-hero" className={styles.aboutCta}>
            {copy.ctaLabel}
          </a>
        </div>

        <p className={`${homeEditorialPunchlineClass} ${styles.aboutPunchline}`}>
          <span className={homeEditorialPunchlineLeadClass}>{copy.punchlineLead}</span>
          <span className={homeEditorialPunchlineAccentClass}>{copy.punchlineAccent}</span>
        </p>
      </div>
    </section>
  );
}
