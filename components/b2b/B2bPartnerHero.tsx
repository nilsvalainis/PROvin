"use client";

import { type CSSProperties, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { EuropeDotMap } from "@/components/EuropeDotMap";
import { B2bPartnerLogin } from "@/components/b2b/B2bPartnerLogin";
import { B2bQuoteCta } from "@/components/b2b/B2bQuoteCta";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { getB2bHeroSourceItems } from "@/lib/b2b-partner-copy";
import { homeFooterColumnClass } from "@/lib/home-layout";
import { renderProvinText } from "@/lib/provin-wordmark";
import { renderB2bProvinBusinessName } from "@/components/b2b/b2b-provin-business-name";

const INCLUDED_ID = "b2b-ietverts";

const delay = (d: number) => ({ "--d": d }) as CSSProperties;

/**
 * Partneriem v3: virsraksts + piedāvājuma CTA pa kreisi, Eiropas punktu karte ar stikla ieejas kartīti pa labi,
 * zem kartītes „Kas iekļauts” (saite uz sarakstu), tad „Kāpēc PROVIN Business”.
 */
export function B2bPartnerHero({
  afterContact,
  panel,
  hideContact = false,
  widePanel = false,
  mapPage,
}: {
  afterContact?: ReactNode;
  /** Login by default; invite register (or invalid-token copy) replaces the aside. */
  panel?: ReactNode;
  /** Apakšlapām (reģistrācija, parole): bez piedāvājuma CTA un „Kas iekļauts”. */
  hideContact?: boolean;
  widePanel?: boolean;
  /** Kartes novietojums datorā katrai apakšlapai (Nila novietojums 07.11). */
  mapPage?: "registracija" | "parole" | "apstiprinat";
}) {
  const t = useTranslations("Partner");
  const locale = useLocale();
  const sources = getB2bHeroSourceItems(locale);
  const aside = panel ?? <B2bPartnerLogin />;
  const beats = [
    { label: t("heroBeatRisk"), body: t("heroLead") },
    { label: t("heroBeatReputation"), body: t("heroLeadProof") },
    { label: t("heroBeatSafety"), body: t("heroLeadTrust") },
  ];

  return (
    <div className={styles.heroPricingShell}>
      <section id="b2b-partner-hero" className="b2b-v3" aria-labelledby="b2b-partner-hero-title">
        <div className={`${homeFooterColumnClass} b2b-v3-col`}>
          <div className={`b2b-h${widePanel ? " is-wide" : ""}`}>
            <div className="b2b-ht">
              <h1 id="b2b-partner-hero-title" className="b2b-h1">
                <span className="b2b-wd" style={delay(0)}>
                  {renderProvinText(t("titlePrefix").trim(), { proAndSuffixClassName: "provin-wordmark-pro--rail-inherit" })}
                </span>{" "}
                <span className="b2b-wd is-grey" style={delay(1)}>
                  {t("titleAccent")}
                </span>
              </h1>
              <p className="b2b-lead">{t("heroSubhead")}</p>
              {hideContact ? null : <B2bQuoteCta className="b2b-ht-cta" />}
            </div>

            <div className="b2b-hv">
              <div className={`b2b-map${mapPage ? ` is-${mapPage}` : ""}`}>
                <EuropeDotMap />
              </div>
              <div className="b2b-card">
                <p className="b2b-card-label">{t("heroCardTitle")}</p>
                {aside}
                {hideContact ? null : (
                  <a href={`#${INCLUDED_ID}`} className="b2b-inc">
                    {t("heroIncludedLink")}
                    <i aria-hidden />
                  </a>
                )}
              </div>
            </div>
          </div>

          {hideContact ? null : (
            <section id={INCLUDED_ID} className="b2b-incs" aria-labelledby="b2b-inc-heading">
              <h2 id="b2b-inc-heading" className="b2b-tag">
                {t("heroIncludedLink")}
              </h2>
              <ul className="b2b-inc-list">
                {sources.map((item) => (
                  <li key={item.title}>
                    <i aria-hidden />
                    <b>{item.title}</b>
                  </li>
                ))}
              </ul>
              <p className="b2b-inc-note">{t("heroSourcesNote")}</p>
            </section>
          )}

          <h2 className="b2b-h2">{renderB2bProvinBusinessName(t("heroWhyHeading"))}</h2>
          <div className="b2b-3">
            {beats.map((beat) => (
              <article key={beat.label} className="b2b-beat">
                <p className="b2b-tag">{beat.label}</p>
                <p className="b2b-beat-p">{renderB2bProvinBusinessName(beat.body)}</p>
              </article>
            ))}
          </div>
          {afterContact ? <div className="mt-6">{afterContact}</div> : null}
        </div>
      </section>
    </div>
  );
}
