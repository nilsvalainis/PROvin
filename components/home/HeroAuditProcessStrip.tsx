"use client";

import { Fragment, type CSSProperties } from "react";
import { AlertTriangle, ArrowRight, Globe2, ScanSearch, ShieldCheck, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import styles from "@/app/[locale]/demo/page.module.css";

/** Tās pašas ikonas kā PROVIN AUDITS (`HomeServiceComparison`), hero secībā. */
const HERO_AUDIT_PROCESS_ICONS: LucideIcon[] = [Globe2, AlertTriangle, ScanSearch, ShieldCheck];
const RISK_STEP_INDEX = 1;

type HeroProcessStep = { line1: string; line2: string };

export function HeroAuditProcessStrip() {
  const t = useTranslations("Hero");
  const steps = t.raw("heroProcessSteps") as HeroProcessStep[];

  return (
    <div className={styles.heroProcessStrip} role="list" aria-label={t("heroProcessAria")}>
      {steps.map((step, index) => {
        const Icon = HERO_AUDIT_PROCESS_ICONS[index] ?? Globe2;
        const risk = index === RISK_STEP_INDEX;
        const iconRingClass = risk ? styles.heroProcessIconRingRisk : styles.heroProcessIconRingBlue;
        const iconTone = risk
          ? "marketing-hero-pillar-icon--risk text-[#ff342e]"
          : "text-[#0066ff]";
        const label = `${step.line1} ${step.line2}`;
        const stepStyle = { "--step-i": index } as CSSProperties;

        return (
          <Fragment key={label}>
            {index > 0 ? (
              <ArrowRight className={styles.heroProcessArrow} strokeWidth={2} aria-hidden />
            ) : null}
            <div className={styles.heroProcessStep} style={stepStyle} role="listitem" aria-label={label}>
              <div className={`${styles.heroProcessIcon} ${iconRingClass}`} style={stepStyle} aria-hidden>
                <Icon
                  className={`marketing-hero-pillar-icon ${styles.heroProcessIconSvg} shrink-0 [stroke-width:1.6] ${iconTone}`}
                  strokeWidth={1.6}
                />
              </div>
              <span className={styles.heroProcessLabel}>
                <span className={styles.heroProcessLabelLine}>{step.line1}</span>
                <span className={styles.heroProcessLabelLine}>{step.line2}</span>
              </span>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
