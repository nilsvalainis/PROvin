import type { Metadata } from "next";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import { AzvinAboutSection } from "@/components/demo/azvin/AzvinAboutSection";
import styles from "@/app/[locale]/view/n7k4xw9q/azvin.module.css";

export const metadata: Metadata = {
  title: "AZ.VIN",
  robots: { index: false, follow: false },
};

const AzvinHero = dynamic(
  () => import("@/components/demo/azvin/AzvinHero").then((m) => m.AzvinHero),
  {
    loading: () => (
      <div className={styles.page} aria-busy="true" aria-label="Loading…">
        <div className={styles.heroLoading} />
      </div>
    ),
  },
);

export default function AzvinDemoPage() {
  return (
    <div className={styles.page}>
      <Suspense fallback={null}>
        <AzvinHero />
      </Suspense>
      <AzvinAboutSection />
    </div>
  );
}
