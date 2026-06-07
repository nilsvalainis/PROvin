"use client";

import { useCallback, useMemo, useState, type SyntheticEvent, type TouchEvent } from "react";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import styles from "@/app/test-pricing-5/test-pricing-5.module.css";
import { HeroVisual } from "@/components/HeroVisual";
import { Tp5MobilePricingCard } from "@/components/test-pricing-5/Tp5MobilePricingCard";
import {
  getTp5ActiveBlockCount,
  getTp5BlockRows,
  TP5_FEATURE_BLOCKS,
  type Tp5BlockId,
  type Tp5DisplayRow,
  type Tp5FeatureBlock,
} from "@/lib/test-pricing-5-display";
import {
  TP5_CTA_LABEL,
  TP5_DEALER_FOOTNOTE,
  TP5_TAB_LABEL,
  TP5_TIER_META,
  type Tp5TierMeta,
} from "@/lib/test-pricing-5-checkout-routing";
import {
  TP5_DESKTOP_TRUST_LINE,
  TP5_HERO_SUBHEAD,
  TP5_HERO_TITLE_ACCENT,
  TP5_HERO_TITLE_PREFIX,
} from "@/lib/test-pricing-5-hero-copy";
import { TP5_MOBILE_TIER_ORDER, type Tp5MobileTierId } from "@/lib/test-pricing-5-mobile";
import {
  TP5_INLINE_CHECKOUT_SOURCE,
  validateTp5InlineFields,
  type Tp5InlineFieldErrors,
} from "@/lib/test-pricing-5-inline-checkout";
import { normalizeVin } from "@/lib/order-field-validation";
import {
  getTestPricingPlan,
  TEST_PRICING_PLANS,
  type TestPricingPlanConfig,
  type TestPricingPlanId,
} from "@/lib/test-pricing-plans";
import {
  TEST_PRICING_TIER_ORDER,
  useTestPricingTierSwipe,
} from "@/lib/use-test-pricing-tier-swipe";

const TAB_TRANSITION = { duration: 0.35, ease: [0.4, 0, 0.2, 1] as const };
const ROW_SPRING = { type: "spring" as const, stiffness: 480, damping: 34, mass: 0.62 };

type ActiveRowEntry = { row: Tp5DisplayRow; blockId: Tp5BlockId };

function FeatureRow({
  row,
  index,
  reducedMotion,
  active,
}: {
  row: Tp5DisplayRow;
  index: number;
  reducedMotion: boolean;
  active: boolean;
}) {
  const delay = reducedMotion ? 0 : index * 0.04;
  const label = row.footnoteMark ? `${row.label}*` : row.label;

  if (!active) {
    return (
      <li className={styles.featureRow}>
        <span className={`${styles.featureMark} ${styles.featureMarkCross}`} aria-hidden>
          ✕
        </span>
        <span className={styles.featureLabelMuted}>{label}</span>
      </li>
    );
  }

  return (
    <motion.li
      className={styles.featureRow}
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...ROW_SPRING, delay }}
    >
      <motion.span
        className={`${styles.featureMark} ${styles.featureMarkBlue}`}
        aria-hidden
        initial={reducedMotion ? false : { opacity: 0, scale: 0.82 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ ...ROW_SPRING, delay: Math.max(0, delay - 0.08) }}
      >
        ✓
      </motion.span>
      <motion.span
        className={styles.featureLabelActive}
        initial={reducedMotion ? false : { opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ ...ROW_SPRING, delay: delay + 0.08 }}
      >
        {label}
      </motion.span>
    </motion.li>
  );
}

function InactiveGroup({
  block,
  onSelect,
  startIndex,
}: {
  block: Tp5FeatureBlock;
  onSelect: (tier: TestPricingPlanId) => void;
  startIndex: number;
}) {
  const rows = getTp5BlockRows(block.id);
  const tabLabel = TP5_TAB_LABEL[block.unlockTier];

  return (
    <section
      className={styles.inactiveGroup}
      role="button"
      tabIndex={0}
      aria-label={`Izvēlēties ${tabLabel} paketi`}
      onClick={() => onSelect(block.unlockTier)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(block.unlockTier);
        }
      }}
    >
      <ul className={styles.featureList}>
        {rows.map((row, rowIndex) => (
          <FeatureRow
            key={row.id}
            row={row}
            index={startIndex + rowIndex}
            reducedMotion
            active={false}
          />
        ))}
      </ul>
    </section>
  );
}

type Tp5InteractivePricingCardProps = {
  selectedId: TestPricingPlanId;
  setSelectedId: (id: TestPricingPlanId) => void;
  tierMeta: Tp5TierMeta;
  selectedPlan: TestPricingPlanConfig;
  activeRowEntries: ActiveRowEntry[];
  inactiveBlocks: Tp5FeatureBlock[];
  reducedMotion: boolean;
  vin: string;
  listingUrl: string;
  errors: Tp5InlineFieldErrors;
  globalError: string | null;
  loading: boolean;
  onVinChange: (value: string) => void;
  onListingUrlChange: (value: string) => void;
  onSubmit: () => void;
  tabLayoutGroupId: string;
  tabPillLayoutId: string;
  tierMetaDescClassName?: string;
  onSwipeAreaTouchStart?: (event: TouchEvent) => void;
  onSwipeAreaTouchEnd?: (event: TouchEvent) => void;
  stopSwipePropagation?: (event: SyntheticEvent) => void;
};

function Tp5InteractivePricingCard({
  selectedId,
  setSelectedId,
  tierMeta,
  selectedPlan,
  activeRowEntries,
  inactiveBlocks,
  reducedMotion,
  vin,
  listingUrl,
  errors,
  globalError,
  loading,
  onVinChange,
  onListingUrlChange,
  onSubmit,
  tabLayoutGroupId,
  tabPillLayoutId,
  tierMetaDescClassName,
  onSwipeAreaTouchStart,
  onSwipeAreaTouchEnd,
  stopSwipePropagation,
}: Tp5InteractivePricingCardProps) {
  let inactiveRowOffset = activeRowEntries.length;
  const isPremiumTier = selectedId === "premium";

  return (
    <article className={`${styles.spatialCard} w-full`}>
      <div className={styles.cardHeader}>
        <LayoutGroup id={tabLayoutGroupId}>
          <div className={styles.tierSwitcher} role="tablist" aria-label="Izvēlies audita cenu">
            {TEST_PRICING_TIER_ORDER.map((id) => {
              const active = selectedId === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={`${TP5_TAB_LABEL[id]} audits`}
                  className={styles.tierTabBtn}
                  onClick={() => setSelectedId(id)}
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
                    className={`${styles.tierTabLabel} ${id === "premium" ? styles.tierTabLabelCompact : ""} ${active ? styles.tierTabLabelActive : styles.tierTabLabelInactive}`}
                  >
                    {TP5_TAB_LABEL[id]}
                  </span>
                </button>
              );
            })}
          </div>
        </LayoutGroup>

        <div className={styles.tierMeta} aria-live="polite">
          <p className={styles.tierMetaTitle}>{tierMeta.title}</p>
          <p className={tierMetaDescClassName ?? styles.tierMetaDesc}>{tierMeta.description}</p>
        </div>
      </div>

      <div
        className={styles.featureStack}
        onTouchStart={onSwipeAreaTouchStart}
        onTouchEnd={onSwipeAreaTouchEnd}
      >
        {activeRowEntries.length > 0 ? (
          <div className={styles.liquidAccent} data-tier={selectedId}>
            <ul className={styles.featureList}>
              {activeRowEntries.map(({ row }, index) => (
                <FeatureRow
                  key={`${selectedId}-${row.id}`}
                  row={row}
                  index={index}
                  reducedMotion={!!reducedMotion}
                  active
                />
              ))}
            </ul>
          </div>
        ) : null}

        {inactiveBlocks.map((block) => {
          const offset = inactiveRowOffset;
          inactiveRowOffset += getTp5BlockRows(block.id).length;
          return (
            <InactiveGroup
              key={block.id}
              block={block}
              onSelect={setSelectedId}
              startIndex={offset}
            />
          );
        })}

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

      <p className={styles.turnaround}>{selectedPlan.turnaround}</p>

      <div className={styles.ctaWrap}>
        {globalError ? <p className={styles.checkoutError}>{globalError}</p> : null}
        <button type="button" className={styles.liquidCta} onClick={onSubmit} disabled={loading}>
          <span className={styles.liquidCtaShimmer} aria-hidden />
          <span className={styles.liquidCtaLabel}>{TP5_CTA_LABEL[selectedId]}</span>
        </button>
        {isPremiumTier ? <p className={styles.featureFootnote}>{TP5_DEALER_FOOTNOTE}</p> : null}
      </div>
    </article>
  );
}

export function TestPricing5Hero() {
  const searchParams = useSearchParams();
  const reducedMotion = useReducedMotion();
  const [selectedId, setSelectedId] = useState<TestPricingPlanId>("premium");
  const [mobileSelectedId, setMobileSelectedId] = useState<Tp5MobileTierId>("premium");
  const [vin, setVin] = useState("");
  const [listingUrl, setListingUrl] = useState("");
  const [errors, setErrors] = useState<Tp5InlineFieldErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleMobileTierChange = useCallback((id: TestPricingPlanId) => {
    if (id === "plus" || id === "premium") {
      setMobileSelectedId(id);
    }
  }, []);

  const { onSwipeAreaTouchStart: onMobileSwipeStart, onSwipeAreaTouchEnd: onMobileSwipeEnd } =
    useTestPricingTierSwipe(mobileSelectedId, handleMobileTierChange, TP5_MOBILE_TIER_ORDER);

  const cancelled = searchParams.get("atcelts") === "1";
  const selectedPlan = useMemo(
    () => getTestPricingPlan(selectedId) ?? TEST_PRICING_PLANS[2],
    [selectedId],
  );

  const activeBlockCount = getTp5ActiveBlockCount(selectedId);
  const activeBlocks = TP5_FEATURE_BLOCKS.slice(0, activeBlockCount);
  const inactiveBlocks = TP5_FEATURE_BLOCKS.slice(activeBlockCount);

  const activeRowEntries: ActiveRowEntry[] = activeBlocks.flatMap((block) =>
    getTp5BlockRows(block.id).map((row) => ({ row, blockId: block.id })),
  );
  const tierMeta = TP5_TIER_META[selectedId];

  const submitCheckout = useCallback(async (planId: TestPricingPlanId) => {
    setGlobalError(null);
    const validation = validateTp5InlineFields(listingUrl, vin);
    if (!validation.ok) {
      setErrors(validation.errors);
      const first = validation.errors.listingUrl ?? validation.errors.vin;
      if (first) setGlobalError(first);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const res = await fetch("/api/checkout/test-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          locale: "lv",
          listingUrl: listingUrl.trim(),
          vin: normalizeVin(vin),
          withdrawalConsent: true,
          sourcePage: TP5_INLINE_CHECKOUT_SOURCE,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
        errors?: string[];
      };
      if (!res.ok || !data.url) {
        throw new Error(data.errors?.[0] ?? data.error ?? "Neizdevās sākt maksājumu.");
      }
      window.location.href = data.url;
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Neizdevās sākt maksājumu.");
    } finally {
      setLoading(false);
    }
  }, [listingUrl, vin]);

  const submitMobileCheckout = useCallback(() => {
    void submitCheckout(mobileSelectedId);
  }, [mobileSelectedId, submitCheckout]);

  const submitDesktopCheckout = useCallback(() => {
    void submitCheckout(selectedId);
  }, [selectedId, submitCheckout]);

  const stopSwipePropagation = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  const pricingCardProps = {
    selectedId,
    setSelectedId,
    tierMeta,
    selectedPlan,
    activeRowEntries,
    inactiveBlocks,
    reducedMotion: !!reducedMotion,
    vin,
    listingUrl,
    errors,
    globalError,
    loading,
    onVinChange: setVin,
    onListingUrlChange: setListingUrl,
    onSubmit: submitDesktopCheckout,
  };

  return (
    <section className={styles.heroSurface} aria-labelledby="tp5-hero-title">
      <div className={styles.heroBackdrop} aria-hidden>
        <HeroVisual />
      </div>
      <div className={styles.heroScrim} aria-hidden />

      {/* Mobile / tablet — frozen single-card switcher (below lg) */}
      <div className={`${styles.heroInner} lg:hidden`}>
        {cancelled ? (
          <p className={styles.cancelNote}>Maksājums tika atcelts. Vari mēģināt vēlreiz.</p>
        ) : null}

        <header className={styles.heroCopy}>
          <h1 id="tp5-hero-title" className={styles.heroTitle}>
            {TP5_HERO_TITLE_PREFIX}
            <span className={`${styles.heroTitleAccent} text-[#2563EB]`}>
              {TP5_HERO_TITLE_ACCENT}
            </span>
          </h1>
          <p className={styles.heroSubhead}>{TP5_HERO_SUBHEAD}</p>
        </header>

        <div className={styles.stage}>
          <Tp5MobilePricingCard
            selectedId={mobileSelectedId}
            setSelectedId={setMobileSelectedId}
            vin={vin}
            listingUrl={listingUrl}
            errors={errors}
            globalError={globalError}
            loading={loading}
            onVinChange={setVin}
            onListingUrlChange={setListingUrl}
            onSubmit={submitMobileCheckout}
            onSwipeAreaTouchStart={onMobileSwipeStart}
            onSwipeAreaTouchEnd={onMobileSwipeEnd}
            stopSwipePropagation={stopSwipePropagation}
          />
        </div>
      </div>

      {/* Desktop — 2-column asymmetric hero (lg and above) */}
      <div
        className={`${styles.heroInner} hidden lg:grid lg:grid-cols-12 lg:items-center lg:gap-16 lg:!max-w-7xl lg:mx-auto lg:px-8 lg:pt-20 lg:pb-12`}
      >
        {cancelled ? (
          <p className={`${styles.cancelNote} lg:col-span-12`}>
            Maksājums tika atcelts. Vari mēģināt vēlreiz.
          </p>
        ) : null}

        <header className={`${styles.heroCopy} lg:col-span-7 lg:mb-0 lg:min-w-0 lg:text-left`}>
          <h1
            id="tp5-hero-title-desktop"
            className={`${styles.heroTitle} lg:!text-5xl lg:!font-extrabold lg:leading-[1.1] lg:tracking-tight lg:text-white xl:!text-6xl`}
          >
            {TP5_HERO_TITLE_PREFIX}
            <span className={`${styles.heroTitleAccent} text-[#2563EB]`}>
              {TP5_HERO_TITLE_ACCENT}
            </span>
          </h1>
          <p
            className={`${styles.heroSubhead} lg:mt-8 lg:max-w-[46ch] lg:!text-lg lg:leading-relaxed lg:text-gray-300 lg:line-clamp-none lg:overflow-visible lg:block xl:!text-xl`}
          >
            {TP5_HERO_SUBHEAD}
          </p>
          <p className="lg:mt-16 lg:flex lg:items-center lg:gap-2 lg:border-t lg:border-white/5 lg:pt-8 lg:text-sm lg:font-medium lg:tracking-wide lg:text-gray-500">
            {TP5_DESKTOP_TRUST_LINE}
          </p>
        </header>

        <div
          className={`${styles.stage} lg:col-span-5 lg:ml-auto lg:w-[420px] lg:shrink-0 xl:w-[440px]`}
        >
          <Tp5InteractivePricingCard
            {...pricingCardProps}
            tabLayoutGroupId="tp5-tabs-desktop"
            tabPillLayoutId="tp5-tab-pill-desktop"
            tierMetaDescClassName={`${styles.tierMetaDesc} lg:line-clamp-none lg:block lg:overflow-visible`}
          />
        </div>
      </div>
    </section>
  );
}
