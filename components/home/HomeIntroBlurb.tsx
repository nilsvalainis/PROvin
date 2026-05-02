"use client";

import { useTranslations } from "next-intl";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";
import { renderProvinText } from "@/lib/provin-wordmark";
import styles from "@/app/[locale]/demo/page.module.css";

type Props = {
  introBodyText: string;
  /** `hero` — labā kolonna pie produkta hero; `page` — atsevišķa josla zem hero. */
  variant?: "hero" | "page";
};

export function HomeIntroBlurb({ introBodyText, variant = "page" }: Props) {
  const t = useTranslations("Hero");
  const isHero = variant === "hero";

  return (
    <div
      id="home-intro"
      role="region"
      aria-labelledby="home-intro-heading"
      className={
        isHero
          ? `scroll-mt-20 ${styles.heroIntroBlurbInHero}`
          : "scroll-mt-16 border-b border-white/[0.06] pb-10 pt-2 sm:pb-12 sm:pt-0"
      }
    >
      <div className={styles.heroIntroBlurbShell}>
        <div
          className={
            isHero ? `${styles.heroFormCard} ${styles.heroIntroBlurbFormCard}` : styles.heroGlassCard
          }
        >
          <h2
            id="home-intro-heading"
            className={isHero ? styles.heroIntroBlurbFormTitle : styles.heroGlassTitle}
          >
            {t("introBlurbTitle")}{" "}
            <span className={styles.heroGlassTitleNowrap}>
              <span className={isHero ? styles.heroIntroBlurbFormTitlePro : styles.heroGlassTitlePro}>
                PRO
              </span>
              <span className="text-provin-accent">VIN</span>
            </span>
            {t("introBlurbTitleSuffix")}
          </h2>
          <div className={styles.heroGlassScan}>
            <DiagnosticScanLine variant="rail" motion="alongPingPong" className="w-full" />
          </div>
          <p className={isHero ? styles.heroIntroBlurbFormBody : styles.heroGlassBody}>
            {renderProvinText(introBodyText, {
              proAndSuffixClassName: isHero ? styles.heroIntroBlurbFormPro : styles.heroGlassPro,
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
