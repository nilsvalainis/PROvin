"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";
import { HeroVisual } from "@/components/HeroVisual";
import { OrderForm } from "@/components/OrderForm";
import { demoHeroFeatureTitles } from "@/lib/demo-feature-titles";
import {
  HOME_HERO_ORDER_FORM_ID,
  ORDER_SECTION_ID,
} from "@/lib/order-section";
import styles from "@/app/[locale]/demo/page.module.css";

type Props = {
  introBody: ReactNode;
};

export function HomeProductHero({ introBody }: Props) {
  const [heroOrderStep, setHeroOrderStep] = useState<1 | 2>(1);
  const t = useTranslations("Hero");

  return (
    <div className={`home-hero-intro-surface ${styles.heroIntroSurface} relative z-[5]`}>
      <div className={styles.heroDarkBackdrop} aria-hidden>
        <div className={styles.heroVisualWrap}>
          <HeroVisual />
        </div>
        <div className={`home-hero-intro-scrim-gradient ${styles.demoScrimTune}`} aria-hidden />
        <div className={styles.heroDarkVeil} aria-hidden />
      </div>

      <div className="relative z-10 min-w-0">
        <section id="home-hero" className={styles.heroSection} aria-labelledby="marketing-hero-product-title">
          <div className={styles.shell}>
            <div className={styles.heroColumns}>
              <div className={styles.left}>
                <h1 id="marketing-hero-product-title" className={styles.title}>
                  <span className={`${styles.titleRow} ${styles.titleSubLine}`}>
                    <span className={styles.titleAccent}>{t("h1Vin")}</span>
                    <span className={styles.titleInk}> {t("h1Un")}</span>
                  </span>
                  <span className={`${styles.titleRow} ${styles.titleSubLine}`}>
                    <span className={styles.titleAccent}>{t("h1Sludinajuma")}</span>
                  </span>
                  <span className={`${styles.titleRow} ${styles.titleAuditsLine}`}>{t("h1Line2")}</span>
                </h1>

                <div
                  id={ORDER_SECTION_ID}
                  className={`${styles.productHeroOrderSlot} scroll-mt-[calc(2.75rem+1px)]`}
                >
                  <OrderForm
                    variant="hero"
                    formId={HOME_HERO_ORDER_FORM_ID}
                    hideStepOneCta
                    onStepChange={setHeroOrderStep}
                    className="!mt-0 !space-y-0 !px-0 !py-0 sm:!px-0 sm:!py-0"
                  />
                </div>

                {heroOrderStep === 1 ? (
                  <div className="pointer-events-auto relative z-[80] w-full max-w-[520px] min-w-0">
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
                  </div>
                ) : null}

                <ul className={styles.features}>
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

              <aside id="home-intro" className={styles.heroIntroPanel}>
                <div className={styles.heroGlassCard}>
                  <h2 className={styles.heroGlassTitle}>
                    KAS IR{" "}
                    <span className={styles.heroGlassTitleNowrap}>
                      <span className={styles.heroGlassTitlePro}>PRO</span>
                      <span className="text-provin-accent">VIN</span>
                    </span>
                    ?
                  </h2>
                  <div className={styles.heroGlassScan}>
                    <DiagnosticScanLine variant="rail" motion="alongPingPong" className="w-full" />
                  </div>
                  <p className={styles.heroGlassBody}>{introBody}</p>
                </div>
              </aside>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
