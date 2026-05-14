"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { HeroVisual } from "@/components/HeroVisual";
import { OrderForm } from "@/components/OrderForm";
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
  const heroFeatureTitles = [t("productValue1"), t("productValue3"), t("productValue2"), t("productValue4")];
  const productSubhead = t("productSubheadRich");

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
                    <span className={styles.productHeroTitleMid}>{t("productTitlePart1")}</span>
                    <span className={styles.productHeroTitleMid}>{t("productTitlePart2")}</span>
                    <span className={styles.productHeroTitleMid}>{t("productTitlePart3")}</span>
                  </span>
                </h1>
                <h2 className="sr-only">Kāpēc ar parastu VIN koda pārbaudi nepietiek?</h2>
                <p className="sr-only">Profesionāla auto pārbaude pirms pirkšanas.</p>
                <p className={styles.productHeroSubhead}>{productSubhead}</p>
                <div className={styles.productHeroDivider} aria-hidden />

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
                    <ul className={`${styles.features} ${styles.heroTrust}`}>
                      {heroFeatureTitles.map((label) => (
                        <li key={label}>
                          <span className={`${styles.featureIcon} ${styles.featureIconCheck}`} aria-hidden>
                            ✓
                          </span>
                          <span>{label}</span>
                        </li>
                      ))}
                    </ul>
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
              </div>
            </div>
          </div>
        </section>
        {comparisonContent ? (
          <section className="demo-design-dir__section py-16 sm:py-20 md:py-24">
            <div className="demo-design-dir__shell">{comparisonContent}</div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
