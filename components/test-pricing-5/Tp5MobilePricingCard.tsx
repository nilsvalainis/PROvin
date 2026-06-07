"use client";

import { LayoutGroup, motion } from "framer-motion";
import { type SyntheticEvent, type TouchEvent } from "react";
import styles from "@/app/test-pricing-5/test-pricing-5.module.css";
import { TP5_DEALER_FOOTNOTE } from "@/lib/test-pricing-5-checkout-routing";
import type { Tp5InlineFieldErrors } from "@/lib/test-pricing-5-inline-checkout";
import {
  getTp5MobileService,
  TP5_MOBILE_SERVICES,
  TP5_MOBILE_TURNAROUND,
  type Tp5MobileFeature,
  type Tp5MobileServiceId,
} from "@/lib/test-pricing-5-mobile";

const TAB_TRANSITION = { duration: 0.35, ease: [0.4, 0, 0.2, 1] as const };

function MobileFeatureRow({ feature }: { feature: Tp5MobileFeature }) {
  if (feature.included) {
    return (
      <li className={styles.featureRow}>
        <span className={`${styles.featureMark} ${styles.featureMarkBlue}`} aria-hidden>
          ✔️
        </span>
        <span className={styles.featureLabelActive}>{feature.name}</span>
      </li>
    );
  }

  return (
    <li className={styles.featureRow}>
      <span className={`${styles.featureMark} ${styles.featureMarkCross}`} aria-hidden>
        ❌
      </span>
      <span className={styles.featureLabelMuted}>{feature.name}</span>
    </li>
  );
}

type Tp5MobilePricingCardProps = {
  activeServiceId: Tp5MobileServiceId;
  setActiveServiceId: (id: Tp5MobileServiceId) => void;
  vin: string;
  listingUrl: string;
  errors: Tp5InlineFieldErrors;
  globalError: string | null;
  loading: boolean;
  onVinChange: (value: string) => void;
  onListingUrlChange: (value: string) => void;
  onSubmit: () => void;
  onSwipeAreaTouchStart: (event: TouchEvent) => void;
  onSwipeAreaTouchEnd: (event: TouchEvent) => void;
  stopSwipePropagation: (event: SyntheticEvent) => void;
};

export function Tp5MobilePricingCard({
  activeServiceId,
  setActiveServiceId,
  vin,
  listingUrl,
  errors,
  globalError,
  loading,
  onVinChange,
  onListingUrlChange,
  onSubmit,
  onSwipeAreaTouchStart,
  onSwipeAreaTouchEnd,
  stopSwipePropagation,
}: Tp5MobilePricingCardProps) {
  const activeService = getTp5MobileService(activeServiceId);

  return (
    <article className={`${styles.spatialCard} w-full`}>
      <div className={styles.cardHeader}>
        <LayoutGroup id="tp5-tabs-mobile">
          <div
            className={`${styles.tierSwitcher} ${styles.tierSwitcherTwo}`}
            role="tablist"
            aria-label="Izvēlies audita paketi"
          >
            {TP5_MOBILE_SERVICES.map((service) => {
              const active = activeServiceId === service.id;
              return (
                <button
                  key={service.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={`${service.title} pakete`}
                  className={styles.tierTabBtn}
                  onClick={() => setActiveServiceId(service.id)}
                >
                  {active ? (
                    <motion.span
                      layoutId="tp5-tab-pill-mobile"
                      className={styles.tierTabPill}
                      transition={TAB_TRANSITION}
                      aria-hidden
                    />
                  ) : null}
                  <span
                    className={`${styles.tierTabLabel} ${styles.tierTabLabelCompact} ${active ? styles.tierTabLabelActive : styles.tierTabLabelInactive}`}
                  >
                    {service.title}
                  </span>
                </button>
              );
            })}
          </div>
        </LayoutGroup>

        <div className={styles.tierMeta} aria-live="polite">
          <p className={styles.tierMetaTitle}>{activeService.title}</p>
          <p className={styles.tierMetaDesc}>{activeService.description}</p>
        </div>
      </div>

      <div
        className={styles.featureStack}
        onTouchStart={onSwipeAreaTouchStart}
        onTouchEnd={onSwipeAreaTouchEnd}
      >
        <div className={styles.liquidAccent} data-tier={activeServiceId}>
          <ul className={styles.featureList}>
            {activeService.features.map((feature) => (
              <MobileFeatureRow key={`${activeServiceId}-${feature.name}`} feature={feature} />
            ))}
          </ul>
        </div>

        <div
          className={styles.inlineFields}
          onTouchStart={stopSwipePropagation}
          onTouchEnd={stopSwipePropagation}
        >
          <input
            type="text"
            className={`${styles.inlineInput} ${errors.vin ? styles.inlineInputError : ""}`}
            value={vin}
            onChange={(event) => onVinChange(event.target.value.toUpperCase())}
            placeholder="Ievadi VIN kodu"
            aria-label="Ievadi VIN kodu"
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
            maxLength={17}
          />
          {errors.vin ? <p className={styles.inlineFieldError}>{errors.vin}</p> : null}
          <input
            type="url"
            className={`${styles.inlineInput} ${errors.listingUrl ? styles.inlineInputError : ""}`}
            value={listingUrl}
            onChange={(event) => onListingUrlChange(event.target.value)}
            placeholder="Iekopē sludinājuma linku"
            aria-label="Iekopē sludinājuma linku"
            autoComplete="url"
            inputMode="url"
          />
          {errors.listingUrl ? (
            <p className={styles.inlineFieldError}>{errors.listingUrl}</p>
          ) : null}
        </div>
      </div>

      <p className={styles.turnaround}>{TP5_MOBILE_TURNAROUND}</p>

      <div className={styles.ctaWrap}>
        {globalError ? <p className={styles.checkoutError}>{globalError}</p> : null}
        <button type="button" className={styles.liquidCta} onClick={onSubmit} disabled={loading}>
          <span className={styles.liquidCtaShimmer} aria-hidden />
          <span className={styles.liquidCtaLabel}>{activeService.buttonText}</span>
        </button>
        <p className={styles.featureFootnote}>{TP5_DEALER_FOOTNOTE}</p>
      </div>
    </article>
  );
}
