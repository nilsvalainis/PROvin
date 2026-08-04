"use client";

import { useCallback, useState } from "react";
import styles from "@/app/test-pricing-5/test-pricing-5.module.css";
import { HeroVisual } from "@/components/HeroVisual";
import { AzvinPricingCard } from "@/components/demo/azvin/AzvinPricingCard";
import { AZVIN_HERO_COPY } from "@/lib/azvin-hero-copy";
import { isValidVinOrPlate, normalizeVin } from "@/lib/order-field-validation";

export function AzvinHero() {
  const copy = AZVIN_HERO_COPY;
  const [vin, setVin] = useState("");
  const [vinError, setVinError] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [demoNote, setDemoNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = useCallback(() => {
    setGlobalError(null);
    setDemoNote(null);
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
  }, [copy.ctaDemoNote, copy.vinInvalid, vin]);

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
          </header>

          <div className={styles.stage}>
            <AzvinPricingCard
              vin={vin}
              vinError={vinError}
              globalError={globalError}
              demoNote={demoNote}
              loading={loading}
              onVinChange={setVin}
              onSubmit={onSubmit}
            />
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
              <span className="font-semibold text-white">{copy.brand}</span>
              {" — "}
              {copy.cardDescription}
            </p>
          </header>

          <div className={`${styles.stage} ${styles.heroStageDesktop}`}>
            <AzvinPricingCard
              vin={vin}
              vinError={vinError}
              globalError={globalError}
              demoNote={demoNote}
              loading={loading}
              onVinChange={setVin}
              onSubmit={onSubmit}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
