"use client";

import { type MouseEvent, type SyntheticEvent, type TouchEvent, useEffect, useId, useRef, useState } from "react";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { Tp5DealerBrandsTip } from "@/components/test-pricing-5/Tp5DealerBrandsTip";
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
import { getTp5UiCopy, type DealerBrandsTipCopy } from "@/lib/test-pricing-5-ui-copy";

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

function canHoverFinePointer(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function FeatureInfoTip({ text, ariaLabel }: { text: string; ariaLabel: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const tipId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root || !(event.target instanceof Node)) return;
      if (!root.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggle(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setOpen((prev) => !prev);
  }

  function stopSwipe(event: TouchEvent<HTMLButtonElement>) {
    event.stopPropagation();
  }

  return (
    <span
      ref={rootRef}
      className={styles.featureInlineInfo}
      onMouseEnter={() => {
        if (canHoverFinePointer()) setOpen(true);
      }}
      onMouseLeave={() => {
        if (canHoverFinePointer()) setOpen(false);
      }}
    >
      <button
        type="button"
        className={styles.dealerRefundHit}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={tipId}
        onClick={toggle}
        onTouchStart={stopSwipe}
        onTouchEnd={stopSwipe}
      >
        <span className={styles.dealerRefundInfoBtn} aria-hidden>
          <span>i</span>
        </span>
      </button>
      {open ? (
        <span id={tipId} role="tooltip" className={styles.dealerRefundPopup}>
          <span className={styles.dealerRefundPopupText}>{text}</span>
        </span>
      ) : null}
    </span>
  );
}

function FeatureRow({
  feature,
  brands,
  brandsCopy,
  infoAria,
}: {
  feature: AzvinMobileFeature;
  brands: readonly string[];
  brandsCopy: DealerBrandsTipCopy;
  infoAria: string;
}) {
  if (feature.tone === "guarantee") {
    return (
      <li className={styles.featureRow}>
        <span className={`${styles.featureMark} ${styles.featureMarkGuarantee}`} aria-hidden>
          ✓
        </span>
        <span className={`${styles.featureLabelGuarantee} ${styles.featureLabelGuaranteeNowrap}`}>
          {feature.name}
        </span>
      </li>
    );
  }

  if (feature.tone === "brands") {
    return (
      <li className={`${styles.featureRow} ${styles.featureRowBrands}`}>
        <span className={`${styles.featureMark} ${styles.featureMarkBrands}`} aria-hidden />
        <span className={styles.featureLabelBrands}>
          <Tp5DealerBrandsTip brands={brands} copy={brandsCopy} />
        </span>
      </li>
    );
  }

  if (feature.included) {
    return (
      <li className={styles.featureRow}>
        <span className={`${styles.featureMark} ${styles.featureMarkBlue}`} aria-hidden>
          ✓
        </span>
        <span className={`${styles.featureLabelActive}${feature.infoTip ? ` ${styles.featureLabelWithInfo}` : ""}`}>
          {feature.name}
          {feature.infoTip ? <FeatureInfoTip text={feature.infoTip} ariaLabel={infoAria} /> : null}
        </span>
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
  const coverageCopy = getTp5UiCopy(locale === "lv" ? "lv" : "en");
  const brandsCopy: DealerBrandsTipCopy = {
    ...coverageCopy,
    dealerBrandsTrigger: uiCopy.dealerBrandsAria,
    dealerBrandsAria: uiCopy.dealerBrandsAria,
    dealerBrandsClose: uiCopy.dealerBrandsClose,
  };

  return (
    <article
      className={`${styles.spatialCard} w-full`}
      onTouchStart={onSwipeAreaTouchStart}
      onTouchMove={onSwipeAreaTouchMove}
      onTouchEnd={onSwipeAreaTouchEnd}
      onTouchCancel={onSwipeAreaTouchCancel}
    >
      <div className={styles.cardHeader}>
        <div className={`${styles.tierSwitcher} ${styles.tierSwitcherFour}`} role="tablist" aria-label={uiCopy.packageTabsAria}>
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
                  {service.tabTitle ?? service.title}
                </span>
              </button>
            );
          })}
        </div>

        {activeService.description.trim() ? (
          <div className={styles.tierMeta} aria-live="polite">
            <p className={styles.tierMetaDesc}>{activeService.description}</p>
          </div>
        ) : null}
      </div>

      <div className={styles.featureStack}>
        <div className={styles.liquidAccent} data-tier={activeServiceId}>
          <ul className={styles.featureList}>
            {activeService.features.map((feature) => (
              <FeatureRow
                key={`${activeServiceId}-${feature.name}`}
                feature={feature}
                brands={activeService.brands ?? []}
                brandsCopy={brandsCopy}
                infoAria={uiCopy.featureInfoAria}
              />
            ))}
          </ul>
        </div>

        {activeService.showRefundBanner ? (
          <p className={styles.dealerRefundBanner}>{refundBannerText}</p>
        ) : null}

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
