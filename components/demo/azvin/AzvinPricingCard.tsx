"use client";

import { type SyntheticEvent, type TouchEvent } from "react";
import styles from "@/app/test-pricing-5/test-pricing-5.module.css";
import type { AzvinLocale } from "@/lib/azvin-hero-copy";
import {
  getAzvinMobileService,
  getAzvinMobileServices,
  type AzvinMobileFeature,
  type AzvinServiceId,
} from "@/lib/azvin-mobile-services";
import {
  AZVIN_DEALER_SAMPLE_REPORT_HREF,
  getAzvinUiCopy,
} from "@/lib/azvin-ui-copy";
import { Tp5DealerInlineBrands } from "@/components/test-pricing-5/Tp5DealerInlineBrands";

function SampleReportPdfIcon() {
  return (
    <svg
      className={styles.sampleReportLinkIcon}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M6 2.75A1.75 1.75 0 0 1 7.75 1h3.086a1.75 1.75 0 0 1 1.237.513l2.924 2.924A1.75 1.75 0 0 1 15.5 5.674V16.25A1.75 1.75 0 0 1 13.75 18H7.75A1.75 1.75 0 0 1 6 16.25V2.75Z"
        stroke="currentColor"
        strokeWidth="1.35"
      />
      <path
        d="M10.75 1v3.5A1.25 1.25 0 0 0 12 5.75h3.5"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path
        d="M7.25 10.25h5.5M7.25 12.75h3.5"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DealerFeatureHighlight({
  feature,
  brandsAria,
}: {
  feature: AzvinMobileFeature;
  brandsAria: string;
}) {
  return (
    <div className={styles.dealerFeatureCenter}>
      <div>
        <p className={styles.dealerFeatureTitle}>{feature.name}</p>
        {feature.subtitle ? (
          <p className={styles.dealerFeatureSubtitle}>{feature.subtitle}</p>
        ) : null}
      </div>
      <Tp5DealerInlineBrands brandsAria={brandsAria} />
    </div>
  );
}

function FeatureRow({ feature }: { feature: AzvinMobileFeature }) {
  if (feature.included) {
    return (
      <li className={styles.featureRow}>
        <span className={`${styles.featureMark} ${styles.featureMarkBlue}`} aria-hidden>
          ✓
        </span>
        <span className={styles.featureLabelActive}>{feature.name}</span>
      </li>
    );
  }

  return (
    <li className={styles.featureRow}>
      <span className={`${styles.featureMark} ${styles.featureMarkCross}`} aria-hidden>
        ✕
      </span>
      <span className={styles.featureLabelMuted}>{feature.name}</span>
    </li>
  );
}

export type AzvinFieldErrors = {
  vin?: string;
  listingUrl?: string;
};

type Props = {
  locale: AzvinLocale;
  activeServiceId: AzvinServiceId;
  setActiveServiceId: (id: AzvinServiceId) => void;
  vin: string;
  listingUrl: string;
  errors: AzvinFieldErrors;
  globalError: string | null;
  demoNote: string | null;
  loading: boolean;
  onVinChange: (value: string) => void;
  onListingUrlChange: (value: string) => void;
  onSubmit: () => void;
  tabLayoutGroupId?: string;
  tabPillLayoutId?: string;
  onSwipeAreaTouchStart?: (event: TouchEvent) => void;
  onSwipeAreaTouchMove?: (event: TouchEvent) => void;
  onSwipeAreaTouchEnd?: (event: TouchEvent) => void;
  onSwipeAreaTouchCancel?: (event: TouchEvent) => void;
  stopSwipePropagation?: (event: SyntheticEvent) => void;
};

export function AzvinPricingCard({
  locale,
  activeServiceId,
  setActiveServiceId,
  vin,
  listingUrl,
  errors,
  globalError,
  demoNote,
  loading,
  onVinChange,
  onListingUrlChange,
  onSubmit,
  tabLayoutGroupId: _tabLayoutGroupId = "azvin-tabs-mobile",
  tabPillLayoutId: _tabPillLayoutId = "azvin-tab-pill-mobile",
  onSwipeAreaTouchStart,
  onSwipeAreaTouchMove,
  onSwipeAreaTouchEnd,
  onSwipeAreaTouchCancel,
  stopSwipePropagation,
}: Props) {
  const uiCopy = getAzvinUiCopy(locale);
  const services = getAzvinMobileServices(locale);
  const activeService = getAzvinMobileService(activeServiceId, locale);
  const isDealer = activeService.layout === "dealer";
  const turnaroundLabel = activeService.turnaround ?? "";
  const sampleReportHref = isDealer ? AZVIN_DEALER_SAMPLE_REPORT_HREF : null;
  const refundBannerText = activeService.refundBanner ?? uiCopy.dealerRefundBanner;

  return (
    <article
      className={`${styles.spatialCard} w-full`}
      onTouchStart={onSwipeAreaTouchStart}
      onTouchMove={onSwipeAreaTouchMove}
      onTouchEnd={onSwipeAreaTouchEnd}
      onTouchCancel={onSwipeAreaTouchCancel}
    >
      <div className={styles.cardHeader}>
        <div className={styles.tierSwitcher} role="tablist" aria-label={uiCopy.packageTabsAria}>
          {services.map((service) => {
            const active = activeServiceId === service.id;
            return (
              <button
                key={service.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={`${service.title}${uiCopy.packageAriaSuffix}`}
                className={styles.tierTabBtn}
                onClick={() => setActiveServiceId(service.id)}
              >
                <span
                  className={`${styles.tierTabLabel} ${styles.tierTabLabelCompact} ${active ? styles.tierTabLabelActive : styles.tierTabLabelInactive}`}
                >
                  {service.title}
                </span>
              </button>
            );
          })}
        </div>

        {activeService.description.trim() ? (
          <div className={styles.tierMeta} aria-live="polite">
            <p className={styles.tierMetaTitle}>{activeService.title}</p>
            <p className={styles.tierMetaDesc}>{activeService.description}</p>
          </div>
        ) : null}
      </div>

      <div className={styles.featureStack}>
        <div className={styles.liquidAccent} data-tier={activeServiceId}>
          {isDealer && activeService.features[0] ? (
            <DealerFeatureHighlight
              feature={activeService.features[0]}
              brandsAria={uiCopy.dealerBrandsAria}
            />
          ) : (
            <ul className={styles.featureList}>
              {activeService.features.map((feature) => (
                <FeatureRow key={`${activeServiceId}-${feature.name}`} feature={feature} />
              ))}
            </ul>
          )}
          {activeService.extraNote ? (
            <p className={styles.featureFootnote}>{activeService.extraNote}</p>
          ) : null}
        </div>

        <div
          className={styles.inlineFields}
          onTouchStart={stopSwipePropagation}
          onTouchMove={stopSwipePropagation}
          onTouchEnd={stopSwipePropagation}
          onTouchCancel={stopSwipePropagation}
        >
          <input
            type="text"
            className={`${styles.inlineInput} ${errors.vin ? styles.inlineInputError : ""}`}
            value={vin}
            onChange={(event) => onVinChange(event.target.value.toUpperCase())}
            placeholder={uiCopy.vinPlaceholder}
            aria-label={uiCopy.vinAria}
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
            placeholder={uiCopy.listingPlaceholder}
            aria-label={uiCopy.listingAria}
            autoComplete="url"
            inputMode="url"
          />
          {errors.listingUrl ? (
            <p className={styles.inlineFieldError}>{errors.listingUrl}</p>
          ) : null}
        </div>
      </div>

      {turnaroundLabel ? <p className={styles.turnaround}>{turnaroundLabel}</p> : null}

      <div className={styles.ctaWrap}>
        {activeService.showRefundBanner ? (
          <p className={styles.dealerRefundBanner}>{refundBannerText}</p>
        ) : null}
        {globalError ? <p className={styles.checkoutError}>{globalError}</p> : null}
        {demoNote ? <p className={styles.checkoutError} style={{ color: "#93c5fd" }}>{demoNote}</p> : null}
        <button type="button" className={styles.liquidCta} onClick={onSubmit} disabled={loading}>
          <span className={styles.liquidCtaShimmer} aria-hidden />
          <span className={styles.liquidCtaLabel}>{activeService.buttonText}</span>
        </button>
        {sampleReportHref ? (
          <a
            href={sampleReportHref}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.sampleReportLink}
          >
            <SampleReportPdfIcon />
            <span>{uiCopy.sampleReportLink}</span>
          </a>
        ) : (
          <span className={styles.sampleReportLinkSpacer} aria-hidden />
        )}
      </div>
    </article>
  );
}
