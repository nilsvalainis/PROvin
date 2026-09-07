"use client";

import { useState, type SyntheticEvent } from "react";
import { useLocale } from "next-intl";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { Tp5DealerBrandsTip } from "@/components/test-pricing-5/Tp5DealerBrandsTip";
import { Tp5DealerRefundTip } from "@/components/test-pricing-5/Tp5DealerRefundTip";
import { Tp5TurnaroundInfoTip } from "@/components/test-pricing-5/Tp5TurnaroundInfoTip";
import { Globe } from "lucide-react";
import {
  getB2bBusinessHeroFeatures,
  getB2bCatalogPlan,
  B2B_PARTNER_PRICE,
  isB2bPartnerCode,
  type B2bPartnerPlanId,
} from "@/lib/b2b-partner-copy";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { TP5_DEALER_BRANDS } from "@/lib/test-pricing-5-mobile";
import {
  getTp5UiCopy,
} from "@/lib/test-pricing-5-ui-copy";
import { recordSampleReportClick } from "@/lib/sample-report-click-client";

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

type Props = {
  plan: B2bPartnerPlanId;
  setPlan: (id: B2bPartnerPlanId) => void;
  unlocked: boolean;
  onUnlock: () => void;
  onPay: (vin: string) => void;
  code: string;
  setCode: (value: string) => void;
  vin: string;
  setVin: (value: string) => void;
  tabLayoutGroupId?: string;
  tierMetaDescClassName?: string;
  onSwipeAreaTouchStart?: (event: SyntheticEvent) => void;
  onSwipeAreaTouchMove?: (event: SyntheticEvent) => void;
  onSwipeAreaTouchEnd?: (event: SyntheticEvent) => void;
  onSwipeAreaTouchCancel?: (event: SyntheticEvent) => void;
  stopSwipePropagation?: (event: SyntheticEvent) => void;
};

export function B2bPartnerPricingCard({
  plan,
  setPlan,
  unlocked,
  onUnlock,
  onPay,
  code,
  setCode,
  vin,
  setVin,
  tierMetaDescClassName,
  onSwipeAreaTouchStart,
  onSwipeAreaTouchMove,
  onSwipeAreaTouchEnd,
  onSwipeAreaTouchCancel,
  stopSwipePropagation,
}: Props) {
  const locale = useLocale();
  const uiCopy = getTp5UiCopy(locale);
  const isDealer = plan === "dealer";
  const catalogPlan = getB2bCatalogPlan(plan, locale);
  const heroFeatures = getB2bBusinessHeroFeatures(locale);
  const tabs: { id: B2bPartnerPlanId; title: string }[] = [
    { id: "business", title: getB2bCatalogPlan("business", locale).title },
    { id: "dealer", title: getB2bCatalogPlan("dealer", locale).title },
  ];
  const dealerHighlightTitle =
    locale === "en" ? "Dealer service history and mileage" : "Dīleru servisa vēsture un nobraukums";
  const dealerHighlightSubtitle =
    locale === "en"
      ? "Direct access to official manufacturer service records."
      : "Tiešā piekļuve oficiālajiem ražotāja apkopju ierakstiem.";
  const businessMeta =
    locale === "en"
      ? "Full history in one report, without consultation."
      : "Pilna vēsture vienā atskaitē, bez konsultācijas.";
  const serviceTabAria = locale === "en" ? "Service" : "Pakalpojums";
  const partnerCodeError =
    locale === "en" ? "Enter a 6-digit partner code." : "Ievadi 6 ciparu partnera kodu.";
  const vinFormatError =
    locale === "en"
      ? "VIN: 11-17 characters, no I, O or Q."
      : "VIN: 11-17 zīmes, bez I, O, Q.";
  const [codeError, setCodeError] = useState("");
  const [vinError, setVinError] = useState("");
  const sampleHref = catalogPlan.sampleHref;

  const submitGate = () => {
    if (!isB2bPartnerCode(code)) {
      setCodeError(partnerCodeError);
      return;
    }
    setCodeError("");
    onUnlock();
  };

  const submitPay = () => {
    if (!isValidVin(vin)) {
      setVinError(vinFormatError);
      return;
    }
    setVinError("");
    onPay(normalizeVin(vin));
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
        <div className={`${styles.tierSwitcher} ${styles.tierSwitcherTwo}`} role="tablist" aria-label={serviceTabAria}>
          {tabs.map((tab) => {
            const active = plan === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={styles.tierTabBtn}
                onClick={() => setPlan(tab.id)}
              >
                <span
                  className={`${styles.tierTabLabel} ${styles.tierTabLabelCompact} ${
                    active ? styles.tierTabLabelActive : styles.tierTabLabelInactive
                  }`}
                >
                  {tab.title}
                </span>
              </button>
            );
          })}
        </div>

        {!isDealer ? (
          <div className={styles.tierMeta} aria-live="polite">
            <p className={tierMetaDescClassName ?? styles.tierMetaDesc}>
              {businessMeta}
            </p>
          </div>
        ) : null}
      </div>

      <div className={styles.featureStack}>
        <div className={styles.liquidAccent} data-tier={isDealer ? "dealer" : "audits"}>
          {isDealer ? (
            <div className={styles.dealerUnifiedPanel}>
              <div className={styles.dealerFeatureHighlight} role="listitem">
                <Globe className={styles.dealerFeatureIcon} aria-hidden />
                <div className={styles.dealerFeatureCopy}>
                  <p className={styles.dealerFeatureTitle}>{dealerHighlightTitle}</p>
                  <p className={styles.dealerFeatureSubtitle}>
                    {dealerHighlightSubtitle}
                  </p>
                  <div className={styles.dealerBrandsUnderSubtitle}>
                    <Tp5DealerBrandsTip brands={TP5_DEALER_BRANDS} copy={uiCopy} />
                  </div>
                </div>
              </div>
              <hr className={styles.dealerUnifiedDivider} aria-hidden />
              <Tp5DealerRefundTip copy={uiCopy} />
            </div>
          ) : (
            <ul className={styles.featureList}>
              {heroFeatures.map((feature) => (
                <li key={feature} className={styles.featureRow}>
                  <span className={`${styles.featureMark} ${styles.featureMarkBlue}`} aria-hidden>
                    ✓
                  </span>
                  <span className={styles.featureLabelActive}>{feature}</span>
                </li>
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
          {unlocked ? (
            <>
              <input
                type="text"
                className={`${styles.inlineInput} ${vinError ? styles.inlineInputError : ""}`}
                value={vin}
                onChange={(event) => {
                  setVin(event.target.value.toUpperCase().replace(/\s/g, ""));
                  setVinError("");
                }}
                placeholder={uiCopy.vinPlaceholder}
                aria-label={uiCopy.vinAria}
                autoComplete="off"
                spellCheck={false}
                maxLength={17}
              />
              {vinError ? <p className={styles.inlineFieldError}>{vinError}</p> : null}
            </>
          ) : (
            <>
              <input
                type="password"
                className={`${styles.inlineInput} ${codeError ? styles.inlineInputError : ""}`}
                value={code}
                onChange={(event) => {
                  const next = event.target.value.replace(/\D/g, "").slice(0, 6);
                  setCode(next);
                  setCodeError("");
                }}
                placeholder="6 ciparu kods"
                aria-label="Partnera 6 ciparu kods"
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
              />
              {codeError ? <p className={styles.inlineFieldError}>{codeError}</p> : null}
            </>
          )}
        </div>
      </div>

      <p className={styles.turnaround}>
        <span>⏱️ Izpilde: 24-72h</span>
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
        {unlocked ? (
          <button type="button" className={styles.liquidCta} onClick={submitPay}>
            <span className={styles.liquidCtaShimmer} aria-hidden />
            <span className={styles.liquidCtaLabel}>Maksāt — {B2B_PARTNER_PRICE[plan]}</span>
          </button>
        ) : (
          <button type="button" className={styles.liquidCta} onClick={submitGate}>
            <span className={styles.liquidCtaShimmer} aria-hidden />
            <span className={styles.liquidCtaLabel}>Pasūtīt</span>
          </button>
        )}
        <a
          href={sampleHref}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.sampleReportLink}
          onClick={() => recordSampleReportClick()}
        >
          <SampleReportPdfIcon />
          <span>{uiCopy.sampleReportLink}</span>
        </a>
      </div>
    </article>
  );
}
