import type { ReactNode } from "react";
import productHeroStyles from "@/app/[locale]/demo/page.module.css";
import tp5Styles from "@/components/test-pricing-5/test-pricing-5.module.css";

/** Tumšā bloga virsma — tā pati home/pakalpojumi canvas loģika. */
export function BlogPageShell({ children }: { children: ReactNode }) {
  return (
    <div className={`home-page-canvas-root ${productHeroStyles.demoRoot} ${tp5Styles.homePageCanvas}`}>
      <div className="demo-design-dir flex min-h-0 min-w-0 flex-col bg-transparent text-zinc-100">{children}</div>
    </div>
  );
}
