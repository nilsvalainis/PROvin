"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Tp5DealerBrandsTip } from "@/components/test-pricing-5/Tp5DealerBrandsTip";
import {
  AZVIN_DEALER_BRANDS,
  AZVIN_SERVICE_ENABLED,
  AZVIN_SERVICE_IDS,
  type AzvinHeroCopy,
  type AzvinServiceId,
} from "@/lib/azvin-hero-copy";
import styles from "@/app/[locale]/demo/azvin/azvin.module.css";

type Props = {
  copy: AzvinHeroCopy;
  selected: ReadonlySet<AzvinServiceId>;
  onToggleService: (id: AzvinServiceId) => void;
  totalAzn: number;
  vin: string;
  vinError: string | null;
  globalError: string | null;
  demoNote: string | null;
  loading: boolean;
  onVinChange: (value: string) => void;
  onSubmit: () => void;
};

function CtaCluster({
  copy,
  totalAzn,
  loading,
  globalError,
  demoNote,
  onSubmit,
  reduceMotion,
  variant,
}: {
  copy: AzvinHeroCopy;
  totalAzn: number;
  loading: boolean;
  globalError: string | null;
  demoNote: string | null;
  onSubmit: () => void;
  reduceMotion: boolean | null;
  variant: "sticky" | "desktop";
}) {
  const wrapClass = variant === "sticky" ? styles.stickyInner : styles.desktopCta;
  const errClass = variant === "sticky" ? styles.stickyError : styles.inlineError;
  const noteClass = variant === "sticky" ? styles.stickyNote : styles.inlineNote;

  return (
    <div className={wrapClass}>
      <AnimatePresence mode="wait">
        {globalError ? (
          <motion.p
            key="err"
            className={errClass}
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {globalError}
          </motion.p>
        ) : demoNote ? (
          <motion.p
            key="note"
            className={noteClass}
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {demoNote}
          </motion.p>
        ) : null}
      </AnimatePresence>

      <button type="button" className={styles.ctaBtn} onClick={onSubmit} disabled={loading}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={totalAzn}
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            {copy.ctaLabel(totalAzn)}
          </motion.span>
        </AnimatePresence>
      </button>
      <p className={styles.ctaRefund}>{copy.footnote}</p>
    </div>
  );
}

export function AzvinMobileCheckout({
  copy,
  selected,
  onToggleService,
  totalAzn,
  vin,
  vinError,
  globalError,
  demoNote,
  loading,
  onVinChange,
  onSubmit,
}: Props) {
  const reduceMotion = useReducedMotion();
  const vinLen = vin.length;
  const vinReady = vinLen >= 11;

  const ctaProps = {
    copy,
    totalAzn,
    loading,
    globalError,
    demoNote,
    onSubmit,
    reduceMotion,
  };

  return (
    <>
      <div className={styles.heroGrid}>
        <header className={styles.heroCopy}>
          <h1 id="azvin-hero-title" className={styles.title}>
            {copy.titlePrefix}
            <span className={styles.titleAccent}>{copy.titleAccent}</span>
          </h1>
          <p className={styles.lead}>{copy.cardDescription}</p>
          <p className={styles.turnaroundDesktop}>{copy.turnaround}</p>
        </header>

        <div className={styles.heroPanel}>
          <div className={styles.servicesBlock}>
            <p className={styles.servicesLabel}>{copy.servicesLabel}</p>
            <ul className={styles.chipList} aria-label={copy.iconRowAria}>
              {AZVIN_SERVICE_IDS.map((id) => {
                const service = copy.services[id];
                const enabled = AZVIN_SERVICE_ENABLED[id];
                const checked = selected.has(id);
                return (
                  <li key={id}>
                    <motion.button
                      type="button"
                      layout={!reduceMotion}
                      className={[
                        styles.chip,
                        checked ? styles.chipOn : "",
                        !enabled ? styles.chipDisabled : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      aria-pressed={enabled ? checked : undefined}
                      aria-disabled={!enabled}
                      disabled={!enabled}
                      onClick={() => {
                        if (enabled) onToggleService(id);
                      }}
                      whileTap={enabled && !reduceMotion ? { scale: 0.985 } : undefined}
                    >
                      <span className={styles.chipBody}>
                        <span className={styles.chipName}>{service.name}</span>
                        <span className={styles.chipHint}>{service.hint}</span>
                        {id === "dealer" ? (
                          <span
                            className={styles.chipTip}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                            }}
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            <Tp5DealerBrandsTip
                              brands={AZVIN_DEALER_BRANDS}
                              copy={{
                                dealerBrandsTrigger: copy.dealerBrandsTrigger,
                                dealerBrandsAria: copy.dealerBrandsAria,
                                dealerBrandsClose: copy.dealerBrandsClose,
                              }}
                            />
                          </span>
                        ) : null}
                      </span>
                      <span className={styles.chipPrice}>{service.priceLabel}</span>
                    </motion.button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className={styles.vinWrap}>
            <div className={styles.vinField}>
              <input
                type="text"
                className={`${styles.vinInput} ${vinError ? styles.vinInputError : ""}`}
                value={vin}
                onChange={(event) => onVinChange(event.target.value.toUpperCase())}
                placeholder={copy.vinPlaceholder}
                aria-label={copy.vinAria}
                autoComplete="off"
                spellCheck={false}
                inputMode="text"
                maxLength={17}
              />
              <span
                className={`${styles.vinCount} ${vinReady ? styles.vinCountReady : ""}`}
                aria-hidden
              >
                {vinLen}/17
              </span>
            </div>
            {vinError ? <p className={styles.fieldError}>{vinError}</p> : null}
          </div>

          <p className={styles.turnaroundMobile}>{copy.turnaround}</p>

          <div className={styles.desktopCtaSlot}>
            <CtaCluster {...ctaProps} variant="desktop" />
          </div>
        </div>
      </div>

      <div className={styles.stickyBar}>
        <CtaCluster {...ctaProps} variant="sticky" />
      </div>
    </>
  );
}
