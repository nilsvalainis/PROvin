"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { HeroVisual } from "@/components/HeroVisual";
import { OrderForm } from "@/components/OrderForm";
import { demoHeroFeatureTitles } from "@/lib/demo-feature-titles";
import {
  HOME_HERO_ORDER_FORM_ID,
  ORDER_SECTION_ID,
} from "@/lib/order-section";
import { PROVIN_SELECT_SECTION_ID } from "@/lib/provin-select-section";
import styles from "@/app/[locale]/demo/page.module.css";

type Props = {
  /** `false` — PROVIN SELECT saite hero nav rādāma. */
  showProvinSelect?: boolean;
  comparisonContent?: ReactNode;
};

export default function HomeProductHero({ showProvinSelect = false, comparisonContent }: Props) {
  const [heroOrderStep, setHeroOrderStep] = useState<1 | 2>(1);
  const t = useTranslations("Hero");

  return (
    <div
      className={`home-hero-intro-surface flex min-h-0 min-w-0 flex-col ${styles.heroIntroSurface} ${styles.heroIntroSurfaceDepth}`}
    >
      <div className={styles.heroDarkBackdrop} aria-hidden>
        <div className={`${styles.heroVisualWrap} ${styles.heroVisualWrapAmbient}`} aria-hidden>
          <HeroVisual />
        </div>
        <div className={`home-hero-intro-scrim-gradient ${styles.demoScrimTune}`} aria-hidden />
        <div className={styles.heroDarkVeil} aria-hidden />
      </div>

      <div className="relative z-10 flex min-h-0 min-w-0 flex-col">
        <section id="home-hero" className={styles.heroSection} aria-labelledby="marketing-hero-product-title">
          <div className={styles.heroShell}>
            <div className={styles.heroColumnsProduct}>
              <div className={styles.heroLeftStack}>
                <h1 id="marketing-hero-product-title" className={styles.productHeroTitle}>
                  <span className={styles.productHeroTitleLine}>
                    <span className={styles.productHeroTitleAccent}>{t("productTitlePart1")}</span>
                    <span className={styles.productHeroTitleMid}>{t("productTitlePart2")}</span>
                    <span className={styles.productHeroTitleAccent}>{t("productTitlePart3")}</span>
                  </span>
                </h1>
                <p className={styles.productHeroSubhead}>{t("productSubhead")}</p>

                <div id={ORDER_SECTION_ID} className={`${styles.heroFormCard} scroll-mt-[calc(2.75rem+1px)]`}>
                  <OrderForm
                    variant="hero"
                    formId={HOME_HERO_ORDER_FORM_ID}
                    hideStepOneCta
                    onStepChange={setHeroOrderStep}
                    className="!mt-0 !space-y-0 !px-0 !py-0 sm:!px-0 sm:!py-0"
                  />
                </div>

                {heroOrderStep === 1 ? (
                  <div className="pointer-events-auto relative z-[80] mt-4 flex w-full max-w-[520px] min-w-0 flex-col items-stretch gap-2 sm:mt-5">
                    <button
                      type="button"
                      onClick={() => {
                        const el = document.getElementById(HOME_HERO_ORDER_FORM_ID);
                        if (el instanceof HTMLFormElement) el.requestSubmit();
                      }}
                      className={styles.ctaButton}
                    >
                      {t("heroMobileOrderCta")}
                    </button>
                    {showProvinSelect ? (
                      <a
                        href={`#${PROVIN_SELECT_SECTION_ID}`}
                        className={styles.heroConsultTextLink}
                      >
                        {t("heroConsultLink")}
                      </a>
                    ) : null}
                  </div>
                ) : null}

                <ul className={`${styles.features} ${styles.heroTrust}`}>
                  {demoHeroFeatureTitles.map((item) => (
                    <li key={item.label}>
                      {item.icon === "check" ? (
                        <span className={`${styles.featureIcon} ${styles.featureIconCheck}`} aria-hidden>
                          ✓
                        </span>
                      ) : (
                        <span className={`${styles.featureIcon} ${styles.featureIconShield}`} aria-hidden>
                          <svg viewBox="0 0 24 24" focusable="false">
                            <path d="M12 2.5 4.5 5.7v6.1c0 5.2 3.2 9.4 7.5 10.9 4.3-1.5 7.5-5.7 7.5-10.9V5.7L12 2.5Zm0 2.2 5.3 2.2v4.9c0 4.2-2.4 7.5-5.3 8.8-2.9-1.3-5.3-4.6-5.3-8.8V6.9L12 4.7Zm-1.2 10.2 5.2-5.2 1.4 1.4-6.6 6.6-3.2-3.2 1.4-1.4 1.8 1.8Z" />
                          </svg>
                        </span>
                      )}
                      <span>{item.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
        {comparisonContent ? (
          <section className="demo-design-dir__section demo-design-dir__section--unified-pricing-tail py-16 sm:py-20 md:py-24">
            <div className="demo-design-dir__shell">{comparisonContent}</div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
