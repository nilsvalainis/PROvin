"use client";

import { LayoutGroup, motion } from "framer-motion";
import { type SyntheticEvent, type TouchEvent } from "react";
import { useLocale } from "next-intl";
import styles from "@/app/test-pricing-5/test-pricing-5.module.css";
import type { Tp5InlineFieldErrors } from "@/lib/test-pricing-5-inline-checkout";
import {
  getTp5MobileService,
  getTp5MobileServices,
  getTp5MobileTurnaround,
  type Tp5MobileFeature,
  type Tp5MobileServiceId,
} from "@/lib/test-pricing-5-mobile";
import {
  TP5_AUDITS_SAMPLE_REPORT_HREF,
  TP5_DEALER_SAMPLE_REPORT_HREF,
  getTp5UiCopy,
} from "@/lib/test-pricing-5-ui-copy";
import { recordSampleReportClick } from "@/lib/sample-report-click-client";
import { Tp5DealerBrandsTip } from "@/components/test-pricing-5/Tp5DealerBrandsTip";
import { Tp5TurnaroundInfoTip } from "@/components/test-pricing-5/Tp5TurnaroundInfoTip";

const TAB_TRANSITION = { duration: 0.35, ease: [0.4, 0, 0.2, 1] as const };

const FEATURE_MARK_CLASS =
  "inline-flex h-6 w-6 shrink-0 items-center justify-center text-[0.98rem] font-bold leading-none";

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

function MobileFeatureRow({ feature }: { feature: Tp5MobileFeature }) {
  if (feature.tone === "info") {
    return (
      <li className={styles.featureRow}>
        <span className={`${FEATURE_MARK_CLASS} text-slate-400/80`} aria-hidden>
          ℹ
        </span>
        <span className={styles.featureLabelInfo}>{feature.name}</span>
      </li>
    );
  }

  if (feature.included) {
    return (
      <li className={styles.featureRow}>
        <span className={`${FEATURE_MARK_CLASS} text-[#2563EB]`} aria-hidden>
          ✓
        </span>
        <span className={styles.featureLabelActive}>{feature.name}</span>
      </li>
    );
  }

  if (feature.tone === "soft") {
    return (
      <li className={styles.featureRow}>
        <span className={`${FEATURE_MARK_CLASS} text-white/35`} aria-hidden>
          —
        </span>
        <span className={styles.featureLabelSoft}>{feature.name}</span>
      </li>
    );
  }

  return (
    <li className={styles.featureRow}>
      <span className={`${FEATURE_MARK_CLASS} text-[#ef4444]`} aria-hidden>
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
  onSwipeAreaTouchEnd?: (event: TouchEvent) => void;
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
  tabLayoutGroupId = "tp5-tabs-mobile",
  tabPillLayoutId = "tp5-tab-pill-mobile",
  tierMetaDescClassName,
  onSwipeAreaTouchStart,
  onSwipeAreaTouchEnd,
  stopSwipePropagation,
}: Tp5MobilePricingCardProps) {
  const locale = useLocale();
  const uiCopy = getTp5UiCopy(locale);
  const services = getTp5MobileServices(locale);
  const activeService = getTp5MobileService(activeServiceId, locale);
  const isDealer = activeServiceId === "dealer";
  const isAudits = activeServiceId === "audits";
  const turnaroundLabel = activeService.turnaround ?? getTp5MobileTurnaround(locale);
  const sampleReportHref = isDealer
    ? TP5_DEALER_SAMPLE_REPORT_HREF
    : isAudits
      ? TP5_AUDITS_SAMPLE_REPORT_HREF
      : null;
  const metaTitle =
    activeServiceId === "dealer"
      ? locale === "en"
        ? "Official dealer service history data"
        : "Oficiālā dīlera servisa vēstures dati"
      : activeService.title;

  return (
    <article className={`${styles.spatialCard} w-full`}>
      <div className={styles.cardHeader}>
        <LayoutGroup id={tabLayoutGroupId}>
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
                  {active ? (
                    <motion.span
                      layoutId={tabPillLayoutId}
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
          <p className={styles.tierMetaTitle}>{metaTitle}</p>
          <p className={tierMetaDescClassName ?? styles.tierMetaDesc}>{activeService.description}</p>
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
        {activeService.extraNote ? (
          <p className={styles.dealerExplainNote}>{activeService.extraNote}</p>
        ) : null}
        {isDealer && activeService.brands && activeService.brands.length > 0 ? (
          <div className={styles.dealerBrandsSlot}>
            <Tp5DealerBrandsTip brands={activeService.brands} copy={uiCopy} />
          </div>
        ) : null}

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
            <span className={styles.turnaroundUrgency}>{uiCopy.turnaroundUrgencyCta}</span>
            <Tp5TurnaroundInfoTip copy={uiCopy} />
          </>
        ) : null}
      </p>

      <div className={styles.ctaWrap}>
        {isDealer ? (
          <p className={styles.dealerRefundBanner}>{uiCopy.dealerRefundBanner}</p>
        ) : null}
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
