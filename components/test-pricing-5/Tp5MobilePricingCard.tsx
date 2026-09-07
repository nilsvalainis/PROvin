"use client";

import { Globe } from "lucide-react";
import { type SyntheticEvent, type TouchEvent } from "react";
import { useLocale } from "next-intl";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import type { Tp5InlineFieldErrors } from "@/lib/test-pricing-5-inline-checkout";
import {
  getTp5HeroTabServices,
  getTp5MobileCardTitle,
  getTp5MobileCtaLabel,
  getTp5MobileService,
  getTp5MobileTabTitle,
  getTp5MobileTurnaround,
  type Tp5MobileFeature,
  type Tp5MobileService,
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
import { Tp5DealerRefundTip } from "@/components/test-pricing-5/Tp5DealerRefundTip";
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

function FeatureLabel({
  feature,
  brands,
  uiCopy,
}: {
  feature: Tp5MobileFeature;
  brands: readonly string[];
  uiCopy: Tp5UiCopy;
}) {
  if (feature.tone === "guarantee") {
    return <Tp5DealerRefundTip copy={uiCopy} />;
  }
  if (feature.tone === "brands") {
    return <Tp5DealerBrandsTip brands={brands} copy={uiCopy} />;
  }
  return <>{feature.name}</>;
}

function MobileFeatureRow({
  feature,
  brands,
  uiCopy,
  plusMark,
}: {
  feature: Tp5MobileFeature;
  brands: readonly string[];
  uiCopy: Tp5UiCopy;
  plusMark?: boolean;
}) {
  const label = <FeatureLabel feature={feature} brands={brands} uiCopy={uiCopy} />;

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
        <span
          className={`${styles.featureMark} ${plusMark ? styles.featureMarkPlus : styles.featureMarkBlue}`}
          aria-hidden
        >
          {plusMark ? "+" : "✓"}
        </span>
        <span className={styles.featureLabelActive}>{label}</span>
      </li>
    );
  }

  if (feature.tone === "soft") {
    return (
      <li className={styles.featureRow}>
        <span className={`${styles.featureMark} ${styles.featureMarkSoft}`} aria-hidden>
          -
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

function PackTitle({ title }: { title: string }) {
  if (title.startsWith("PROVIN ")) {
    return (
      <>
        PROVIN <span className={styles.mobilePackTitleAccent}>{title.slice(7)}</span>
      </>
    );
  }
  return <>{title}</>;
}

function CheckoutFields({
  vin,
  listingUrl,
  errors,
  uiCopy,
  onVinChange,
  onListingUrlChange,
  stopSwipePropagation,
  className,
}: {
  vin: string;
  listingUrl: string;
  errors: Tp5InlineFieldErrors;
  uiCopy: Tp5UiCopy;
  onVinChange: (value: string) => void;
  onListingUrlChange: (value: string) => void;
  stopSwipePropagation?: (event: SyntheticEvent) => void;
  className?: string;
}) {
  return (
    <div
      className={className ?? styles.inlineFields}
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
      {errors.listingUrl ? <p className={styles.inlineFieldError}>{errors.listingUrl}</p> : null}
    </div>
  );
}

function TurnaroundAndCta({
  isDealer,
  turnaroundLabel,
  uiCopy,
  globalError,
  loading,
  ctaLabel,
  sampleReportHref,
  onSubmit,
}: {
  isDealer: boolean;
  turnaroundLabel: string;
  uiCopy: Tp5UiCopy;
  globalError: string | null;
  loading: boolean;
  ctaLabel: string;
  sampleReportHref: string | null;
  onSubmit: () => void;
}) {
  return (
    <>
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
          <span className={styles.liquidCtaLabel}>{ctaLabel}</span>
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
    </>
  );
}

function MobilePackLayout({
  services,
  activeService,
  activeServiceId,
  setActiveServiceId,
  uiCopy,
  vin,
  listingUrl,
  errors,
  globalError,
  loading,
  onVinChange,
  onListingUrlChange,
  onSubmit,
  stopSwipePropagation,
  turnaroundLabel,
  sampleReportHref,
  isDealer,
  ctaLabel,
}: {
  services: Tp5MobileService[];
  activeService: Tp5MobileService;
  activeServiceId: Tp5MobileServiceId;
  setActiveServiceId: (id: Tp5MobileServiceId) => void;
  uiCopy: Tp5UiCopy;
  vin: string;
  listingUrl: string;
  errors: Tp5InlineFieldErrors;
  globalError: string | null;
  loading: boolean;
  onVinChange: (value: string) => void;
  onListingUrlChange: (value: string) => void;
  onSubmit: () => void;
  stopSwipePropagation?: (event: SyntheticEvent) => void;
  turnaroundLabel: string;
  sampleReportHref: string | null;
  isDealer: boolean;
  ctaLabel: string;
}) {
  const cardTitle = getTp5MobileCardTitle(activeService);
  return (
    <>
      <div className={styles.mobileSegWrap}>
        <div className={styles.mobileSeg} role="tablist" aria-label={uiCopy.packageTabsAria}>
          {services.map((service) => {
            const active = activeServiceId === service.id;
            const tabTitle = getTp5MobileTabTitle(service);
            return (
              <button
                key={service.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={`${tabTitle}${uiCopy.packageAriaSuffix}`}
                className={`${styles.mobileSegBtn}${active ? ` ${styles.mobileSegBtnActive}` : ""}`}
                onClick={() => setActiveServiceId(service.id)}
              >
                {service.id === "dealer" ? (
                  <span className={styles.mobileNewBadge}>{uiCopy.newBadge}</span>
                ) : null}
                {tabTitle}
              </button>
            );
          })}
        </div>
      </div>

      <article className={styles.mobilePackCard}>
        {activeService.recommended ? (
          <span className={styles.mobilePackRec}>{uiCopy.recommended}</span>
        ) : null}
        <p className={styles.mobilePackTitle}>
          <PackTitle title={cardTitle} />
        </p>
        <p className={styles.mobilePackPrice}>
          {activeService.price} <span className={styles.mobilePackPriceUnit}>{uiCopy.perReport}</span>
        </p>
        <ul className={styles.mobilePackLines}>
          {activeService.features.map((feature) => (
            <MobileFeatureRow
              key={`${activeServiceId}-${feature.name}`}
              feature={feature}
              brands={activeService.brands ?? []}
              uiCopy={uiCopy}
              plusMark
            />
          ))}
        </ul>
      </article>

      <CheckoutFields
        vin={vin}
        listingUrl={listingUrl}
        errors={errors}
        uiCopy={uiCopy}
        onVinChange={onVinChange}
        onListingUrlChange={onListingUrlChange}
        stopSwipePropagation={stopSwipePropagation}
        className={`${styles.inlineFields} ${styles.mobileHeroFields}`}
      />

      <TurnaroundAndCta
        isDealer={isDealer}
        turnaroundLabel={turnaroundLabel}
        uiCopy={uiCopy}
        globalError={globalError}
        loading={loading}
        ctaLabel={ctaLabel}
        sampleReportHref={sampleReportHref}
        onSubmit={onSubmit}
      />
    </>
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
  layout?: "mobile" | "desktop";
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
  layout = "desktop",
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
  const ctaLabel = getTp5MobileCtaLabel(activeService, layout === "mobile");
  const swipeProps = {
    onTouchStart: onSwipeAreaTouchStart,
    onTouchMove: onSwipeAreaTouchMove,
    onTouchEnd: onSwipeAreaTouchEnd,
    onTouchCancel: onSwipeAreaTouchCancel,
  };

  if (layout === "mobile") {
    return (
      <div className={styles.mobileHeroStack} {...swipeProps}>
        <MobilePackLayout
          services={services}
          activeService={activeService}
          activeServiceId={activeServiceId}
          setActiveServiceId={setActiveServiceId}
          uiCopy={uiCopy}
          vin={vin}
          listingUrl={listingUrl}
          errors={errors}
          globalError={globalError}
          loading={loading}
          onVinChange={onVinChange}
          onListingUrlChange={onListingUrlChange}
          onSubmit={onSubmit}
          stopSwipePropagation={stopSwipePropagation}
          turnaroundLabel={turnaroundLabel}
          sampleReportHref={sampleReportHref}
          isDealer={isDealer}
          ctaLabel={ctaLabel}
        />
      </div>
    );
  }

  const desktopDealerHighlight = activeService.desktopHighlight ?? activeService.features[0];

  return (
    <article className={`${styles.spatialCard} w-full`} {...swipeProps}>
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
          {isDealer && desktopDealerHighlight ? (
            <div className={styles.dealerUnifiedPanel}>
              <DealerFeatureHighlight
                feature={desktopDealerHighlight}
                brands={activeService.brands ?? []}
                uiCopy={uiCopy}
              />
              <hr className={styles.dealerUnifiedDivider} aria-hidden />
              <Tp5DealerRefundTip copy={uiCopy} />
            </div>
          ) : (
            <ul className={styles.featureList}>
              {activeService.features.map((feature) => (
                <MobileFeatureRow
                  key={`${activeServiceId}-${feature.name}`}
                  feature={feature}
                  brands={activeService.brands ?? []}
                  uiCopy={uiCopy}
                />
              ))}
            </ul>
          )}
        </div>

        <CheckoutFields
          vin={vin}
          listingUrl={listingUrl}
          errors={errors}
          uiCopy={uiCopy}
          onVinChange={onVinChange}
          onListingUrlChange={onListingUrlChange}
          stopSwipePropagation={stopSwipePropagation}
        />
      </div>

      <TurnaroundAndCta
        isDealer={isDealer}
        turnaroundLabel={turnaroundLabel}
        uiCopy={uiCopy}
        globalError={globalError}
        loading={loading}
        ctaLabel={ctaLabel}
        sampleReportHref={sampleReportHref}
        onSubmit={onSubmit}
      />
    </article>
  );
}
