"use client";

import { LayoutGroup, motion } from "framer-motion";
import { Globe } from "lucide-react";
import { type SyntheticEvent, type TouchEvent, useEffect, useRef, useState } from "react";
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
import {
  TP5_DEALER_BRAND_DARK_PLATE,
  TP5_DEALER_BRAND_LOGO_SRC,
  TP5_DEALER_BRAND_ROWS,
} from "@/lib/test-pricing-5-mobile";

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

function HighlightFeature({ feature }: { feature: AzvinMobileFeature }) {
  return (
    <div className="mb-6 flex items-center gap-3.5" role="listitem">
      <Globe className="h-6 w-6 shrink-0 text-slate-300 stroke-[1.5]" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[0.92rem] font-semibold leading-snug text-slate-100">{feature.name}</p>
        {feature.subtitle ? (
          <p className="mt-0.5 m-0 text-xs font-normal leading-snug text-slate-400">{feature.subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

function FeatureRow({ feature }: { feature: AzvinMobileFeature }) {
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

  return (
    <li className={styles.featureRow}>
      <span className={`${FEATURE_MARK_CLASS} text-[#ef4444]`} aria-hidden>
        ✕
      </span>
      <span className={styles.featureLabelMuted}>{feature.name}</span>
    </li>
  );
}

/** PROVIN dealer brand grid — copied 1:1. */
function DealerBrandBadges({ brandsAria }: { brandsAria: string }) {
  const [openBrand, setOpenBrand] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const touchMovedRef = useRef(false);

  useEffect(() => {
    if (!openBrand) return;
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root || !(event.target instanceof Node)) return;
      if (!root.contains(event.target)) setOpenBrand(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenBrand(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openBrand]);

  return (
    <div ref={rootRef} className={styles.dealerInlineBrands} aria-label={brandsAria}>
      {TP5_DEALER_BRAND_ROWS.flat().map((brand) => {
        const src = TP5_DEALER_BRAND_LOGO_SRC[brand];
        const darkPlate = TP5_DEALER_BRAND_DARK_PLATE.has(brand);
        const open = openBrand === brand;
        return (
          <div
            key={brand}
            role="button"
            tabIndex={0}
            className={`${styles.dealerInlineBrandCell}${open ? ` ${styles.dealerInlineBrandCellOpen}` : ""}`}
            aria-label={brand}
            aria-expanded={open}
            onMouseEnter={() => setOpenBrand(brand)}
            onMouseLeave={() => setOpenBrand((prev) => (prev === brand ? null : prev))}
            onFocus={() => setOpenBrand(brand)}
            onBlur={() => setOpenBrand((prev) => (prev === brand ? null : prev))}
            onTouchStart={() => {
              touchMovedRef.current = false;
            }}
            onTouchMove={() => {
              touchMovedRef.current = true;
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              setOpenBrand((prev) => (prev === brand ? null : brand));
            }}
            onClick={() => {
              if (touchMovedRef.current) return;
              if (
                typeof window !== "undefined" &&
                window.matchMedia("(hover: hover) and (pointer: fine)").matches
              ) {
                return;
              }
              setOpenBrand((prev) => (prev === brand ? null : brand));
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              className={`${styles.dealerInlineBrandLogo}${darkPlate ? ` ${styles.dealerInlineBrandLogoDarkPlate}` : ""}`}
              loading="lazy"
              decoding="async"
              draggable={false}
            />
            <span className={styles.dealerInlineBrandTip} role="tooltip">
              {brand}
            </span>
          </div>
        );
      })}
    </div>
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
  tabLayoutGroupId = "azvin-tabs-mobile",
  tabPillLayoutId = "azvin-tab-pill-mobile",
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
  const isKorea = activeService.layout === "koreaHighlight";
  const turnaroundLabel = activeService.turnaround ?? "";
  const sampleReportHref = isDealer ? AZVIN_DEALER_SAMPLE_REPORT_HREF : null;

  return (
    <article
      className={`${styles.spatialCard} w-full`}
      onTouchStart={onSwipeAreaTouchStart}
      onTouchMove={onSwipeAreaTouchMove}
      onTouchEnd={onSwipeAreaTouchEnd}
      onTouchCancel={onSwipeAreaTouchCancel}
    >
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
            <HighlightFeature feature={activeService.features[0]} />
          ) : isKorea && activeService.features[0] ? (
            <HighlightFeature feature={activeService.features[0]} />
          ) : (
            <ul className={styles.featureList}>
              {activeService.features.map((feature) => (
                <FeatureRow key={`${activeServiceId}-${feature.name}`} feature={feature} />
              ))}
            </ul>
          )}
          {isDealer ? <DealerBrandBadges brandsAria={uiCopy.dealerBrandsAria} /> : null}
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
        {isDealer ? <p className={styles.dealerRefundBanner}>{uiCopy.dealerRefundBanner}</p> : null}
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
