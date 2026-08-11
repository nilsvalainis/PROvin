"use client";

import { Globe } from "lucide-react";
import { type SyntheticEvent, type TouchEvent } from "react";
import { useLocale } from "next-intl";
import styles from "@/app/test-pricing-5/test-pricing-5.module.css";
import type { Tp5InlineFieldErrors } from "@/lib/test-pricing-5-inline-checkout";
import {
  getTp5HeroTabServices,
  getTp5MobileService,
  getTp5MobileTurnaround,
  type Tp5MobileFeature,
  type Tp5MobileServiceId,
} from "@/lib/test-pricing-5-mobile";
import {
  TP5_AUDITS_SAMPLE_REPORT_HREF,
  TP5_DEALER_SAMPLE_REPORT_HREF,
  TP5_MINI_SAMPLE_REPORT_HREF,
  getTp5UiCopy,
  type Tp5UiCopy,
} from "@/lib/test-pricing-5-ui-copy";
import { recordSampleReportClick } from "@/lib/sample-report-click-client";
import { Tp5DealerBrandsTip } from "@/components/test-pricing-5/Tp5DealerBrandsTip";
import { Tp5TurnaroundInfoTip } from "@/components/test-pricing-5/Tp5TurnaroundInfoTip";

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
  brands,
  uiCopy,
}: {
  feature: Tp5MobileFeature;
  brands: readonly string[];
  uiCopy: Pick<Tp5UiCopy, "dealerBrandsTrigger" | "dealerBrandsAria" | "dealerBrandsClose">;
}) {
  return (
    <div className={styles.dealerFeatureHighlight} role="listitem">
      <Globe className={styles.dealerFeatureIcon} aria-hidden />
      <div className={styles.dealerFeatureCopy}>
        <p className={styles.dealerFeatureTitle}>{feature.name}</p>
        {feature.subtitle ? <p className={styles.dealerFeatureSubtitle}>{feature.subtitle}</p> : null}
        {brands.length > 0 ? (
          <div className={styles.dealerBrandsUnderSubtitle}>
            <Tp5DealerBrandsTip brands={brands} copy={uiCopy} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MobileFeatureRow({ feature }: { feature: Tp5MobileFeature }) {
  if (feature.tone === "info") {
    return (
      <li className={styles.featureRowPlain}>
        <span className={styles.featureLabelInfo}>{feature.name}</span>
      </li>
    );
  }

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

  if (feature.tone === "soft") {
    return (
      <li className={styles.featureRow}>
        <span className={`${styles.featureMark} ${styles.featureMarkSoft}`} aria-hidden>
          —
        </span>
        <span className={styles.featureLabelSoft}>{feature.name}</span>
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
  tabLayoutGroupId?: string;
  tabPillLayoutId?: string;
  tierMetaDescClassName?: string;
  onSwipeAreaTouchStart?: (event: TouchEvent) => void;
  onSwipeAreaTouchMove?: (event: TouchEvent) => void;
  onSwipeAreaTouchEnd?: (event: TouchEvent) => void;
  onSwipeAreaTouchCancel?: (event: TouchEvent) => void;
  stopSwipePropagation?: (event: SyntheticEvent) => void;
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
  tabLayoutGroupId: _tabLayoutGroupId = "tp5-tabs-mobile",
  tabPillLayoutId: _tabPillLayoutId = "tp5-tab-pill-mobile",
  tierMetaDescClassName,
  onSwipeAreaTouchStart,
  onSwipeAreaTouchMove,
  onSwipeAreaTouchEnd,
  onSwipeAreaTouchCancel,
  stopSwipePropagation,
}: Tp5MobilePricingCardProps) {
  const locale = useLocale();
  const uiCopy = getTp5UiCopy(locale);
  const services = getTp5HeroTabServices(activeServiceId, locale);
  const activeService = getTp5MobileService(activeServiceId, locale);
  const isDealer = activeServiceId === "dealer";
  const isAudits = activeServiceId === "audits";
  const isMini = activeServiceId === "mini";
  const turnaroundLabel = activeService.turnaround ?? getTp5MobileTurnaround(locale);
  const sampleReportHref = isDealer
    ? TP5_DEALER_SAMPLE_REPORT_HREF
    : isAudits
      ? TP5_AUDITS_SAMPLE_REPORT_HREF
      : isMini
        ? TP5_MINI_SAMPLE_REPORT_HREF
        : null;
  return (
    <article
      className={`${styles.spatialCard} w-full`}
      onTouchStart={onSwipeAreaTouchStart}
      onTouchMove={onSwipeAreaTouchMove}
      onTouchEnd={onSwipeAreaTouchEnd}
      onTouchCancel={onSwipeAreaTouchCancel}
    >
      <div className={styles.cardHeader}>
        <div
          className={`${styles.tierSwitcher}${services.length >= 4 ? ` ${styles.tierSwitcherFour}` : ""}`}
          role="tablist"
          aria-label={uiCopy.packageTabsAria}
        >
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
            <p className={tierMetaDescClassName ?? styles.tierMetaDesc}>{activeService.description}</p>
          </div>
        ) : null}
      </div>

      <div className={styles.featureStack}>
        <div className={styles.liquidAccent} data-tier={activeServiceId}>
          {isDealer && activeService.features[0] ? (
            <div className={styles.dealerUnifiedPanel}>
              <DealerFeatureHighlight
                feature={activeService.features[0]}
                brands={activeService.brands ?? []}
                uiCopy={uiCopy}
              />
              <hr className={styles.dealerUnifiedDivider} aria-hidden />
              <p className={styles.dealerRefundBanner}>{uiCopy.dealerRefundBanner}</p>
            </div>
          ) : (
            <ul className={styles.featureList}>
              {activeService.features.map((feature) => (
                <MobileFeatureRow key={`${activeServiceId}-${feature.name}`} feature={feature} />
              ))}
            </ul>
          )}
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

      <p className={styles.turnaround}>
        <span>{turnaroundLabel}</span>
        {!isDealer ? (
          <>
            <span className={styles.turnaroundDivider} aria-hidden>
              |
            </span>
            <Tp5TurnaroundInfoTip copy={uiCopy} />
          </>
        ) : null}
      </p>

      <div className={styles.ctaWrap}>
        {globalError ? <p className={styles.checkoutError}>{globalError}</p> : null}
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
            onClick={() => recordSampleReportClick()}
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
