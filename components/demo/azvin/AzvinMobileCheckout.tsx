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

  return (
    <>
      <div className={styles.heroBlock}>
        <header>
          <h1 id="azvin-hero-title" className={styles.title}>
            {copy.titlePrefix}
            <span className={styles.titleAccent}>{copy.titleAccent}</span>
          </h1>
          <p className={styles.lead}>{copy.cardDescription}</p>
        </header>

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
                  whileTap={enabled && !reduceMotion ? { scale: 0.98 } : undefined}
                >
                  <span
                    className={`${styles.chipCheck} ${checked ? styles.chipCheckOn : ""}`}
                    aria-hidden
                  >
                    {checked ? "✓" : ""}
                  </span>
                  <span className={styles.chipBody}>
                    <span className={styles.chipName}>{service.name}</span>
                    <span className={styles.chipMeta}>
                      <span className={styles.chipPrice}>{service.priceLabel}</span>
                      {service.comingSoon ? (
                        <span className={styles.chipSoon}>{service.comingSoon}</span>
                      ) : null}
                    </span>
                    {id === "dealer" ? (
                      <span
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
                            dealerBrandsYearNote: copy.dealerBrandsYearNote,
                            dealerBrandsRefundNote: copy.dealerBrandsRefundNote,
                            dealerBrandsClose: copy.dealerBrandsClose,
                          }}
                        />
                      </span>
                    ) : null}
                  </span>
                </motion.button>
              </li>
            );
          })}
        </ul>

        <p className={styles.turnaround}>{copy.turnaround}</p>
      </div>

      <div className={styles.stickyBar}>
        <div className={styles.stickyInner}>
          <AnimatePresence mode="wait">
            {globalError ? (
              <motion.p
                key="err"
                className={styles.stickyError}
                initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {globalError}
              </motion.p>
            ) : demoNote ? (
              <motion.p
                key="note"
                className={styles.stickyNote}
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
      </div>
    </>
  );
}
