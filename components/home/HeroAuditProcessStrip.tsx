"use client";

import { Fragment } from "react";
import { ArrowRight, CircleCheck, Cog, MessageCircle, Newspaper } from "lucide-react";
import { useTranslations } from "next-intl";
import styles from "@/app/[locale]/demo/page.module.css";

const STEP_ICONS = [CircleCheck, Cog, Newspaper, MessageCircle] as const;
const STEP_TONES = ["start", "mid", "mid", "end"] as const;

export function HeroAuditProcessStrip() {
  const t = useTranslations("Hero");
  const steps = t.raw("heroProcessSteps") as { title: string; short: string }[];

  return (
    <div className={styles.heroProcessStrip} role="list" aria-label={t("heroProcessAria")}>
      {steps.map((step, index) => {
        const Icon = STEP_ICONS[index] ?? CircleCheck;
        const tone = STEP_TONES[index] ?? "mid";
        const iconClass =
          tone === "start"
            ? styles.heroProcessIconStart
            : tone === "end"
              ? styles.heroProcessIconEnd
              : styles.heroProcessIconMid;

        return (
          <Fragment key={step.short}>
            {index > 0 ? (
              <ArrowRight className={styles.heroProcessArrow} strokeWidth={2} aria-hidden />
            ) : null}
            <div className={styles.heroProcessStep} role="listitem">
              <div className={`${styles.heroProcessIcon} ${iconClass}`} aria-hidden>
                <Icon className={styles.heroProcessIconSvg} strokeWidth={2} />
              </div>
              <div className={styles.heroProcessLabels}>
                <span className={styles.heroProcessTitle}>{step.title}</span>
                <span className={styles.heroProcessShort}>({step.short})</span>
              </div>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
