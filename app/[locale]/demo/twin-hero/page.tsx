import { DemoTwinHeroConcept } from "@/components/demo/DemoTwinHeroConcept";
import { DemoViewportChips } from "@/components/demo/DemoViewportChips";
import styles from "@/app/[locale]/demo/page.module.css";

/** DEMO: divas blakus hero kartītes (AUDITS vs SELECT) — nav produkcijas sākumlapas daļa. */
export default function DemoTwinHeroPage() {
  return (
    <div className={styles.demoRoot}>
      <DemoViewportChips />
      <DemoTwinHeroConcept />
    </div>
  );
}
