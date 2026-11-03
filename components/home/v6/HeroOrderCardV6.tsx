"use client";

import { useContext, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "next-intl";
import tp5Styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { Tp5VinHighlightContext } from "@/components/test-pricing-5/Tp5MobilePricingCard";
import { getHomeV6HeroCopy, heroV6OptionIds } from "@/lib/home-hero-v6-copy";
import { sanitizeVinInput } from "@/lib/order-field-validation";
import { recordSampleReportClick } from "@/lib/sample-report-click-client";
import type { Tp5InlineFieldErrors } from "@/lib/test-pricing-5-inline-checkout";
import {
  getTp5MobileCtaLabel,
  getTp5MobileService,
  type Tp5MobileServiceId,
} from "@/lib/test-pricing-5-mobile";
import {
  TP5_AUDITS_SAMPLE_REPORT_HREF,
  TP5_DEALER_SAMPLE_REPORT_HREF,
  TP5_MINI_SAMPLE_REPORT_HREF,
  TP5_TURNAROUND_INFO_PHONE_LOCAL,
  TP5_TURNAROUND_INFO_PHONE_TEL,
  getTp5UiCopy,
} from "@/lib/test-pricing-5-ui-copy";
import { whatsappWebUrl } from "@/lib/contact";
import styles from "./hero-v6.module.css";

/** „29 502 039” - redzamais formāts (tikai «Steidzami?»). */
function phoneGroups(local: string): string {
  return local.replace(/^(\d{2})(\d{3})(\d{3})$/, "$1 $2 $3");
}

const SAMPLE_BY_ID: Partial<Record<Tp5MobileServiceId, string>> = {
  audits: TP5_AUDITS_SAMPLE_REPORT_HREF,
  mini: TP5_MINI_SAMPLE_REPORT_HREF,
  dealer: TP5_DEALER_SAMPLE_REPORT_HREF,
};

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 20l1.3-4A8 8 0 1 1 8 18.8z" />
      <path d="M9 9.5c.3 2 1.8 3.7 4 4.6l1.2-1.2 1.8.8c-.2 1.2-1.1 1.8-2.2 1.7-3-.4-5.6-3-6-6-.1-1.1.5-2 1.7-2.2l.8 1.8z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
    </svg>
  );
}

type Props = {
  activeId: Tp5MobileServiceId;
  onSelect: (id: Tp5MobileServiceId) => void;
  /** Telefonā lauki atveras pēc paketes izvēles (vai ja tā jau iepriekš izvēlēta). */
  picked: boolean;
  vin: string;
  listingUrl: string;
  errors: Tp5InlineFieldErrors;
  globalError: string | null;
  loading: boolean;
  onVinChange: (value: string) => void;
  onListingUrlChange: (value: string) => void;
  onSubmit: () => void;
};

export function HeroOrderCardV6({
  activeId,
  onSelect,
  picked,
  vin,
  listingUrl,
  errors,
  globalError,
  loading,
  onVinChange,
  onListingUrlChange,
  onSubmit,
}: Props) {
  const locale = useLocale();
  const copy = getHomeV6HeroCopy(locale);
  const uiCopy = getTp5UiCopy(locale);
  const vinHighlight = useContext(Tp5VinHighlightContext);
  const ids = heroV6OptionIds(activeId);
  const service = getTp5MobileService(activeId, locale);
  const sample = SAMPLE_BY_ID[activeId] ?? null;
  const fast = activeId === "dealer" || activeId === "mini";
  const [urgentOpen, setUrgentOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const uid = useId();
  const waHref = `${whatsappWebUrl()}?text=${encodeURIComponent(copy.waText)}`;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheetOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  const onUrgentClick = () => {
    if (window.matchMedia("(min-width: 901px)").matches) setUrgentOpen((v) => !v);
    else setSheetOpen(true);
  };

  return (
    <div className={`${styles.card}${picked ? ` ${styles.isPicked}` : ""}${activeId === "dealer" ? ` ${styles.isDealer}` : ""}`}>
      <div className={styles.options} role="radiogroup" aria-label={uiCopy.packageTabsAria}>
        {ids.map((id) => {
          const opt = copy.options[id];
          const s = getTp5MobileService(id, locale);
          const on = id === activeId;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              className={`${styles.option} ${id === "dealer" ? styles.optionDealer : styles.optionMain}${on ? ` ${styles.optionOn}` : ""}`}
              onClick={() => onSelect(id)}
            >
              <span className={styles.radio} aria-hidden />
              <span className={styles.optionText}>
                <b>
                  {opt?.name ?? s.title}
                  {id === "dealer" ? <i className={styles.newBadge}>{uiCopy.newBadge}</i> : null}
                </b>
                <small>{opt?.sub ?? s.description}</small>
              </span>
              <em>{s.price}</em>
            </button>
          );
        })}
      </div>

      <div className={styles.expand}>
        <div className={styles.expandInner}>
          <label className={styles.field}>
            <span>{copy.vinLabel}</span>
            <input
              type="text"
              name="vin"
              className={`${styles.input}${errors.vin ? ` ${styles.inputError}` : vinHighlight ? ` ${tp5Styles.inlineInputPrefilled}` : ""}`}
              value={vin}
              onChange={(e) => onVinChange(sanitizeVinInput(e.target.value))}
              onPaste={(e) => {
                e.preventDefault();
                onVinChange(sanitizeVinInput(e.clipboardData.getData("text")));
              }}
              placeholder={copy.vinPlaceholder}
              aria-invalid={errors.vin ? true : undefined}
              aria-describedby={errors.vin ? `${uid}-vin` : undefined}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          {errors.vin ? (
            <p id={`${uid}-vin`} className={styles.fieldError}>
              {errors.vin}
            </p>
          ) : null}
          {service.hideListingUrl ? null : (
            <>
              <label className={styles.field}>
                <span>{copy.listingLabel}</span>
                <input
                  type="url"
                  name="listingUrl"
                  className={`${styles.input}${errors.listingUrl ? ` ${styles.inputError}` : ""}`}
                  value={listingUrl}
                  onChange={(e) => onListingUrlChange(e.target.value)}
                  placeholder={copy.listingPlaceholder}
                  aria-invalid={errors.listingUrl ? true : undefined}
                  aria-describedby={errors.listingUrl ? `${uid}-listing` : undefined}
                  autoComplete="url"
                  inputMode="url"
                />
              </label>
              {errors.listingUrl ? (
                <p id={`${uid}-listing`} className={styles.fieldError}>
                  {errors.listingUrl}
                </p>
              ) : null}
            </>
          )}

        </div>
      </div>

          <div className={styles.turn}>
            <span>
              ⏱ {copy.turnaround} <b>{fast ? copy.turnaroundFast : "24-72 h"}</b>
            </span>
            <i className={styles.sep} aria-hidden />
            <button
              type="button"
              className={`${styles.urgentBtn}${urgentOpen ? ` ${styles.urgentOpen}` : ""}`}
              aria-expanded={urgentOpen}
              aria-controls={`${uid}-urgent`}
              onClick={onUrgentClick}
            >
              {copy.urgent}
              <i aria-hidden />
            </button>
          </div>
          <div id={`${uid}-urgent`} className={`${styles.urgentPanel}${urgentOpen ? ` ${styles.urgentPanelOpen}` : ""}`}>
            <div>
              <p>{copy.urgentBody}</p>
              <div className={styles.urgentBtns}>
                <span className={styles.phoneText}>
                  <PhoneIcon />
                  <span>
                    +371 <b>{phoneGroups(TP5_TURNAROUND_INFO_PHONE_LOCAL)}</b>
                  </span>
                </span>
                <a className={styles.waBtn} href={waHref} target="_blank" rel="noopener noreferrer">
                  <WhatsAppIcon />
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>
          </div>

      <div className={`${styles.expand} ${styles.expandCta}`}>
        <div className={styles.expandInner}>
          {globalError ? (
            <p className={tp5Styles.checkoutError} role="alert">
              {globalError}
            </p>
          ) : null}
          <div className={`${tp5Styles.ctaWrap} ${styles.cta}`}>
            <button type="button" className={tp5Styles.liquidCta} onClick={onSubmit} disabled={loading}>
              <span className={tp5Styles.liquidCtaShimmer} aria-hidden />
              <span className={tp5Styles.liquidCtaLabel}>{getTp5MobileCtaLabel(service, false)}</span>
            </button>
          </div>
          {sample ? (
            <p className={styles.links}>
              <a href={sample} target="_blank" rel="noopener noreferrer" onClick={() => recordSampleReportClick()}>
                📄 {uiCopy.sampleReportLink}
              </a>
            </p>
          ) : null}
        </div>
      </div>

      {mounted && sheetOpen
        ? createPortal(
            <>
              <div className={styles.sheetBackdrop} onClick={() => setSheetOpen(false)} aria-hidden />
              <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={copy.urgent}>
                <i className={styles.sheetHandle} aria-hidden />
                <p className={styles.sheetTitle}>{copy.urgent}</p>
                <p className={styles.sheetBody}>{copy.urgentBody}</p>
                <a className={styles.sheetCall} href={`tel:${TP5_TURNAROUND_INFO_PHONE_TEL}`}>
                  <PhoneIcon />
                  <span>
                    {copy.call} <b>{phoneGroups(TP5_TURNAROUND_INFO_PHONE_LOCAL)}</b>
                  </span>
                </a>
                <a className={styles.sheetWa} href={waHref} target="_blank" rel="noopener noreferrer">
                  <WhatsAppIcon />
                  <span>WhatsApp</span>
                </a>
                <button type="button" className={styles.sheetClose} onClick={() => setSheetOpen(false)}>
                  {copy.close}
                </button>
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}
