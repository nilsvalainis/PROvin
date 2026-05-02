"use client";

import { useTranslations } from "next-intl";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";
import { renderProvinText } from "@/lib/provin-wordmark";
import styles from "@/app/[locale]/demo/page.module.css";

type Props = {
  introBodyText: string;
};

/**
 * Bijušais „Kas ir PROVIN?” hero labās puses saturs — pārvietots zem hero,
 * lai hero fokuss paliktu uz vienu CTA.
 */
export function HomeIntroBlurb({ introBodyText }: Props) {
  const t = useTranslations("Hero");

  return (
    <div
      id="home-intro"
      role="region"
      aria-labelledby="home-intro-heading"
      className="scroll-mt-16 border-b border-white/[0.06] pb-10 pt-2 sm:pb-12 sm:pt-0"
    >
      <div className={styles.heroIntroBlurbShell}>
        <div className={styles.heroGlassCard}>
          <h2 id="home-intro-heading" className={styles.heroGlassTitle}>
            {t("introBlurbTitle")}{" "}
            <span className={styles.heroGlassTitleNowrap}>
              <span className={styles.heroGlassTitlePro}>PRO</span>
              <span className="text-provin-accent">VIN</span>
            </span>
            {t("introBlurbTitleSuffix")}
          </h2>
          <div className={styles.heroGlassScan}>
            <DiagnosticScanLine variant="rail" motion="alongPingPong" className="w-full" />
          </div>
          <p className={styles.heroGlassBody}>
            {renderProvinText(introBodyText, { proAndSuffixClassName: styles.heroGlassPro })}
          </p>
        </div>
      </div>
    </div>
  );
}
