"use client";

import styles from "@/app/test-pricing-5/test-pricing-5.module.css";
import azvinStyles from "@/app/[locale]/demo/azvin/azvin.module.css";
import { Tp5DealerBrandsTip } from "@/components/test-pricing-5/Tp5DealerBrandsTip";
import {
  AZVIN_DEALER_BRANDS,
  AZVIN_HERO_COPY,
} from "@/lib/azvin-hero-copy";

const FEATURE_MARK_CLASS =
  "inline-flex h-6 w-6 shrink-0 items-center justify-center text-[0.98rem] font-bold leading-none";

type Props = {
  vin: string;
  vinError: string | null;
  globalError: string | null;
  demoNote: string | null;
  loading: boolean;
  onVinChange: (value: string) => void;
  onSubmit: () => void;
};

export function AzvinPricingCard({
  vin,
  vinError,
  globalError,
  demoNote,
  loading,
  onVinChange,
  onSubmit,
}: Props) {
  const copy = AZVIN_HERO_COPY;

  return (
    <article className={`${styles.spatialCard} w-full`}>
      <div className={styles.cardHeader}>
        <p className={azvinStyles.demoBanner}>VIP.VIN · Azerbaijan demo</p>

        <div className={azvinStyles.vinSlot}>
          <input
            type="text"
            className={`${styles.inlineInput} ${vinError ? styles.inlineInputError : ""}`}
            value={vin}
            onChange={(event) => onVinChange(event.target.value.toUpperCase())}
            placeholder={copy.vinPlaceholder}
            aria-label={copy.vinAria}
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
            maxLength={17}
          />
          {vinError ? <p className={styles.inlineFieldError}>{vinError}</p> : null}
        </div>

        <div className={styles.tierMeta} aria-live="polite">
          <p className={styles.tierMetaTitle}>{copy.cardTitle}</p>
          <p className={styles.tierMetaDesc}>{copy.cardDescription}</p>
        </div>
      </div>

      <div className={styles.featureStack}>
        <div className={`${styles.liquidAccent} ${azvinStyles.featureStackCompact}`}>
          <ul className={styles.featureList}>
            {copy.features.map((name) => (
              <li key={name} className={styles.featureRow}>
                <span className={`${FEATURE_MARK_CLASS} text-[#2563EB]`} aria-hidden>
                  ✓
                </span>
                <span className={styles.featureLabelActive}>{name}</span>
              </li>
            ))}
          </ul>
          <div className={styles.dealerBrandsSlot}>
            <Tp5DealerBrandsTip
              brands={AZVIN_DEALER_BRANDS}
              copy={{
                dealerBrandsTrigger: copy.dealerBrandsTrigger,
                dealerBrandsAria: copy.dealerBrandsAria,
                dealerBrandsYearNote: copy.dealerBrandsYearNote,
                dealerBrandsRefundNote: copy.dealerBrandsRefundNote,
                dealerBrandsClose: copy.dealerBrandsClose,
              }}
            />
          </div>
        </div>
      </div>

      <p className={styles.turnaround}>
        <span>{copy.turnaround}</span>
      </p>

      <div className={styles.ctaWrap}>
        {globalError ? <p className={styles.checkoutError}>{globalError}</p> : null}
        {demoNote ? <p className={azvinStyles.demoNote}>{demoNote}</p> : null}
        <button type="button" className={styles.liquidCta} onClick={onSubmit} disabled={loading}>
          <span className={styles.liquidCtaShimmer} aria-hidden />
          <span className={styles.liquidCtaLabel}>{copy.ctaLabel}</span>
        </button>
        <p className={styles.featureFootnote}>{copy.footnote}</p>
      </div>
    </article>
  );
}
