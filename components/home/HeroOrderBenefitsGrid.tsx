"use client";

import { useTranslations } from "next-intl";
import styles from "@/app/[locale]/demo/page.module.css";

const CHECK_VARIANTS = ["blue", "blue", "green", "blue"] as const;

function BenefitCheckBadge({ variant }: { variant: (typeof CHECK_VARIANTS)[number] }) {
  const toneClass = variant === "green" ? styles.heroBenefitCheckGreen : styles.heroBenefitCheckBlue;
  return (
    <span className={`${styles.heroBenefitCheck} ${toneClass}`} aria-hidden>
      <svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M2.5 6.25 4.75 8.5 9.5 3.75"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/** 2×2 ieguvumu režģis virs hero CTA (aizstāj veco horizontālo ikonu joslu). */
export function HeroOrderBenefitsGrid() {
  const t = useTranslations("Hero");
  const items = t.raw("heroOrderBenefits") as string[];

  return (
    <ul className={styles.heroOrderBenefits} aria-label={t("heroOrderBenefitsAria")}>
      {items.map((label, index) => (
        <li key={label} className={styles.heroOrderBenefitItem}>
          <BenefitCheckBadge variant={CHECK_VARIANTS[index] ?? "blue"} />
          <span className={styles.heroOrderBenefitLabel}>{label}</span>
        </li>
      ))}
    </ul>
  );
}
