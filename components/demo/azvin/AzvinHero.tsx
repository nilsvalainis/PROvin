"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "@/app/test-pricing-5/test-pricing-5.module.css";
import { HeroVisual } from "@/components/HeroVisual";
import { AzvinBrandMark } from "@/components/demo/azvin/AzvinBrandMark";
import { AzvinFeatureIconRow } from "@/components/demo/azvin/AzvinFeatureIconRow";
import { AzvinPricingCard } from "@/components/demo/azvin/AzvinPricingCard";
import {
  getAzvinHeroCopy,
  sumAzvinSelectedAzn,
  type AzvinLocale,
  type AzvinServiceId,
} from "@/lib/azvin-hero-copy";
import { readAzvinLocale, subscribeAzvinLocale } from "@/lib/azvin-locale";
import { isValidVinOrPlate, normalizeVin } from "@/lib/order-field-validation";

export function AzvinHero() {
  const [locale, setLocale] = useState<AzvinLocale>("az");
  const [selected, setSelected] = useState<Set<AzvinServiceId>>(() => new Set());
  const [vin, setVin] = useState("");
  const [vinError, setVinError] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [demoNote, setDemoNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLocale(readAzvinLocale());
    return subscribeAzvinLocale((next) => {
      setLocale(next);
      setGlobalError(null);
      setDemoNote(null);
      setVinError(null);
    });
  }, []);

  const copy = getAzvinHeroCopy(locale);
  const totalAzn = sumAzvinSelectedAzn(selected);

  const onToggleService = useCallback((id: AzvinServiceId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setGlobalError(null);
    setDemoNote(null);
  }, []);

  const onSubmit = useCallback(() => {
    setGlobalError(null);
    setDemoNote(null);

    if (totalAzn <= 0) {
      setGlobalError(copy.ctaSelectHint);
      return;
    }

    const normalized = normalizeVin(vin);
    if (!isValidVinOrPlate(normalized)) {
      setVinError(copy.vinInvalid);
      setGlobalError(copy.vinInvalid);
      return;
    }
    setVinError(null);
    setLoading(true);
    window.setTimeout(() => {
      setLoading(false);
      setDemoNote(copy.ctaDemoNote);
    }, 400);
  }, [copy.ctaDemoNote, copy.ctaSelectHint, copy.vinInvalid, totalAzn, vin]);

  const cardProps = {
    copy,
    selected,
    onToggleService,
    totalAzn,
    vin,
    vinError,
    globalError,
    demoNote,
    loading,
    onVinChange: setVin,
    onSubmit,
  };

  return (
    <div className={styles.heroPricingShell}>
      <section
        id="azvin-hero"
        className={styles.heroSurface}
        aria-labelledby="azvin-hero-title"
      >
        <div className={styles.heroAmbientGlow} aria-hidden />
        <div className={styles.heroBackdrop} aria-hidden>
          <HeroVisual />
        </div>
        <div className={styles.heroScrim} aria-hidden />

        <div className={styles.heroInnerMobile}>
          <header className={styles.heroCopy}>
            <h1 id="azvin-hero-title" className={styles.heroTitle}>
              {copy.titlePrefix}
              <span className={`${styles.heroTitleAccent} text-[#2563EB]`}>
                {copy.titleAccent}
              </span>
            </h1>
            <AzvinFeatureIconRow copy={copy} forceVisible />
          </header>

          <div className={styles.stage}>
            <AzvinPricingCard {...cardProps} />
          </div>
        </div>

        <div className={styles.heroInnerDesktop}>
          <header className={styles.heroCopyDesktop}>
            <h1 id="azvin-hero-title-desktop" className={styles.heroTitleDesktop}>
              {copy.titlePrefix}
              <span className={`${styles.heroTitleAccent} text-[#2563EB]`}>
                {copy.titleAccent}
              </span>
            </h1>
            <p className={styles.heroSubheadDesktop}>
              <AzvinBrandMark className="font-semibold" />
              {" — "}
              {copy.cardDescription}
            </p>
            <AzvinFeatureIconRow copy={copy} />
          </header>

          <div className={`${styles.stage} ${styles.heroStageDesktop}`}>
            <AzvinPricingCard {...cardProps} />
          </div>
        </div>
      </section>
    </div>
  );
}
