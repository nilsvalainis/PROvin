"use client";

import { useTranslations } from "next-intl";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { Tp5DesktopFeatureIconRow } from "@/components/test-pricing-5/Tp5DesktopFeatureIconRow";
import { B2bPartnerLogin } from "@/components/b2b/B2bPartnerLogin";
import { B2B_BUSINESS_DESKTOP_FEATURES } from "@/lib/b2b-partner-copy";

export function B2bPartnerHero() {
  const t = useTranslations("Partner");

  return (
    <div className={styles.heroPricingShell}>
      <section id="b2b-partner-hero" className={styles.heroSurface} aria-labelledby="b2b-partner-hero-title">
        <div className={styles.heroInnerMobile}>
          <h1 id="b2b-partner-hero-title" className={styles.heroTitle}>
            {t("titlePrefix")}
            <span className={`${styles.heroTitleAccent} text-[#2563EB]`}>{t("titleAccent")}</span>
          </h1>
          <p className={`${styles.heroSubhead} mt-3 [display:block] overflow-visible [-webkit-line-clamp:unset]`}>
            {t("heroSubhead")}
          </p>
          <div className="mt-6">
            <B2bPartnerLogin />
          </div>
        </div>

        <div className={styles.heroInnerDesktop}>
          <header className={styles.heroCopyDesktop}>
            <h1 id="b2b-partner-hero-title-desktop" className={styles.heroTitleDesktop}>
              {t("titlePrefix")}
              <span className={`${styles.heroTitleAccent} text-[#2563EB]`}>{t("titleAccent")}</span>
            </h1>
            <p className={`${styles.heroSubhead} ${styles.heroSubheadDesktop} !max-w-[42rem]`}>
              {t("heroSubhead")}
            </p>
            <Tp5DesktopFeatureIconRow activeServiceId="audits" features={B2B_BUSINESS_DESKTOP_FEATURES} />
          </header>

          <div className={`${styles.heroStageDesktop} flex items-center`}>
            <B2bPartnerLogin />
          </div>
        </div>
      </section>
    </div>
  );
}
