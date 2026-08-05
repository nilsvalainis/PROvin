"use client";

import styles from "@/app/test-pricing-5/test-pricing-5.module.css";
import azvinStyles from "@/app/[locale]/demo/azvin/azvin.module.css";
import { Tp5DealerBrandsTip } from "@/components/test-pricing-5/Tp5DealerBrandsTip";
import {
  AZVIN_DEALER_BRANDS,
  AZVIN_SERVICE_ENABLED,
  AZVIN_SERVICE_IDS,
  type AzvinHeroCopy,
  type AzvinServiceId,
} from "@/lib/azvin-hero-copy";

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

export function AzvinPricingCard({
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
  return (
    <article className={`${styles.spatialCard} w-full`}>
      <div className={styles.cardHeader}>
        <p className={azvinStyles.cardDesc}>{copy.cardDescription}</p>
      </div>

      <div className={styles.featureStack}>
        <div className={`${styles.liquidAccent} ${azvinStyles.featureStackCompact}`}>
          <ul className={azvinStyles.serviceList}>
            {AZVIN_SERVICE_IDS.map((id) => {
              const service = copy.services[id];
              const enabled = AZVIN_SERVICE_ENABLED[id];
              const checked = selected.has(id);
              return (
                <li key={id}>
                  <button
                    type="button"
                    className={[
                      azvinStyles.serviceRow,
                      checked ? azvinStyles.serviceRowChecked : "",
                      !enabled ? azvinStyles.serviceRowDisabled : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-pressed={enabled ? checked : undefined}
                    aria-disabled={!enabled}
                    disabled={!enabled}
                    onClick={() => {
                      if (enabled) onToggleService(id);
                    }}
                  >
                    <span
                      className={[
                        azvinStyles.serviceCheck,
                        checked ? azvinStyles.serviceCheckOn : "",
                        !enabled ? azvinStyles.serviceCheckDisabled : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      aria-hidden
                    >
                      {checked ? "✓" : ""}
                    </span>
                    <span className={azvinStyles.serviceBody}>
                      <span className={azvinStyles.serviceName}>{service.name}</span>
                      <span className={azvinStyles.serviceMeta}>
                        <span className={azvinStyles.servicePrice}>{service.priceLabel}</span>
                        {service.comingSoon ? (
                          <span className={azvinStyles.serviceSoon}>{service.comingSoon}</span>
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
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className={azvinStyles.vinSlot}>
          <input
            type="text"
            className={`${styles.inlineInput} ${vinError ? styles.inlineInputError : ""}`}
            value={vin}
            onChange={(event) => onVinChange(event.target.value.toUpperCase())}
            placeholder={copy.vinPlaceholder}
            aria-label={copy.vinAria}
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
            maxLength={17}
          />
          {vinError ? <p className={styles.inlineFieldError}>{vinError}</p> : null}
        </div>
      </div>

      <p className={azvinStyles.turnaroundPremium}>
        <span>{copy.turnaround}</span>
      </p>

      <div className={styles.ctaWrap}>
        {globalError ? <p className={styles.checkoutError}>{globalError}</p> : null}
        {demoNote ? <p className={azvinStyles.demoNote}>{demoNote}</p> : null}
        <button type="button" className={styles.liquidCta} onClick={onSubmit} disabled={loading}>
          <span className={styles.liquidCtaShimmer} aria-hidden />
          <span className={styles.liquidCtaLabel}>{copy.ctaLabel(totalAzn)}</span>
        </button>
        <p className={azvinStyles.footnotePremium}>{copy.footnote}</p>
      </div>
    </article>
  );
}
